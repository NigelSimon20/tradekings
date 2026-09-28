import type { RepositoryHealth } from "@/lib/data/repository";
import type { Billboard } from "@/lib/billboards/types";

export interface StoredFile {
  /** The store's id for the file, kept in the Documents tab. */
  id: string;
  /** Where a person can open it outside the tracker (Drive), if anywhere. */
  url: string;
}

export interface FileContent {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * Where uploaded billboard photos and documents are kept: a Google Shared
 * drive in production, a local folder while running on the sample data. Both
 * file by city, then by site.
 */
export interface PhotoStore {
  readonly kind: "google-drive" | "local" | "none";
  readonly label: string;
  save(billboard: Billboard, file: { name: string; mimeType: string; bytes: Uint8Array }): Promise<StoredFile>;
  read(id: string): Promise<FileContent>;
  healthCheck(): Promise<RepositoryHealth>;
}

/** Uploads are switched off: the sheet is live but no Shared drive is set. */
export class NoPhotoStore implements PhotoStore {
  readonly kind = "none" as const;
  readonly label = "Not set up";

  async save(): Promise<StoredFile> {
    throw new Error(
      "Uploading is not set up yet. Ask your system administrator to connect a Google Shared drive (see Setup & access).",
    );
  }

  async read(): Promise<FileContent> {
    throw new Error("Uploading is not set up, so there are no stored files to show.");
  }

  async healthCheck(): Promise<RepositoryHealth> {
    return {
      ok: false,
      detail: "Uploads are off — no Shared drive is connected.",
      warnings: [],
    };
  }
}
