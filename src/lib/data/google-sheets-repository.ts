import { auth as googleAuth, sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";

import type { GoogleConfig } from "@/lib/config/env";
import {
  CALCULATED_COLUMNS,
  CONTRACT_COLUMNS,
  INPUT_COLUMNS,
  RUN_LOG_HEADERS,
  settingKeyFor,
  buildColumnIndex,
  calculatedCellValues,
  columnLetter,
  inputCellValue,
  isBlankRow,
  neutraliseFormula,
  parseUserRows,
  BILLBOARD_ROLES_TAB,
  CONTRACT_ROLES_TAB,
  missingColumns,
  parseContractRow,
  type ColumnKey,
} from "@/lib/data/sheet-schema";
import { setUpSheet, type SheetSetupResult } from "@/lib/data/sheet-setup";
import {
  BILLBOARD_PERMISSION_INFO,
  DEFAULT_ROLE_TABLE,
  PERMISSION_INFO,
  parseRoleTab,
  type RoleTable,
} from "@/lib/auth/roles";
import {
  RepositoryError,
  stampNewContract,
  type ContractRepository,
  type RepositoryHealth,
} from "@/lib/data/repository";
import type { SheetUser } from "@/lib/data/sheet-schema";
import type {
  Contract,
  ContractInput,
  DashboardSummary,
  EvaluatedContract,
  RunLogEntry,
} from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/date/dates";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/** How far past the cache window stale data may still be served while it refreshes. */
const STALE_LIMIT_MS = 5 * 60 * 1000;

interface Workbook {
  at: number;
  header: unknown[];
  contracts: Contract[];
  settings: Record<string, string>;
  users: SheetUser[];
  /** Why the users spreadsheet could not be read, when it is a separate one. */
  usersError: string | null;
  roleTable: RoleTable;
  runLog: RunLogEntry[];
}

interface SheetSnapshot {
  header: unknown[];
  index: Map<ColumnKey, number>;
  rows: unknown[][];
}

/** Reads and writes the Google Sheet that is the system's source of truth. */
export class GoogleSheetsRepository implements ContractRepository {
  readonly kind = "google-sheets" as const;
  readonly label = "Google Sheet";

  private client: sheets_v4.Sheets | null = null;
  /**
   * Reading the sheet is a network round trip, and a single page can be
   * rendered many times a minute. Rows are held for a few seconds so browsing
   * feels instant; every write drops the cache, so nothing the tracker changes
   * is ever served stale.
   */
  /**
   * Every tab the app reads, fetched together.
   *
   * Each call to Google is a round trip of roughly a second from Zimbabwe, and
   * a single page needs the contracts, the settings, the user list and the run
   * log. Asking for all four in one request turns four seconds of waiting into
   * one. `inflight` means several components rendering at once share a single
   * request rather than starting four identical ones.
   */
  private workbook: Workbook | null = null;
  /** Where "Last Signed In" is on the Users tab, found from its heading. */
  private signInColumn = 4;
  private inflight: Promise<Workbook> | null = null;
  /** The spreadsheet's name and tab list, which change about once a year. */
  private spreadsheetInfo: { at: number; title: string; tabs: string[] } | null = null;

  constructor(private readonly config: GoogleConfig) {}

  private get cacheTtlMs(): number {
    return this.config.cacheSeconds * 1000;
  }

  private invalidate(): void {
    this.workbook = null;
  }

  /** True when the Users tab lives in its own spreadsheet, as it should. */
  private get usersSeparate(): boolean {
    return this.config.usersSpreadsheetId !== this.config.spreadsheetId;
  }

  /** Reads every tab in one request, coalescing concurrent callers. */
  private async readWorkbook(fresh = false): Promise<Workbook> {
    const age = this.workbook ? Date.now() - this.workbook.at : Infinity;

    if (!fresh && this.workbook && age < this.cacheTtlMs) return this.workbook;
    if (!fresh && this.inflight) return this.inflight;

    const load = this.fetchWorkbook()
      .then((workbook) => {
        this.workbook = workbook;
        return workbook;
      })
      .finally(() => {
        this.inflight = null;
      });

    this.inflight = load;

    // Something a little stale beats making someone wait: the page renders
    // from what we have while the refresh happens behind it.
    if (!fresh && this.workbook && age < STALE_LIMIT_MS) {
      load.catch(() => undefined);
      return this.workbook;
    }

    return load;
  }

  private async fetchWorkbook(): Promise<Workbook> {
    const { contractsSheet, settingsSheet, usersSheet, runLogSheet } = this.config;
    const separate = this.usersSeparate;
    const tabs = [contractsSheet, settingsSheet, runLogSheet, ...(separate ? [] : [usersSheet])];

    // A separate users spreadsheet is read alongside, not after, so it costs no
    // extra waiting. If it cannot be read the tracker still works and only the
    // ADMIN_EMAILS addresses can sign in.
    // The roles tabs sit next to Users. Read alongside; a missing tab means
    // "use the built-in roles", never an error.
    const rolesRead = Promise.all(
      [CONTRACT_ROLES_TAB, BILLBOARD_ROLES_TAB].map((tab) =>
        this.api()
          .spreadsheets.values.get({
            spreadsheetId: this.config.usersSpreadsheetId,
            range: this.tabRange(tab),
            valueRenderOption: "UNFORMATTED_VALUE",
          })
          .then(
            (result) => (result.data.values ?? []) as unknown[][],
            () => null,
          ),
      ),
    );

    const [response, separateUsers] = await Promise.all([
      this.call(() =>
        this.api().spreadsheets.values.batchGet({
          spreadsheetId: this.config.spreadsheetId,
          ranges: tabs.map((tab) => this.tabRange(tab)),
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "SERIAL_NUMBER",
        }),
      ),
      separate
        ? this.call(() =>
            this.api().spreadsheets.values.get({
              spreadsheetId: this.config.usersSpreadsheetId,
              range: this.tabRange(usersSheet),
              valueRenderOption: "UNFORMATTED_VALUE",
            }),
          ).then(
            (users) => ({ rows: (users.data.values ?? []) as unknown[][], error: null }),
            (error: Error) => ({ rows: [] as unknown[][], error: error.message }),
          )
        : null,
    ]);

    const ranges = response.data.valueRanges ?? [];
    const [contractRoles, billboardRoles] = await rolesRead;
    const values = (position: number) => (ranges[position]?.values ?? []) as unknown[][];

    const contractValues = values(0);
    if (!contractValues.length) {
      throw new RepositoryError(
        `The "${contractsSheet}" tab in the Google Sheet has no headings yet. Ask your system administrator to finish setting the sheet up.`,
      );
    }

    const [header, ...rows] = contractValues;
    const index = buildColumnIndex(header);

    const contracts: Contract[] = [];
    rows.forEach((row, offset) => {
      if (isBlankRow(row)) return;
      contracts.push(parseContractRow(row, index, offset + 2));
    });

    const settings: Record<string, string> = {};
    for (const row of values(1)) {
      const key = settingKeyFor(String(row?.[0] ?? ""));
      const value = String(row?.[1] ?? "").trim();
      if (key && value) settings[key] = value;
    }

    const roleTable: RoleTable = {
      contracts: parseRoleTab(contractRoles, PERMISSION_INFO) ?? DEFAULT_ROLE_TABLE.contracts,
      billboards: parseRoleTab(billboardRoles, BILLBOARD_PERMISSION_INFO) ?? DEFAULT_ROLE_TABLE.billboards,
    };
    const { users, index: usersIndex } = parseUserRows(separateUsers ? separateUsers.rows : values(3));
    this.signInColumn = usersIndex.lastSignedIn;

    const runLog = values(2)
      .slice(1)
      .filter((row) => !isBlankRow(row))
      .map((row, position) => ({
        id: `RUN-${position + 2}`,
        runAt: String(row[0] ?? ""),
        type: String(row[1] ?? "system-check") as RunLogEntry["type"],
        trigger: String(row[2] ?? "manual") as RunLogEntry["trigger"],
        mode: String(row[3] ?? "send") as RunLogEntry["mode"],
        recipients: Number(row[4] ?? 0) || 0,
        emailsSent: Number(row[5] ?? 0) || 0,
        rowsChecked: Number(row[6] ?? 0) || 0,
        needsAction: Number(row[7] ?? 0) || 0,
        errors: String(row[8] ?? "").split(" | ").filter(Boolean),
        note: String(row[9] ?? ""),
      }))
      .reverse();

    return {
      at: Date.now(),
      header,
      contracts,
      settings,
      users,
      usersError: separateUsers?.error ?? null,
      roleTable,
      runLog,
    };
  }

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

  /** A1 range for a whole tab, with the quoting Sheets expects. */
  private tabRange(sheetName: string, suffix = ""): string {
    return `'${sheetName.replace(/'/g, "''")}'${suffix}`;
  }

  private async readSheet(): Promise<SheetSnapshot> {
    const response = await this.call(() =>
      this.api().spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: this.tabRange(this.config.contractsSheet),
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      }),
    );

    const values = (response.data.values ?? []) as unknown[][];
    if (!values.length) {
      throw new RepositoryError(
        `The "${this.config.contractsSheet}" tab is empty. Run "npm run sheet:setup" to create the headers.`,
      );
    }

    const [header, ...rows] = values;
    return { header, index: buildColumnIndex(header), rows };
  }

  async listContracts(fresh = false): Promise<Contract[]> {
    return (await this.readWorkbook(fresh)).contracts;
  }

  async createContract(input: ContractInput): Promise<Contract> {
    const [created] = await this.createContracts([input]);
    return created;
  }

  async createContracts(inputs: ContractInput[]): Promise<Contract[]> {
    if (!inputs.length) return [];

    this.invalidate();
    const { header, index } = await this.readSheet();
    const width = Math.max(header.length, ...[...index.values()].map((position) => position + 1));
    const timestamp = new Date().toISOString();

    const contracts = inputs.map((input) => stampNewContract(input, timestamp));

    const values = contracts.map((contract) => {
      const row: (string | number)[] = new Array(width).fill("");
      for (const column of INPUT_COLUMNS) {
        const position = index.get(column.key);
        if (position === undefined) continue;
        row[position] = neutraliseFormula(
          inputCellValue(contract, column.key as Parameters<typeof inputCellValue>[1]),
        );
      }
      return row;
    });

    // One append call, however many rows: the sheet stays consistent and the
    // import stays inside the API quota.
    const response = await this.call(() =>
      this.api().spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: this.tabRange(this.config.contractsSheet, "!A1"),
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      }),
    );

    this.invalidate();
    const firstRow = Number(/!\D+(\d+)/.exec(response.data.updates?.updatedRange ?? "")?.[1] ?? 0);
    return contracts.map((contract, offset) => ({
      ...contract,
      rowNumber: firstRow ? firstRow + offset : undefined,
    }));
  }

  async updateContract(id: string, patch: Partial<ContractInput>): Promise<Contract> {
    this.invalidate();
    const { index, rows } = await this.readSheet();
    const offset = rows.findIndex((row, position) => {
      if (isBlankRow(row)) return false;
      return parseContractRow(row, index, position + 2).id === id;
    });

    if (offset === -1) throw new RepositoryError(`Contract ${id} was not found in the sheet.`);

    const rowNumber = offset + 2;
    const existing = parseContractRow(rows[offset], index, rowNumber);
    const updated: Contract = {
      ...existing,
      ...patch,
      id: existing.id,
      rowNumber,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: patch.lastUpdatedBy ?? existing.lastUpdatedBy,
    };

    const data: sheets_v4.Schema$ValueRange[] = [];
    for (const column of INPUT_COLUMNS) {
      const position = index.get(column.key);
      if (position === undefined) continue;
      const key = column.key as Parameters<typeof inputCellValue>[1];
      // Only touch cells that actually changed, so the sheet's edit history
      // stays meaningful.
      if (key !== "lastUpdated" && inputCellValue(existing, key) === inputCellValue(updated, key)) {
        continue;
      }
      data.push({
        range: this.tabRange(this.config.contractsSheet, `!${columnLetter(position)}${rowNumber}`),
        values: [[neutraliseFormula(inputCellValue(updated, key))]],
      });
    }

    if (data.length) {
      await this.call(() =>
        this.api().spreadsheets.values.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data },
        }),
      );
    }

    this.invalidate();
    return updated;
  }

  async writeCalculatedColumns(rows: EvaluatedContract[]): Promise<number> {
    const { index } = await this.readSheet();
    const columns = CALCULATED_COLUMNS.map((column) => ({
      key: column.key,
      position: index.get(column.key),
    })).filter((column): column is { key: ColumnKey; position: number } => column.position !== undefined);

    if (!columns.length) return 0;

    const writable = rows
      .filter((row) => typeof row.rowNumber === "number")
      .sort((a, b) => (a.rowNumber ?? 0) - (b.rowNumber ?? 0));
    if (!writable.length) return 0;

    const sorted = [...columns].sort((a, b) => a.position - b.position);
    const first = sorted[0].position;
    const last = sorted[sorted.length - 1].position;
    const contiguous = last - first + 1 === sorted.length;

    const data: sheets_v4.Schema$ValueRange[] = [];

    if (contiguous) {
      // Write one rectangle per run of consecutive rows — far fewer ranges.
      for (const block of consecutiveBlocks(writable)) {
        data.push({
          range: this.tabRange(
            this.config.contractsSheet,
            `!${columnLetter(first)}${block[0].rowNumber}:${columnLetter(last)}${
              block[block.length - 1].rowNumber
            }`,
          ),
          values: block.map((row) => {
            const values = calculatedCellValues(row);
            return sorted.map((column) => neutraliseFormula(values[column.key as keyof typeof values]));
          }),
        });
      }
    } else {
      for (const row of writable) {
        const values = calculatedCellValues(row);
        for (const column of sorted) {
          data.push({
            range: this.tabRange(
              this.config.contractsSheet,
              `!${columnLetter(column.position)}${row.rowNumber}`,
            ),
            values: [[values[column.key as keyof typeof values]]],
          });
        }
      }
    }

    await this.call(() =>
      this.api().spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: { valueInputOption: "RAW", data },
      }),
    );

    return writable.length;
  }

  /**
   * Rewrites the Dashboard tab from the current data — the summary view the
   * specification asks for inside the sheet itself. Each row links back to the
   * matching filtered list in the tracker.
   */
  async writeDashboard(summary: DashboardSummary): Promise<boolean> {
    const sheetName = this.config.dashboardSheet;
    const link = (path: string, label: string) =>
      summary.appUrl ? `=HYPERLINK("${summary.appUrl}${path}","${label}")` : "";

    const values: (string | number)[][] = [
      ["Blue Collar Contract Tracker — Dashboard", "", ""],
      ["Trade Kings Zimbabwe & Zimkings Trading", "", ""],
      ["", "", ""],
      ["As at", formatDate(summary.today), link("", "Open the contract tracker")],
      [
        "Last system check",
        formatDateTime(summary.generatedAt, this.config.timezone),
        link("/reports", "Run a manual report / system check"),
      ],
      ["Employees in the database", summary.employees, ""],
      ["", "", ""],
      ["Summary", "Count", "Open in the tracker"],
      ...summary.rows.map((row) => [
        row.label,
        row.count,
        link(`/contracts?view=${row.viewId}`, "View"),
      ]),
      ["", "", ""],
      ["By company", "Employees", "Requiring attention"],
      ...summary.byCompany.map((row) => [
        `${row.company} — ${row.workerType}`,
        row.total,
        row.needsAction,
      ]),
      ["", "", ""],
      ["This tab is rewritten by the system on every check. Do not edit it by hand.", "", ""],
    ];

    await this.ensureSheet(sheetName);
    await this.call(() =>
      this.api().spreadsheets.values.clear({
        spreadsheetId: this.config.spreadsheetId,
        range: this.tabRange(sheetName),
      }),
    );
    await this.call(() =>
      this.api().spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: this.tabRange(sheetName, "!A1"),
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      }),
    );

    return true;
  }

  /** Settings an administrator has filled in on the Settings tab. */
  async readSettings(): Promise<Record<string, string>> {
    try {
      return (await this.readWorkbook()).settings;
    } catch {
      return {};
    }
  }

  /** Everyone allowed to sign in, from the Users tab of the users spreadsheet. */
  /**
   * Throws when the list cannot be read, rather than answering "nobody": a
   * caller must be able to tell an outage from an empty list, or checking
   * access on every request would sign everyone out whenever Google blinks.
   */
  async listUsers(): Promise<SheetUser[]> {
    const workbook = await this.readWorkbook();
    if (workbook.usersError) throw new RepositoryError(workbook.usersError);
    return workbook.users;
  }

  async readRoleTable(): Promise<RoleTable> {
    const workbook = await this.readWorkbook();
    if (workbook.usersError) throw new RepositoryError(workbook.usersError);
    return workbook.roleTable;
  }

  async recordSignIn(user: SheetUser, at: string): Promise<void> {
    this.invalidate();
    await this.api().spreadsheets.values.update({
      spreadsheetId: this.config.usersSpreadsheetId,
      range: this.tabRange(this.config.usersSheet, `!${columnLetter(this.signInColumn)}${user.rowNumber}`),
      valueInputOption: "RAW",
      requestBody: { values: [[at]] },
    });
  }

  async appendRunLog(entry: RunLogEntry): Promise<void> {
    const row = [
      entry.runAt,
      entry.type,
      entry.trigger,
      entry.mode,
      entry.recipients,
      entry.emailsSent,
      entry.rowsChecked,
      entry.needsAction,
      entry.errors.join(" | "),
      entry.note,
    ];

    try {
      await this.appendRunLogRow(row);
    } catch {
      // The tab may not exist yet on a freshly created spreadsheet.
      await this.ensureRunLogSheet();
      await this.appendRunLogRow(row);
    }
  }

  private async appendRunLogRow(row: (string | number)[]): Promise<void> {
    await this.api().spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: this.tabRange(this.config.runLogSheet, "!A1"),
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }

  private async ensureRunLogSheet(): Promise<void> {
    await this.ensureSheet(this.config.runLogSheet);
    await this.call(() =>
      this.api().spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: this.tabRange(this.config.runLogSheet, "!A1"),
        valueInputOption: "RAW",
        requestBody: { values: [[...RUN_LOG_HEADERS]] },
      }),
    );
  }

  /** Adds a tab when it does not exist yet; existing tabs are left alone. */
  private async ensureSheet(title: string): Promise<void> {
    try {
      await this.api().spreadsheets.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
    } catch {
      // Already there.
    }
  }

  async listRunLog(limit = 20): Promise<RunLogEntry[]> {
    try {
      return (await this.readWorkbook()).runLog.slice(0, limit);
    } catch {
      return [];
    }
  }

  /** Prepares the spreadsheet; safe to run again at any time. */
  async setUpStorage(options: { seedAdmins?: string[] } = {}): Promise<SheetSetupResult> {
    const result = await this.call(() => setUpSheet(this.api(), this.config, options));
    this.invalidate();
    this.spreadsheetInfo = null;
    return result;
  }

  async healthCheck(): Promise<RepositoryHealth> {
    try {
      // The name and tabs barely ever change, so they are not worth a round
      // trip on every visit to the settings page.
      if (!this.spreadsheetInfo || Date.now() - this.spreadsheetInfo.at > this.cacheTtlMs) {
        const response = await this.call(() =>
          this.api().spreadsheets.get({
            spreadsheetId: this.config.spreadsheetId,
            fields: "properties.title,sheets.properties.title",
          }),
        );

        this.spreadsheetInfo = {
          at: Date.now(),
          title: response.data.properties?.title ?? "Untitled spreadsheet",
          tabs: (response.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? ""),
        };
      }

      const { title, tabs } = this.spreadsheetInfo;
      const warnings: string[] = [];

      if (!tabs.includes(this.config.contractsSheet)) {
        warnings.push(`The "${this.config.contractsSheet}" tab does not exist.`);
        return { ok: false, detail: `Connected to "${title}"`, warnings };
      }

      const { header, usersError } = await this.readWorkbook();
      const missing = missingColumns(header);
      if (missing.length) {
        warnings.push(`Missing columns: ${missing.map((column) => column.header).join(", ")}.`);
      }
      for (const tab of [this.config.runLogSheet, this.config.dashboardSheet, this.config.settingsSheet]) {
        if (!tabs.includes(tab)) warnings.push(`The "${tab}" tab will be created on the first run.`);
      }
      warnings.push(...this.usersWarnings(tabs, usersError));

      return {
        ok: true,
        detail: `Connected to “${title}” — ${CONTRACT_COLUMNS.length - missing.length} of ${CONTRACT_COLUMNS.length} columns recognised`,
        warnings,
      };
    } catch (error) {
      return { ok: false, detail: describeGoogleError(error), warnings: [] };
    }
  }

  /** What is wrong with where the list of users is kept, if anything. */
  private usersWarnings(contractTabs: string[], usersError: string | null): string[] {
    const { usersSheet } = this.config;
    if (!this.usersSeparate) {
      return [
        `Who may sign in is kept on the "${usersSheet}" tab of the contracts spreadsheet, so anyone who can edit contracts can also give themselves access. Ask your system administrator to set GOOGLE_USERS_SHEET_ID to a separate spreadsheet.`,
      ];
    }

    const warnings: string[] = [];
    if (usersError) {
      warnings.push(
        `The users spreadsheet could not be read: ${usersError} Until it is fixed, only the ADMIN_EMAILS addresses can sign in.`,
      );
    }
    if (contractTabs.includes(usersSheet)) {
      warnings.push(
        `The contracts spreadsheet still has an old "${usersSheet}" tab. It is no longer used — once everyone is on the users spreadsheet, delete it so contract editors cannot see who has access.`,
      );
    }
    return warnings;
  }

  /** Wraps Google API errors in something a person can act on. */
  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new RepositoryError(describeGoogleError(error), { cause: error });
    }
  }
}

