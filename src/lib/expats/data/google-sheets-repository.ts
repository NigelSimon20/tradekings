import type { BillboardSheetConfig } from "@/lib/config/env";
import type { RepositoryHealth } from "@/lib/data/repository";
import { SheetBook } from "@/lib/data/sheet-book";
import type { ExpatRecord, ExpatRepository, ExpatTable } from "@/lib/expats/data/repository";
import { EXPAT_TABLE_NAMES, EXPAT_TABLES, tableFor } from "@/lib/expats/data/sheet-tables";
import type { ExpatData } from "@/lib/expats/types";

/** The expat spreadsheet: its own Google Sheet, one tab per record type. */
export class GoogleSheetsExpatRepository implements ExpatRepository {
  readonly kind = "google-sheets" as const;
  readonly label = "Expat Google Sheet";
  private readonly book: SheetBook;

  constructor(config: BillboardSheetConfig) {
    this.book = new SheetBook(config, Object.values(EXPAT_TABLES));
  }

  async readAll(fresh = false): Promise<ExpatData> {
    if (fresh) await this.book.refresh();
    const tables = await Promise.all(EXPAT_TABLE_NAMES.map((name) => this.book.records(tableFor(name))));
    return Object.fromEntries(EXPAT_TABLE_NAMES.map((name, position) => [name, tables[position]])) as unknown as ExpatData;
  }

  save<K extends ExpatTable>(table: K, record: ExpatRecord<K>): Promise<void> {
    return this.book.upsert(tableFor(table), record);
  }

  append<K extends ExpatTable>(table: K, records: ExpatRecord<K>[]): Promise<void> {
    return this.book.append(tableFor(table), records);
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
          warnings: [`Missing tabs: ${missingTabs.join(", ")}. Press “Prepare the expat sheet”.`],
        };
      }
      const { expats, dependants } = await this.readAll();
      return {
        ok: true,
        detail: `Connected to “${title}” — ${expats.length} expats and ${dependants.length} dependants`,
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
