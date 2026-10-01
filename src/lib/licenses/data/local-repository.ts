import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isServerless } from "@/lib/config/env";
import { RepositoryError, type RepositoryHealth } from "@/lib/data/repository";
import { todayIn } from "@/lib/date/dates";
import type { LicenseRepository } from "@/lib/licenses/data/repository";
import { buildSeedLicenses } from "@/lib/licenses/data/seed";
import type {
  Asset,
  License,
  LicenseActivity,
  LicenseData,
  LicenseDocument,
  Renewal,
} from "@/lib/licenses/types";

interface LocalLicenseStore extends LicenseData {
  version: 1;
  settings?: Record<string, string>;
}

/**
 * File-backed license store for development and demos, seeded with a sample
 * register on first use. Writes are serialised, and a read-only filesystem
 * falls back to memory.
 */
export class LocalLicenseRepository implements LicenseRepository {
  readonly kind = "local" as const;
  readonly label = "Local sample file";

  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private memory: LocalLicenseStore | null = null;
  private readOnly = isServerless();

  constructor(filePath: string, private readonly timezone: string) {
    this.file = path.isAbsolute(filePath)
      ? filePath
      : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
  }

  private seed(): LocalLicenseStore {
    return { version: 1, ...buildSeedLicenses(todayIn(this.timezone)) };
  }

  private async read(): Promise<LocalLicenseStore> {
    if (this.memory) return this.memory;
    if (this.readOnly) {
      this.memory = this.seed();
      return this.memory;
    }
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Partial<LocalLicenseStore>;
      return {
        version: 1,
        assets: parsed.assets ?? [],
        licenses: parsed.licenses ?? [],
        renewals: parsed.renewals ?? [],
        documents: parsed.documents ?? [],
        activity: parsed.activity ?? [],
        settings: parsed.settings ?? {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const store = this.seed();
        await this.write(store);
        return this.memory ?? store;
      }
      throw new RepositoryError(`The sample license data could not be opened: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  private async write(store: LocalLicenseStore): Promise<void> {
    if (this.readOnly) {
      this.memory = store;
      return;
    }
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    } catch (error) {
      console.warn("Sample license data could not be saved, continuing in memory:", (error as Error).message);
      this.readOnly = true;
      this.memory = store;
    }
  }

  private mutate(operation: (store: LocalLicenseStore) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const store = await this.read();
      operation(store);
      await this.write(store);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async readAll(): Promise<LicenseData> {
    const { assets, licenses, renewals, documents, activity } = await this.read();
    return { assets, licenses, renewals, documents, activity };
  }

  saveAsset(asset: Asset): Promise<void> {
    return this.mutate((store) => upsert(store.assets, asset));
  }

  saveLicense(license: License): Promise<void> {
    return this.mutate((store) => upsert(store.licenses, license));
  }

  addRenewal(renewal: Renewal): Promise<void> {
    return this.mutate((store) => void store.renewals.push(renewal));
  }

  saveDocument(document: LicenseDocument): Promise<void> {
    return this.mutate((store) => upsert(store.documents, document));
  }

  appendActivity(entries: LicenseActivity[]): Promise<void> {
    return this.mutate((store) => void store.activity.push(...entries));
  }

  async readSetting(key: string): Promise<string | null> {
    return (await this.read()).settings?.[key] ?? null;
  }

  saveSetting(key: string, value: string | null): Promise<void> {
    return this.mutate((store) => {
      const settings = { ...store.settings };
      if (value === null) delete settings[key];
      else settings[key] = value;
      store.settings = settings;
    });
  }

  appendAll(data: LicenseData): Promise<void> {
    return this.mutate((store) => {
      store.assets.push(...data.assets);
      store.licenses.push(...data.licenses);
      store.renewals.push(...data.renewals);
      store.documents.push(...data.documents);
      store.activity.push(...data.activity);
    });
  }

  async healthCheck(): Promise<RepositoryHealth> {
    const { licenses, assets } = await this.read();
    return {
      ok: true,
      detail: `Sample data — ${licenses.length} licenses across ${assets.length} assets`,
      warnings: this.readOnly ? ["Changes are kept in memory only and will be lost when the server restarts."] : [],
    };
  }

  async setUpStorage(): Promise<{ ok: boolean; messages: string[] }> {
    return {
      ok: false,
      messages: [
        "There is no license spreadsheet to set up yet. Ask your system administrator to set GOOGLE_LICENSES_SHEET_ID first.",
      ],
    };
  }
}

function upsert<T extends { id: string }>(rows: T[], record: T): void {
  const position = rows.findIndex((row) => row.id === record.id);
  if (position === -1) rows.push(record);
  else rows[position] = record;
}
