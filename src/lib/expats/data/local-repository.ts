import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isServerless } from "@/lib/config/env";
import { RepositoryError, type RepositoryHealth } from "@/lib/data/repository";
import { todayIn } from "@/lib/date/dates";
import {
  EMPTY_EXPAT_DATA,
  type ExpatRecord,
  type ExpatRepository,
  type ExpatTable,
} from "@/lib/expats/data/repository";
import { buildSeedExpats } from "@/lib/expats/data/seed";
import { EXPAT_TABLE_NAMES } from "@/lib/expats/data/sheet-tables";
import type { ExpatData } from "@/lib/expats/types";

interface LocalExpatStore extends ExpatData {
  version: 1;
  settings?: Record<string, string>;
}

/**
 * File-backed expat store for development and demos, seeded with a sample
 * register on first use. Writes are serialised, and a read-only filesystem
 * falls back to memory.
 */
export class LocalExpatRepository implements ExpatRepository {
  readonly kind = "local" as const;
  readonly label = "Local sample file";

  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private memory: LocalExpatStore | null = null;
  private readOnly = isServerless();

  constructor(filePath: string, private readonly timezone: string) {
    this.file = path.isAbsolute(filePath)
      ? filePath
      : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
  }

  private seed(): LocalExpatStore {
    return { version: 1, ...buildSeedExpats(todayIn(this.timezone)) };
  }

  private async read(): Promise<LocalExpatStore> {
    if (this.memory) return this.memory;
    if (this.readOnly) {
      this.memory = this.seed();
      return this.memory;
    }
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Partial<LocalExpatStore>;
      const store: LocalExpatStore = { version: 1, ...EMPTY_EXPAT_DATA, settings: parsed.settings ?? {} };
      for (const name of EXPAT_TABLE_NAMES) (store[name] as unknown[]) = (parsed[name] as unknown[]) ?? [];
      return store;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const store = this.seed();
        await this.write(store);
        return this.memory ?? store;
      }
      throw new RepositoryError(`The sample expat data could not be opened: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  private async write(store: LocalExpatStore): Promise<void> {
    if (this.readOnly) {
      this.memory = store;
      return;
    }
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    } catch (error) {
      console.warn("Sample expat data could not be saved, continuing in memory:", (error as Error).message);
      this.readOnly = true;
      this.memory = store;
    }
  }

  private mutate(operation: (store: LocalExpatStore) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const store = await this.read();
      operation(store);
      await this.write(store);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async readAll(): Promise<ExpatData> {
    const { version, settings, ...data } = await this.read();
    void version;
    void settings;
    return structuredClone(data);
  }

  save<K extends ExpatTable>(table: K, record: ExpatRecord<K>): Promise<void> {
    return this.mutate((store) => {
      const rows = store[table] as { id: string }[];
      const position = rows.findIndex((row) => row.id === (record as { id: string }).id);
      if (position === -1) rows.push(record as { id: string });
      else rows[position] = record as { id: string };
    });
  }

  append<K extends ExpatTable>(table: K, records: ExpatRecord<K>[]): Promise<void> {
    return this.mutate((store) => void (store[table] as unknown[]).push(...records));
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

  async healthCheck(): Promise<RepositoryHealth> {
    const { expats, dependants } = await this.read();
    return {
      ok: true,
      detail: `Sample data — ${expats.length} expats and ${dependants.length} dependants`,
      warnings: this.readOnly ? ["Changes are kept in memory only and will be lost when the server restarts."] : [],
    };
  }

  async setUpStorage(): Promise<{ ok: boolean; messages: string[] }> {
    return {
      ok: false,
      messages: [
        "There is no expat spreadsheet to set up yet. Ask your system administrator to set GOOGLE_EXPATS_SHEET_ID first.",
      ],
    };
  }
}
