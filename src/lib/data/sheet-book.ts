import { auth as googleAuth, sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";

import { describeGoogleError } from "@/lib/data/google-sheets-repository";
import { RepositoryError } from "@/lib/data/repository";
import { columnLetter } from "@/lib/data/sheet-schema";
import { indexHeader, missingHeaders, readRow, writeRow, type Kind, type TableSpec } from "@/lib/data/table-spec";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/** System state (e.g. a sealed Drive connection) lives on its own hidden tab. */
const SETTINGS_TAB = "Tracker Settings";

export interface SheetBookConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
  cacheSeconds: number;
}

/** Just the shape of a table this class needs, whatever record type it holds. */
interface AnyTable {
  tab: string;
  columns: readonly { key: string; header: string; kind: Kind; options?: readonly string[]; width?: number }[];
}

interface TabValues {
  header: unknown[];
  rows: unknown[][];
}

/**
 * A Google Sheet holding one tab per record type, as an app's database. Every
 * tab is read in one request and briefly cached; writes touch only the rows
 * they change and clear the cache. `setUp` creates whatever tab, heading,
 * dropdown and date format is missing — never changing a value.
 */
export class SheetBook {
  private client: sheets_v4.Sheets | null = null;
  private book: { at: number; tabs: Record<string, TabValues> } | null = null;
  private inflight: Promise<{ at: number; tabs: Record<string, TabValues> }> | null = null;

  constructor(
    private readonly config: SheetBookConfig,
    private readonly tables: readonly AnyTable[],
  ) {}

