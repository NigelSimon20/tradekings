import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isServerless } from "@/lib/config/env";
import {
  emptyData,
  tableNames,
  type DataSet,
  type RecordStore,
  type RecordStoreInfo,
  type RowOf,
} from "@/lib/data/record-store";
import { RepositoryError, type RepositoryHealth } from "@/lib/data/repository";

type Stored<D extends DataSet<D>> = D & { version: 1; settings?: Record<string, string> };

/**
 * A tracker's data in a local JSON file, for development and demos: seeded
 * with a sample data set on first use. Writes are serialised, and a read-only
 * filesystem (hosting) falls back to memory.
 */
export class LocalRecordStore<D extends DataSet<D>> implements RecordStore<D> {
  readonly kind = "local" as const;
  readonly label = "Local sample file";

  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private memory: Stored<D> | null = null;
  private readOnly = isServerless();

  constructor(
    filePath: string,
    private readonly info: RecordStoreInfo<D>,
    private readonly seed: () => D,
  ) {
    this.file = path.isAbsolute(filePath) ? filePath : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
  }

  private seeded(): Stored<D> {
    return { version: 1, ...this.seed() };
  }

  private async read(): Promise<Stored<D>> {
    if (this.memory) return this.memory;
    if (this.readOnly) {
      this.memory = this.seeded();
      return this.memory;
    }
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Partial<Stored<D>>;
      // A list added since the file was written starts empty.
      const store = { version: 1, ...emptyData(this.info), settings: parsed.settings ?? {} } as Stored<D>;
      const lists = store as unknown as Record<string, unknown[]>;
      for (const name of tableNames(this.info)) {
        const saved = (parsed as Record<string, unknown>)[name];
        if (Array.isArray(saved)) lists[name] = saved;
      }
      return store;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const store = this.seeded();
        await this.write(store);
        return this.memory ?? store;
      }
      throw new RepositoryError(`The sample ${this.info.name} data could not be opened: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  private async write(store: Stored<D>): Promise<void> {
    if (this.readOnly) {
      this.memory = store;
      return;
    }
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    } catch (error) {
      console.warn(`Sample ${this.info.name} data could not be saved, continuing in memory:`, (error as Error).message);
      this.readOnly = true;
      this.memory = store;
    }
  }

  private mutate(operation: (store: Stored<D>) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const store = await this.read();
      operation(store);
      await this.write(store);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private list(store: Stored<D>, table: keyof D & string): { id: string }[] {
    return store[table] as unknown as { id: string }[];
  }

  async readAll(): Promise<D> {
    const store = await this.read();
    // A copy, so a caller can never change the store by accident.
    return structuredClone(Object.fromEntries(tableNames(this.info).map((name) => [name, store[name]])) as unknown as D);
  }

  save<K extends keyof D & string>(table: K, record: RowOf<D, K>): Promise<void> {
    return this.mutate((store) => {
      const rows = this.list(store, table);
      const row = record as { id: string };
      const position = rows.findIndex((existing) => existing.id === row.id);
      if (position === -1) rows.push(row);
      else rows[position] = row;
    });
  }

  append<K extends keyof D & string>(table: K, records: RowOf<D, K>[]): Promise<void> {
    return this.mutate((store) => void this.list(store, table).push(...(records as { id: string }[])));
  }

  appendAll(data: D): Promise<void> {
    return this.mutate((store) => {
      for (const name of tableNames(this.info)) this.list(store, name).push(...(data[name] as readonly { id: string }[]));
    });
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
    const store = await this.read();
    return {
      ok: true,
      detail: `Sample data — ${this.info.summary(store)}`,
      warnings: this.readOnly ? ["Changes are kept in memory only and will be lost when the server restarts."] : [],
    };
  }

  async setUpStorage(): Promise<{ ok: boolean; messages: string[] }> {
    return {
      ok: false,
      messages: [
        `There is no ${this.info.name} spreadsheet to set up yet. Ask your system administrator to set ${this.info.sheetSetting} first.`,
      ],
    };
  }
}
