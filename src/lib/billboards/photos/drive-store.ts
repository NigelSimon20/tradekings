import { Readable } from "node:stream";

import { auth as googleAuth, drive as driveApi, type drive_v3 } from "@googleapis/drive";

import { cityFolderName, siteFolderName } from "@/lib/billboards/photos/files";
import type { FileContent, PhotoStore, StoredFile } from "@/lib/billboards/photos/store";
import type { Billboard } from "@/lib/billboards/types";
import { describeGoogleError } from "@/lib/data/google-sheets-repository";
import { RepositoryError, type RepositoryHealth } from "@/lib/data/repository";

const FOLDER = "application/vnd.google-apps.folder";

/** Every call must say it understands Shared drives, or Drive hides them. */
const SHARED = { supportsAllDrives: true } as const;

/** Drive query strings are quoted with single quotes; escape what is inside. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * Files uploads into Google Drive: one folder per city, one folder per site
 * inside it. Either the tracker's service account files into a Shared drive (a
 * service account has no storage of its own, so it must be a Shared drive), or
 * a Google account an administrator connected files into its own Drive.
 *
 * Site folders carry the billboard id as an app property, so renaming a site
 * or moving it to another city renames or moves its existing folder rather
 * than starting a new one.
 */
export type DriveCredentials =
  /** The tracker's service account, filing into a Shared drive. */
  | { type: "service-account"; clientEmail: string; privateKey: string }
  /** A Google account an administrator connected, filing into its own Drive. */
  | { type: "connected-account"; clientId: string; clientSecret: string; refreshToken: string; email: string };

export class DrivePhotoStore implements PhotoStore {
  readonly kind = "google-drive" as const;
  readonly label: string;

  private client: drive_v3.Drive | null = null;
  private readonly cityFolders = new Map<string, string>();

  constructor(private readonly config: { rootFolderId: string; credentials: DriveCredentials }) {
    this.label =
      config.credentials.type === "service-account"
        ? "Google Shared drive"
        : `Google Drive of ${config.credentials.email}`;
  }

