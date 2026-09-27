import type { sheets_v4 } from "@googleapis/sheets";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleConfig } from "@/lib/config/env";
import { CONTRACT_COLUMNS, USERS_HEADERS } from "@/lib/data/sheet-schema";
import { setUpSheet } from "@/lib/data/sheet-setup";

/**
 * The list of who may sign in lives in its own spreadsheet, so the people who
 * edit contracts cannot grant themselves access. These tests run the real
 * setup and repository code against an in-memory stand-in for the Sheets API.
 */

type Books = Record<string, { title: string; tabs: Map<string, unknown[][]> }>;

function tabOf(range: string): string {
  return /^'((?:[^']|'')*)'/.exec(range)![1].replace(/''/g, "'");
}

function fakeClient(books: Books): sheets_v4.Sheets {
  const book = (id: string) => {
    const found = books[id];
    if (!found) throw Object.assign(new Error("Requested entity was not found."), { code: 404 });
    return found;
  };
  const tab = (id: string, range: string) => {
    const rows = book(id).tabs.get(tabOf(range));
    if (!rows) throw Object.assign(new Error(`Unable to parse range: ${range}`), { code: 400 });
    return rows;
  };

  const client = {
    spreadsheets: {
      get: async ({ spreadsheetId }: { spreadsheetId: string }) => ({
        data: {
          properties: { title: book(spreadsheetId).title },
          sheets: [...book(spreadsheetId).tabs.keys()].map((title, sheetId) => ({
            properties: { title, sheetId },
            conditionalFormats: [],
          })),
        },
      }),
      batchUpdate: async ({
        spreadsheetId,
        requestBody,
      }: {
        spreadsheetId: string;
        requestBody: sheets_v4.Schema$BatchUpdateSpreadsheetRequest;
      }) => {
        for (const request of requestBody.requests ?? []) {
          const title = request.addSheet?.properties?.title;
          if (title) book(spreadsheetId).tabs.set(title, []);
        }
        return { data: {} };
      },
      values: {
        get: async ({ spreadsheetId, range }: { spreadsheetId: string; range: string }) => {
          const rows = tab(spreadsheetId, range);
          return { data: { values: range.endsWith("!1:1") ? rows.slice(0, 1) : rows } };
        },
        batchGet: async ({ spreadsheetId, ranges }: { spreadsheetId: string; ranges: string[] }) => ({
          data: { valueRanges: ranges.map((range) => ({ values: tab(spreadsheetId, range) })) },
        }),
        update: async ({
          spreadsheetId,
          range,
          requestBody,
        }: {
          spreadsheetId: string;
          range: string;
          requestBody: { values: unknown[][] };
        }) => {
          const rows = tab(spreadsheetId, range);
          const cell = /!([A-Z]+)(\d+)$/.exec(range);
          const column = cell ? cell[1].charCodeAt(0) - 65 : 0;
          const start = cell ? Number(cell[2]) - 1 : 0;
          requestBody.values.forEach((values, offset) => {
            const row = [...(rows[start + offset] ?? [])];
            values.forEach((value, index) => (row[column + index] = value));
            rows[start + offset] = row;
          });
          return { data: {} };
        },
        append: async ({
          spreadsheetId,
          range,
          requestBody,
        }: {
          spreadsheetId: string;
          range: string;
          requestBody: { values: unknown[][] };
        }) => {
          tab(spreadsheetId, range).push(...requestBody.values);
          return { data: { updates: { updatedRange: `'${tabOf(range)}'!A1` } } };
        },
        clear: async () => ({ data: {} }),
      },
    },
  };
  return client as unknown as sheets_v4.Sheets;
}

const CONTRACTS_ID = "contracts-book";
const USERS_ID = "users-book";

function config(overrides: Partial<GoogleConfig> = {}): GoogleConfig {
  return {
    spreadsheetId: CONTRACTS_ID,
    usersSpreadsheetId: USERS_ID,
    contractsSheet: "Contracts",
    runLogSheet: "Run Log",
    dashboardSheet: "Dashboard",
    settingsSheet: "Settings",
    usersSheet: "Users",
    clientEmail: "tracker@example.iam.gserviceaccount.com",
    privateKey: "key",
    timezone: "Africa/Harare",
    cacheSeconds: 0,
    ...overrides,
  };
}

function contractsBook(extraTabs: [string, unknown[][]][] = []): Books[string] {
  return {
    title: "Contracts",
    tabs: new Map<string, unknown[][]>([
      ["Contracts", [CONTRACT_COLUMNS.map((column) => column.header)]],
      ["Settings", []],
      ["Run Log", []],
      ["Dashboard", []],
      ...extraTabs,
    ]),
  };
}

function usersBook(rows?: unknown[][]): Books[string] {
  return {
    title: "Tracker users",
    tabs: new Map<string, unknown[][]>(rows ? [["Users", rows]] : [["Sheet1", []]]),
  };
}