function consecutiveBlocks(rows: EvaluatedContract[]): EvaluatedContract[][] {
  const blocks: EvaluatedContract[][] = [];
  let block: EvaluatedContract[] = [];
  for (const row of rows) {
    const previous = block[block.length - 1];
    if (previous && (row.rowNumber ?? 0) !== (previous.rowNumber ?? 0) + 1) {
      blocks.push(block);
      block = [];
    }
    block.push(row);
  }
  if (block.length) blocks.push(block);
  return blocks;
}

export function describeGoogleError(error: unknown): string {
  const details = error as { code?: number | string; message?: string; errors?: { message?: string }[] };
  const message = details?.errors?.[0]?.message ?? details?.message ?? String(error);
  const code = String(details?.code ?? "");

  // Credential problems are the most common deployment mistake, and their raw
  // messages ("DECODER routines::unsupported") tell nobody anything.
  if (/DECODER|PEM|asn1|bad decrypt|Invalid keyData/i.test(message)) {
    return "The Google credentials could not be read — the private key looks incomplete. Ask your system administrator to re-enter it.";
  }
  if (/invalid_grant|unauthorized_client|Invalid JWT/i.test(message)) {
    return "Google rejected the tracker's credentials. Ask your system administrator to check the service account is still active.";
  }
  if (["ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(code)) {
    return "The tracker could not reach Google. This is usually a temporary network problem — try again shortly.";
  }

  if (code === "403") {
    return "The tracker does not have permission to open the Google Sheet. Ask your system administrator to share it with the tracker as an Editor.";
  }
  if (code === "404") {
    return "The Google Sheet could not be found. Ask your system administrator to check which sheet the tracker is pointed at.";
  }
  return message;
}
