import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RepositoryHealth } from "@/lib/data/repository";
import type { FileContent, FileLocation, PhotoStore, StoredFile } from "@/lib/files/store";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/**
 * Keeps uploads on disk while an app runs on sample data, in the same folder
 * layout Drive uses, so the whole flow can be tried without Google.
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

  async save(location: FileLocation, file: { name: string; bytes: Uint8Array }): Promise<StoredFile> {
    const id = path.join(...location.folders, file.name);
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