  private api(): drive_v3.Drive {
    if (!this.client) {
      const { credentials } = this.config;
      if (credentials.type === "service-account") {
        const jwt = new googleAuth.JWT({
          email: credentials.clientEmail,
          key: credentials.privateKey,
          scopes: ["https://www.googleapis.com/auth/drive"],
        });
        this.client = driveApi({ version: "v3", auth: jwt });
      } else {
        const oauth = new googleAuth.OAuth2(credentials.clientId, credentials.clientSecret);
        oauth.setCredentials({ refresh_token: credentials.refreshToken });
        this.client = driveApi({ version: "v3", auth: oauth });
      }
    }
    return this.client;
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const message = String((error as Error).message ?? "");
      if (/Drive API has not been used|is disabled/i.test(message)) {
        throw new RepositoryError(
          "The Google Drive API is switched off for the tracker's Google Cloud project. Ask your system administrator to enable it.",
          { cause: error },
        );
      }
      if (/invalid_grant|invalid_client|unauthorized_client/i.test(message)) {
        throw new RepositoryError(
          "The Google account connected for uploads has stopped working (it may have been disconnected or its password changed). A billboard administrator can connect it again from Setup & access.",
          { cause: error },
        );
      }
      if (/storage quota/i.test(message)) {
        throw new RepositoryError(
          "The upload folder is not in a Shared drive, so Google has nowhere to store the file. Use a folder inside a Shared drive.",
          { cause: error },
        );
      }
      throw new RepositoryError(describeGoogleError(error), { cause: error });
    }
  }

  private async findFolder(query: string): Promise<drive_v3.Schema$File | null> {
    const response = await this.call(() =>
      this.api().files.list({
        ...SHARED,
        q: `${query} and mimeType=${quote(FOLDER)} and trashed=false`,
        includeItemsFromAllDrives: true,
        corpora: "allDrives",
        fields: "files(id,name,parents)",
        pageSize: 1,
      }),
    );
    return response.data.files?.[0] ?? null;
  }

  private async createFolder(name: string, parent: string, appProperties?: Record<string, string>) {
    const response = await this.call(() =>
      this.api().files.create({
        ...SHARED,
        requestBody: { name, mimeType: FOLDER, parents: [parent], appProperties },
        fields: "id",
      }),
    );
    return response.data.id!;
  }

  private async cityFolder(city: string): Promise<string> {
    const name = cityFolderName(city);
    const cached = this.cityFolders.get(name);
    if (cached) return cached;

    const found = await this.findFolder(`name=${quote(name)} and ${quote(this.config.rootFolderId)} in parents`);
    const id = found?.id ?? (await this.createFolder(name, this.config.rootFolderId));
    this.cityFolders.set(name, id);
    return id;
  }

  private async siteFolder(billboard: Billboard): Promise<string> {
    const city = await this.cityFolder(billboard.city);
    const name = siteFolderName(billboard);
    const found = await this.findFolder(
      `appProperties has { key='billboardId' and value=${quote(billboard.id)} }`,
    );
    if (!found?.id) return this.createFolder(name, city, { billboardId: billboard.id });

    // Keep the folder in step with the site's current name and city.
    const parents = found.parents ?? [];
    if (found.name !== name || !parents.includes(city)) {
      await this.call(() =>
        this.api().files.update({
          ...SHARED,
          fileId: found.id!,
          requestBody: { name },
          addParents: parents.includes(city) ? undefined : city,
          removeParents: parents.includes(city) ? undefined : parents.join(","),
        }),
      );
    }
    return found.id;
  }

  async save(
    billboard: Billboard,
    file: { name: string; mimeType: string; bytes: Uint8Array },
  ): Promise<StoredFile> {
    const parent = await this.siteFolder(billboard);
    const response = await this.call(() =>
      this.api().files.create({
        ...SHARED,
        requestBody: { name: file.name, parents: [parent], appProperties: { billboardId: billboard.id } },
        media: { mimeType: file.mimeType, body: Readable.from(Buffer.from(file.bytes)) },
        fields: "id,webViewLink",
      }),
    );
    return { id: response.data.id!, url: response.data.webViewLink ?? "" };
  }

  async read(id: string): Promise<FileContent> {
    const [meta, content] = await Promise.all([
      this.call(() => this.api().files.get({ ...SHARED, fileId: id, fields: "mimeType" })),
      this.call(() =>
        this.api().files.get({ ...SHARED, fileId: id, alt: "media" }, { responseType: "arraybuffer" }),
      ),
    ]);
    return {
      bytes: new Uint8Array(content.data as unknown as ArrayBuffer),
      mimeType: meta.data.mimeType ?? "application/octet-stream",
    };
  }

  async healthCheck(): Promise<RepositoryHealth> {
    try {
      const response = await this.call(() =>
        this.api().files.get({
          ...SHARED,
          fileId: this.config.rootFolderId,
          fields: "id,name,driveId,mimeType,capabilities(canAddChildren)",
        }),
      );
      const folder = response.data;
      const warnings: string[] = [];
      // A connected account files into its own Drive; only the service account needs a Shared drive.
      if (!folder.driveId && this.config.credentials.type === "service-account") {
        warnings.push(
          "This folder is in someone's personal Drive, not a Shared drive, so uploads will fail. Use a Shared drive.",
        );
      }
      if (folder.capabilities?.canAddChildren === false) {
        warnings.push("The tracker can see the folder but cannot add to it. Give it the Content manager role.");
      }
      return { ok: warnings.length === 0, detail: `Filing uploads in “${folder.name}”`, warnings };
    } catch (error) {
      return { ok: false, detail: (error as Error).message, warnings: [] };
    }
  }
}

const ROOT_FOLDER_NAME = "Trade Kings Billboard Photos";

/**
 * The top folder for a newly connected account: found again if this account
 * was connected before, otherwise created in its My Drive. With the
 * `drive.file` permission the tracker can only see folders it made, which is
 * why it makes its own rather than using one picked by hand.
 */
export async function ensureConnectedRootFolder(credentials: Extract<DriveCredentials, { type: "connected-account" }>): Promise<string> {
  const oauth = new googleAuth.OAuth2(credentials.clientId, credentials.clientSecret);
  oauth.setCredentials({ refresh_token: credentials.refreshToken });
  const api = driveApi({ version: "v3", auth: oauth });

  const existing = await api.files.list({
    q: `appProperties has { key='trackerRoot' and value='billboard-photos' } and mimeType=${quote(FOLDER)} and trashed=false`,
    fields: "files(id)",
    pageSize: 1,
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await api.files.create({
    requestBody: { name: ROOT_FOLDER_NAME, mimeType: FOLDER, appProperties: { trackerRoot: "billboard-photos" } },
    fields: "id",
  });
  return created.data.id!;
}

export { ROOT_FOLDER_NAME };
