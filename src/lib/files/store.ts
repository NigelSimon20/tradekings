import type { RepositoryHealth } from "@/lib/data/repository";

export interface StoredFile {
  /** The store's id for the file, kept in the app's Documents tab. */
  id: string;
  /** Where a person can open it outside the tracker (Drive), if anywhere. */
  url: string;
}

export interface FileContent {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * Where a file goes: a path of folder names under the app's top folder, the
 * last of which is also tagged with a stable key (e.g. the billboard id), so a
 * renamed or moved record keeps its folder rather than getting a new one.
 */
export interface FileLocation {
  folders: string[];
  key: { name: string; value: string };
}

/**
 * Where an app's uploaded photos and documents are kept: Google Drive in
 * production, a local folder while running on sample data.
 */
export interface PhotoStore {
  readonly kind: "google-drive" | "local" | "none";
  readonly label: string;
  save(location: FileLocation, file: { name: string; mimeType: string; bytes: Uint8Array }): Promise<StoredFile>;
  read(id: string): Promise<FileContent>;
  healthCheck(): Promise<RepositoryHealth>;
}

/** Uploads are switched off: the sheet is live but no Drive storage is connected. */
export class NoPhotoStore implements PhotoStore {
  readonly kind = "none" as const;
  readonly label = "Not set up";

  async save(): Promise<StoredFile> {
    throw new Error(
      "Uploading is not set up yet. An administrator can connect Google Drive from Setup & access.",
    );
  }

  async read(): Promise<FileContent> {
    throw new Error("Uploading is not set up, so there are no stored files to show.");
  }

  async healthCheck(): Promise<RepositoryHealth> {
    return { ok: false, detail: "Uploads are off — no Google Drive is connected.", warnings: [] };
  }
}