  private api(): sheets_v4.Sheets {
    if (!this.client) {
      const jwt = new googleAuth.JWT({ email: this.config.clientEmail, key: this.config.privateKey, scopes: SCOPES });
      this.client = sheetsApi({ version: "v4", auth: jwt });
    }
    return this.client;
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError(describeGoogleError(error), { cause: error });
    }
  }

  private range(tab: string, suffix = ""): string {
    return `'${tab.replace(/'/g, "''")}'${suffix}`;
  }

  private async load(fresh: boolean) {
    const age = this.book ? Date.now() - this.book.at : Infinity;
    if (!fresh && this.book && age < this.config.cacheSeconds * 1000) return this.book;
    if (!fresh && this.inflight) return this.inflight;

    const load = this.fetchAll()
      .then((book) => (this.book = book))
      .finally(() => {
        this.inflight = null;
      });
    this.inflight = load;
    return load;
  }

  private async fetchAll() {
    let response;
    try {
      response = await this.api().spreadsheets.values.batchGet({
        spreadsheetId: this.config.spreadsheetId,
        ranges: this.tables.map((table) => this.range(table.tab)),
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
    } catch (error) {
      // A missing tab makes the whole batch fail with a range error.
      if (/Unable to parse range/i.test(String((error as Error).message))) {
        throw new RepositoryError(
          "The spreadsheet has not been prepared yet — its tabs are missing. An administrator can prepare it from Setup & access.",
          { cause: error },
        );
      }
      throw new RepositoryError(describeGoogleError(error), { cause: error });
    }
    const tabs: Record<string, TabValues> = {};
    this.tables.forEach((table, position) => {
      const [header = [], ...rows] = (response.data.valueRanges?.[position]?.values ?? []) as unknown[][];
      tabs[table.tab] = { header, rows };
    });
    return { at: Date.now(), tabs };
  }

  /** Every record on one tab (rows without an id are skipped). */
  async records<T>(spec: TableSpec<T>, fresh = false): Promise<T[]> {
    const { header, rows } = (await this.load(fresh)).tabs[spec.tab];
    const index = indexHeader(spec, header);
    return rows.map((row) => readRow(spec, index, row)).filter((record): record is T => record !== null);
  }

  /** Re-reads every tab at once; later `records` calls are served from it. */
  async refresh(): Promise<void> {
    await this.load(true);
  }

  /** Replaces the row with the same id, or appends one. Reads fresh first. */
  async upsert<T extends { id: string }>(spec: TableSpec<T>, record: T): Promise<void> {
    const { header, rows } = (await this.load(true)).tabs[spec.tab];
    const index = indexHeader(spec, header);
    const position = rows.findIndex((row) => readRow(spec, index, row)?.id === record.id);
    const values = [writeRow(spec, index, record, header.length)];
    if (position === -1) {
      await this.appendValues(spec.tab, values);
    } else {
      await this.call(() =>
        this.api().spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: this.range(spec.tab, `!A${position + 2}`),
          valueInputOption: "USER_ENTERED",
          requestBody: { values },
        }),
      );
    }
    this.book = null;
  }

  async append<T>(spec: TableSpec<T>, records: T[]): Promise<void> {
    if (!records.length) return;
    const { header } = (await this.load(false)).tabs[spec.tab];
    const index = indexHeader(spec, header);
    await this.appendValues(spec.tab, records.map((record) => writeRow(spec, index, record, header.length)));
    this.book = null;
  }

  private async appendValues(tab: string, values: (string | number | null)[][]): Promise<void> {
    await this.call(() =>
      this.api().spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: this.range(tab, "!A1"),
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      }),
    );
  }

  private async settingRows(): Promise<string[][] | null> {
    try {
      const response = await this.api().spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: this.range(SETTINGS_TAB, "!A:B"),
      });
      return (response.data.values ?? []) as string[][];
    } catch (error) {
      if (/Unable to parse range/i.test(String((error as Error).message))) return null;
      throw new RepositoryError(describeGoogleError(error), { cause: error });
    }
  }

  async readSetting(key: string): Promise<string | null> {
    const value = (await this.settingRows())?.find((row) => row[0] === key)?.[1];
    return value ? String(value) : null;
  }

  async saveSetting(key: string, value: string | null): Promise<void> {
    let rows = await this.settingRows();
    if (rows === null) {
      if (value === null) return;
      await this.call(() =>
        this.api().spreadsheets.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: SETTINGS_TAB, hidden: true } } }] },
        }),
      );
      rows = [["Setting", "Value — written by the tracker, do not edit"]];
      await this.call(() =>
        this.api().spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: this.range(SETTINGS_TAB, "!A1"),
          valueInputOption: "RAW",
          requestBody: { values: rows },
        }),
      );
    }
    const position = rows.findIndex((row) => row[0] === key);
    // RAW: stored values are never read as formulas or dates.
    if (position === -1) {
      if (value === null) return;
      await this.call(() =>
        this.api().spreadsheets.values.append({
          spreadsheetId: this.config.spreadsheetId,
          range: this.range(SETTINGS_TAB, "!A1"),
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [[key, value]] },
        }),
      );
    } else {
      await this.call(() =>
        this.api().spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: this.range(SETTINGS_TAB, `!B${position + 1}`),
          valueInputOption: "RAW",
          requestBody: { values: [[value ?? ""]] },
        }),
      );
    }
  }

  /** The spreadsheet's name and anything missing from it. */
  async inspect(): Promise<{ title: string; missingTabs: string[]; missingHeadings: string[] }> {
    const info = await this.call(() =>
      this.api().spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: "properties.title,sheets.properties.title",
      }),
    );
    const title = info.data.properties?.title ?? "Untitled spreadsheet";
    const tabs = (info.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? "");
    const missingTabs = this.tables.filter((table) => !tabs.includes(table.tab)).map((table) => table.tab);
    if (missingTabs.length) return { title, missingTabs, missingHeadings: [] };

    const book = await this.load(false);
    const missingHeadings = this.tables.flatMap((table) => {
      const missing = missingHeaders(table, book.tabs[table.tab].header);
      return missing.length ? [`${table.tab} tab is missing: ${missing.join(", ")}.`] : [];
    });
    return { title, missingTabs, missingHeadings };
  }

  /** Adds any missing tab, heading, dropdown and date format. Never touches values. */
  async setUp(): Promise<string[]> {
    const messages: string[] = [];
    const client = this.api();
    const spreadsheetId = this.config.spreadsheetId;

    await this.call(async () => {
      const before = await client.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
      const existing = (before.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? "");
      const missingTabs = this.tables.map((table) => table.tab).filter((tab) => !existing.includes(tab));
      if (missingTabs.length) {
        await client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })) },
        });
        messages.push(`Created the ${missingTabs.join(", ")} tab${missingTabs.length > 1 ? "s" : ""}.`);
      }

      const after = await client.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
      const sheetIdOf = (tab: string) =>
        (after.data.sheets ?? []).find((sheet) => sheet.properties?.title === tab)?.properties?.sheetId ?? 0;
      const headers = await client.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: this.tables.map((table) => this.range(table.tab, "!1:1")),
      });

      const requests: sheets_v4.Schema$Request[] = [];
      for (const [position, table] of this.tables.entries()) {
        const header = (headers.data.valueRanges?.[position]?.values?.[0] ?? []) as string[];
        const missing = missingHeaders(table, header);
        if (missing.length) {
          await client.spreadsheets.values.update({
            spreadsheetId,
            range: this.range(table.tab, `!${columnLetter(header.length)}1`),
            valueInputOption: "RAW",
            requestBody: { values: [missing] },
          });
          messages.push(`Added ${missing.length} heading(s) to the ${table.tab} tab.`);
        }

        const sheetId = sheetIdOf(table.tab);
        requests.push(
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          },
        );
        const index = indexHeader(table, [...header, ...missing]);
        for (const column of table.columns) {
          const at = index.get(column.key);
          if (at === undefined) continue;
          const range = { sheetId, startColumnIndex: at, endColumnIndex: at + 1, startRowIndex: 1 };
          if (column.width) {
            requests.push({
              updateDimensionProperties: {
                range: { sheetId, dimension: "COLUMNS", startIndex: at, endIndex: at + 1 },
                properties: { pixelSize: column.width },
                fields: "pixelSize",
              },
            });
          }
          if (column.kind === "date") {
            requests.push({
              repeatCell: {
                range,
                cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd mmm yyyy" } } },
                fields: "userEnteredFormat.numberFormat",
              },
            });
          }
          if (column.options) {
            requests.push({
              setDataValidation: {
                range: { ...range, endRowIndex: 5000 },
                rule: {
                  condition: {
                    type: "ONE_OF_LIST",
                    values: column.options.map((option) => ({ userEnteredValue: option })),
                  },
                  showCustomUi: true,
                  strict: false,
                },
              },
            });
          }
        }
      }
      await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    });

    this.book = null;
    return messages.length ? messages : ["The sheet was already set up correctly."];
  }
}
