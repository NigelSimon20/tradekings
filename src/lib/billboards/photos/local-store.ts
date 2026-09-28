import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { cityFolderName, siteFolderName } from "@/lib/billboards/photos/files";
import type { FileContent, PhotoStore, StoredFile } from "@/lib/billboards/photos/store";
import type { Billboard } from "@/lib/billboards/types";
import type { RepositoryHealth } from "@/lib/data/repository";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/**
 * Keeps uploads on disk while the tracker runs on sample data, in the same
 * City / Site layout the Shared drive uses, so the whole flow can be tried
 * without Google.
 */
export class LocalPhotoStore implements PhotoStore {
  readonly kind = "local" as const;
  readonly label = "Local folder (sample data)";
  private readonly root: string;

  constructor(directory: string) {
    this.root = path.resolve(/* turbopackIgnore: true */ process.cwd(), directory);
  }

  /** Ids are paths relative to the root; anything reaching outside it is refused. */
  private resolve(id: string): string {
    const full = path.resolve(this.root, id);
    if (!full.startsWith(this.root + path.sep)) throw new Error("That file is not in the uploads folder.");
    return full;
  }

  async save(billboard: Billboard, file: { name: string; bytes: Uint8Array }): Promise<StoredFile> {
    const id = path.join(cityFolderName(billboard.city), siteFolderName(billboard), file.name);
    const full = this.resolve(id);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.bytes);
    return { id, url: "" };
  }

  async read(id: string): Promise<FileContent> {
    const full = this.resolve(id);
    return {
      bytes: new Uint8Array(await readFile(full)),
      mimeType: TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream",
    };
  }

  async healthCheck(): Promise<RepositoryHealth> {
    return { ok: true, detail: `Saving uploads to ${path.relative(process.cwd(), this.root)}`, warnings: [] };
  }
}
