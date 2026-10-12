import type { BillboardSheetConfig } from "@/lib/config/env";
import type { RepositoryHealth } from "@/lib/data/repository";
import {
  storeLabel,
  type DataSet,
  tableNames,
  type RecordStore,
  type RecordStoreInfo,
  type RowOf,
} from "@/lib/data/record-store";
import { SheetBook } from "@/lib/data/sheet-book";
import type { TableSpec } from "@/lib/data/table-spec";

/** A tracker's own Google Sheet, one tab per record list, read and written through `SheetBook`. */
export class GoogleSheetsRecordStore<D extends DataSet<D>> implements RecordStore<D> {
  readonly kind = "google-sheets" as const;
  readonly label: string;
  private readonly book: SheetBook;

  constructor(
    config: BillboardSheetConfig,
    private readonly info: RecordStoreInfo<D>,
  ) {
    this.label = storeLabel(info);
    this.book = new SheetBook(config, Object.values(info.tables) as TableSpec<unknown>[]);
  }

  private spec<K extends keyof D & string>(table: K) {
    return this.info.tables[table] as TableSpec<RowOf<D, K> & { id: string }>;
  }

  async readAll(fresh = false): Promise<D> {
    if (fresh) await this.book.refresh();
    const names = tableNames(this.info);
    const lists = await Promise.all(names.map((name) => this.book.records(this.spec(name))));
    return Object.fromEntries(names.map((name, position) => [name, lists[position]])) as unknown as D;
  }

  save<K extends keyof D & string>(table: K, record: RowOf<D, K>): Promise<void> {
    return this.book.upsert(this.spec(table), record as RowOf<D, K> & { id: string });
  }

  append<K extends keyof D & string>(table: K, records: RowOf<D, K>[]): Promise<void> {
    return this.book.append(this.spec(table), records as (RowOf<D, K> & { id: string })[]);
  }

  async appendAll(data: D): Promise<void> {
    // One tab at a time, to stay well inside the Sheets write quota.
    for (const name of tableNames(this.info)) await this.append(name, [...data[name]]);
  }

  readSetting(key: string): Promise<string | null> {
    return this.book.readSetting(key);
  }

  saveSetting(key: string, value: string | null): Promise<void> {
    return this.book.saveSetting(key, value);
  }

  async healthCheck(): Promise<RepositoryHealth> {
    try {
      const { title, missingTabs, missingHeadings } = await this.book.inspect();
      if (missingTabs.length) {
        return {
          ok: false,
          detail: `Connected to “${title}”`,
          warnings: [`Missing tabs: ${missingTabs.join(", ")}. Press “Prepare the ${this.info.name} sheet”.`],
        };
      }
      return {
        ok: true,
        detail: `Connected to “${title}” — ${this.info.summary(await this.readAll())}`,
        warnings: missingHeadings,
      };
    } catch (error) {
      return { ok: false, detail: (error as Error).message, warnings: [] };
    }
  }

  async setUpStorage(): Promise<{ ok: boolean; messages: string[] }> {
    return { ok: true, messages: await this.book.setUp() };
  }
}