describe("setting up the users spreadsheet", () => {
  it("creates the Users tab in the users spreadsheet, not beside the contracts", async () => {
    const books: Books = { [CONTRACTS_ID]: contractsBook(), [USERS_ID]: usersBook() };

    const result = await setUpSheet(fakeClient(books), config(), { seedAdmins: ["Admin@TKZim.co.zw"] });

    expect(result.ok).toBe(true);
    expect(books[CONTRACTS_ID].tabs.has("Users")).toBe(false);
    expect(books[USERS_ID].tabs.get("Users")).toEqual([
      [...USERS_HEADERS],
      ["admin@tkzim.co.zw", "", "Administrator", "Yes", ""],
    ]);
  });

  it("copies everyone from an old Users tab so nobody loses access", async () => {
    const books: Books = {
      [CONTRACTS_ID]: contractsBook([
        [
          "Users",
          [
            [...USERS_HEADERS],
            ["admin@tkzim.co.zw", "Admin", "Administrator", "Yes", ""],
            ["hr@tkzim.co.zw", "HR Officer", "HR", "Yes", ""],
          ],
        ],
      ]),
      [USERS_ID]: usersBook(),
    };

    const result = await setUpSheet(fakeClient(books), config(), { seedAdmins: ["admin@tkzim.co.zw"] });

    expect(books[USERS_ID].tabs.get("Users")).toEqual([
      [...USERS_HEADERS],
      ["admin@tkzim.co.zw", "Admin", "Administrator", "Yes", ""],
      ["hr@tkzim.co.zw", "HR Officer", "HR", "Yes", ""],
    ]);
    expect(result.messages.join(" ")).toMatch(/Copied 2 people/);
  });

  it("never overwrites a users list that is already there", async () => {
    const existing = [[...USERS_HEADERS], ["hr@tkzim.co.zw", "HR", "HR", "Yes", ""]];
    const books: Books = { [CONTRACTS_ID]: contractsBook(), [USERS_ID]: usersBook(existing) };

    await setUpSheet(fakeClient(books), config(), { seedAdmins: ["admin@tkzim.co.zw"] });

    expect(books[USERS_ID].tabs.get("Users")).toEqual(existing);
  });

  it("reports a users spreadsheet the tracker cannot open, without failing the rest", async () => {
    const books: Books = { [CONTRACTS_ID]: contractsBook() };

    const result = await setUpSheet(fakeClient(books), config(), { seedAdmins: [] });

    expect(result.ok).toBe(false);
    expect(result.messages.join(" ")).toMatch(/GOOGLE_USERS_SHEET_ID/);
    expect(books[CONTRACTS_ID].tabs.has("Users")).toBe(false);
  });

  it("keeps the Users tab with the contracts when no users spreadsheet is set", async () => {
    const books: Books = { [CONTRACTS_ID]: contractsBook() };

    await setUpSheet(fakeClient(books), config({ usersSpreadsheetId: CONTRACTS_ID }), {
      seedAdmins: ["admin@tkzim.co.zw"],
    });

    expect(books[CONTRACTS_ID].tabs.get("Users")?.[1]?.[0]).toBe("admin@tkzim.co.zw");
  });
});

let activeClient: sheets_v4.Sheets;

vi.mock("@googleapis/sheets", () => ({
  auth: { JWT: class {} },
  sheets: () => activeClient,
}));

describe("reading users from the users spreadsheet", () => {
  let books: Books;

  beforeEach(() => {
    books = {
      [CONTRACTS_ID]: contractsBook([
        ["Users", [[...USERS_HEADERS], ["intruder@example.com", "", "Administrator", "Yes", ""]]],
      ]),
      [USERS_ID]: usersBook([[...USERS_HEADERS], ["hr@tkzim.co.zw", "HR", "HR", "Yes", ""]]),
    };
    activeClient = fakeClient(books);
  });

  async function repository(overrides: Partial<GoogleConfig> = {}) {
    const { GoogleSheetsRepository } = await import("@/lib/data/google-sheets-repository");
    return new GoogleSheetsRepository(config(overrides));
  }

  it("ignores a Users tab added to the contracts spreadsheet", async () => {
    const users = await (await repository()).listUsers();
    expect(users.map((user) => user.email)).toEqual(["hr@tkzim.co.zw"]);
  });

  it("records sign-ins in the users spreadsheet", async () => {
    const repo = await repository();
    const [user] = await repo.listUsers();
    await repo.recordSignIn(user, "2026-09-27T08:00:00Z");

    expect(books[USERS_ID].tabs.get("Users")?.[1]?.[4]).toBe("2026-09-27T08:00:00Z");
    expect(books[CONTRACTS_ID].tabs.get("Users")?.[1]?.[4]).toBe("");
  });

  it("keeps the contracts working when the users spreadsheet cannot be read", async () => {
    delete books[USERS_ID];
    const repo = await repository();

    expect(await repo.listUsers()).toEqual([]);
    expect(await repo.listContracts()).toEqual([]);
    const health = await repo.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.warnings.join(" ")).toMatch(/users spreadsheet could not be read/);
  });

  it("warns about the old Users tab left in the contracts spreadsheet", async () => {
    const health = await (await repository()).healthCheck();
    expect(health.warnings.join(" ")).toMatch(/still has an old "Users" tab/);
  });

  it("warns while the users list still sits beside the contracts", async () => {
    const health = await (await repository({ usersSpreadsheetId: CONTRACTS_ID })).healthCheck();
    expect(health.warnings.join(" ")).toMatch(/GOOGLE_USERS_SHEET_ID/);
  });
});
