import { auth as googleAuth, sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";

import type { BillboardRepository, BillboardSetupResult } from "@/lib/billboards/data/repository";
import {
  ACTIVITY_TABLE,
  BILLBOARDS_TABLE,
  BILLBOARD_TABLES,
  CAMPAIGNS_TABLE,
  FILES_TABLE,
  MAINTENANCE_TABLE,
  indexHeader,
  missingHeaders,
  readRow,
  writeRow,
  type TableSpec,
} from "@/lib/billboards/data/sheet-tables";
import type {
  ActivityEntry,
  Billboard,
  BillboardData,
  BillboardFile,
  Campaign,
  MaintenanceRecord,
} from "@/lib/billboards/types";
import type { BillboardSheetConfig } from "@/lib/config/env";
import { describeGoogleError } from "@/lib/data/google-sheets-repository";
import { RepositoryError, type RepositoryHealth } from "@/lib/data/repository";
import { columnLetter } from "@/lib/data/sheet-schema";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * System state lives on its own hidden tab, created the first time something
 * is saved. It is not part of the batched read, so a sheet prepared before the
 * tab existed keeps working.
 */
const SETTINGS_TAB = "Tracker Settings";

interface TabValues {
  header: unknown[];
  rows: unknown[][];
}

interface Book {
  at: number;
  data: BillboardData;
  tabs: Record<string, TabValues>;
}

/**
 * The billboard tracker's Google Sheet: its own spreadsheet, one tab per
 * record type. Every tab is read in one request; writes touch only the row
 * they change and clear the short read cache.
 */
export class GoogleSheetsBillboardRepository implements BillboardRepository {
  readonly kind = "google-sheets" as const;
  readonly label = "Billboard Google Sheet";

  private client: sheets_v4.Sheets | null = null;
  private book: Book | null = null;
  private inflight: Promise<Book> | null = null;

  constructor(private readonly config: BillboardSheetConfig) {}

  private api(): sheets_v4.Sheets {
    if (!this.client) {
      const jwt = new googleAuth.JWT({
        email: this.config.clientEmail,
        key: this.config.privateKey,
        scopes: SCOPES,
      });
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

  private async load(fresh: boolean): Promise<Book> {
    const age = this.book ? Date.now() - this.book.at : Infinity;
    if (!fresh && this.book && age < this.config.cacheSeconds * 1000) return this.book;
    if (!fresh && this.inflight) return this.inflight;

    const load = this.fetchBook()
      .then((book) => (this.book = book))
      .finally(() => {
        this.inflight = null;
      });
    this.inflight = load;
    return load;
  }

  private async fetchBook(): Promise<Book> {
    let response;
    try {
      response = await this.api().spreadsheets.values.batchGet({
        spreadsheetId: this.config.spreadsheetId,
        ranges: BILLBOARD_TABLES.map((spec) => this.range(spec.tab)),
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
    } catch (error) {
      // A missing tab makes the whole batch fail with a range error.
      if (/Unable to parse range/i.test(String((error as Error).message))) {
        throw new RepositoryError(
          "The billboard spreadsheet has not been prepared yet — its tabs are missing. A billboard administrator can prepare it from this page.",
          { cause: error },
        );
      }
      throw new RepositoryError(describeGoogleError(error), { cause: error });
    }

    const tabs: Record<string, TabValues> = {};
    BILLBOARD_TABLES.forEach((spec, position) => {
      const [header = [], ...rows] = (response.data.valueRanges?.[position]?.values ?? []) as unknown[][];
      tabs[spec.tab] = { header, rows };
    });

    const records = <T,>(spec: TableSpec<T>): T[] => {
      const { header, rows } = tabs[spec.tab];
      const index = indexHeader(spec, header);
      return rows.map((row) => readRow(spec, index, row)).filter((record): record is T => record !== null);
    };

    return {
      at: Date.now(),
      tabs,
      data: {
        billboards: records(BILLBOARDS_TABLE),
        campaigns: records(CAMPAIGNS_TABLE),
        maintenance: records(MAINTENANCE_TABLE),
        files: records(FILES_TABLE),
        activity: records(ACTIVITY_TABLE),
      },
    };
  }

  async readAll(fresh = false): Promise<BillboardData> {
    return (await this.load(fresh)).data;
  }

  /** Replaces the row with the same id, or appends one. Reads fresh first. */
  private async upsert<T extends { id: string }>(spec: TableSpec<T>, record: T): Promise<void> {
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

  private async append<T>(spec: TableSpec<T>, records: T[]): Promise<void> {
    if (!records.length) return;
    const { header } = (await this.load(false)).tabs[spec.tab];
    const index = indexHeader(spec, header);
    await this.appendValues(
      spec.tab,
      records.map((record) => writeRow(spec, index, record, header.length)),
    );
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

  saveBillboard(billboard: Billboard): Promise<void> {
    return this.upsert(BILLBOARDS_TABLE, billboard);
  }

  addCampaign(campaign: Campaign): Promise<void> {
    return this.append(CAMPAIGNS_TABLE, [campaign]);
  }

  addMaintenance(record: MaintenanceRecord): Promise<void> {
    return this.append(MAINTENANCE_TABLE, [record]);
  }

  saveFile(file: BillboardFile): Promise<void> {
    return this.upsert(FILES_TABLE, file);
  }

  appendActivity(entries: ActivityEntry[]): Promise<void> {
    return this.append(ACTIVITY_TABLE, entries);
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
    const rows = await this.settingRows();
    const value = rows?.find((row) => row[0] === key)?.[1];
    return value ? String(value) : null;
  }

  async saveSetting(key: string, value: string | null): Promise<void> {
    let rows = await this.settingRows();
    if (rows === null) {
      if (value === null) return;
      await this.call(() =>
        this.api().spreadsheets.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: SETTINGS_TAB, hidden: true } } }],
          },
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
    // RAW: the stored values are never interpreted as formulas or dates.
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

  async appendAll(data: BillboardData): Promise<void> {
    // Sequential, one call per tab, to stay well inside the Sheets write quota.
    await this.append(BILLBOARDS_TABLE, data.billboards);
    await this.append(CAMPAIGNS_TABLE, data.campaigns);
    await this.append(MAINTENANCE_TABLE, data.maintenance);
    await this.append(FILES_TABLE, data.files);
    await this.append(ACTIVITY_TABLE, data.activity);
  }

  async healthCheck(): Promise<RepositoryHealth> {
    try {
      const info = await this.call(() =>
        this.api().spreadsheets.get({
          spreadsheetId: this.config.spreadsheetId,
          fields: "properties.title,sheets.properties.title",
        }),
      );
      const title = info.data.properties?.title ?? "Untitled spreadsheet";
      const tabs = (info.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? "");
      const missingTabs = BILLBOARD_TABLES.filter((spec) => !tabs.includes(spec.tab)).map((spec) => spec.tab);
      if (missingTabs.length) {
        return {
          ok: false,
          detail: `Connected to “${title}”`,
          warnings: [`Missing tabs: ${missingTabs.join(", ")}. Press “Prepare the billboard sheet”.`],
        };
      }

      const book = await this.load(false);
      const warnings = BILLBOARD_TABLES.flatMap((spec) => {
        const missing = missingHeaders(spec, book.tabs[spec.tab].header);
        return missing.length ? [`${spec.tab} tab is missing: ${missing.join(", ")}.`] : [];
      });
      return {
        ok: true,
        detail: `Connected to “${title}” — ${book.data.billboards.length} billboards`,
        warnings,
      };
    } catch (error) {
      return { ok: false, detail: (error as Error).message, warnings: [] };
    }
  }

  /** Adds any missing tab, heading, dropdown and date format. Never touches values. */
  async setUpStorage(): Promise<BillboardSetupResult> {
    const messages: string[] = [];
    const client = this.api();
    const spreadsheetId = this.config.spreadsheetId;

    await this.call(async () => {
      const before = await client.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
      const existing = (before.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? "");
      const missingTabs = BILLBOARD_TABLES.map((spec) => spec.tab).filter((tab) => !existing.includes(tab));
      if (missingTabs.length) {
        await client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })) },
        });
        messages.push(`Created the ${missingTabs.join(", ")} tab${missingTabs.length > 1 ? "s" : ""}.`);
      }

      const after = await client.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties(sheetId,title)",
      });
      const sheetIdOf = (tab: string) =>
        (after.data.sheets ?? []).find((sheet) => sheet.properties?.title === tab)?.properties?.sheetId ?? 0;

      const headers = await client.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: BILLBOARD_TABLES.map((spec) => this.range(spec.tab, "!1:1")),
      });

      const requests: sheets_v4.Schema$Request[] = [];
      for (const [position, spec] of BILLBOARD_TABLES.entries()) {
        const header = (headers.data.valueRanges?.[position]?.values?.[0] ?? []) as string[];
        const missing = missingHeaders(spec, header);
        const full = [...header, ...missing];
        if (missing.length) {
          await client.spreadsheets.values.update({
            spreadsheetId,
            range: this.range(spec.tab, `!${columnLetter(header.length)}1`),
            valueInputOption: "RAW",
            requestBody: { values: [missing] },
          });
          messages.push(`Added ${missing.length} heading(s) to the ${spec.tab} tab.`);
        }

        const sheetId = sheetIdOf(spec.tab);
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

        const index = indexHeader(spec, full);
        for (const column of spec.columns) {
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
    if (!messages.length) messages.push("The billboard sheet was already set up correctly.");
    return { ok: true, messages };
  }
}
