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
        batchUpdate: async ({
          spreadsheetId,
          requestBody,
        }: {
          spreadsheetId: string;
          requestBody: { data: { range: string; values: unknown[][] }[] };
        }) => {
          for (const entry of requestBody.data) {
            await client.spreadsheets.values.update({ spreadsheetId, range: entry.range, requestBody: { values: entry.values } });
          }
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
      ["admin@tkzim.co.zw", "", "Administrator", "Yes", "", "Administrator"],
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

  it("renames the old Role column to Contracts, changing nobody's access", async () => {
    const books: Books = {
      [CONTRACTS_ID]: contractsBook(),
      [USERS_ID]: usersBook([
        ["Email", "Name", "Role", "Active", "Last Signed In", "Billboards"],
        ["hr@tkzim.co.zw", "HR", "HR", "Yes", "", ""],
      ]),
    };
    const result = await setUpSheet(fakeClient(books), config(), { seedAdmins: [] });

    const users = books[USERS_ID].tabs.get("Users")!;
    expect(users[0]).toEqual(["Email", "Name", "Contracts", "Active", "Last Signed In", "Billboards", "Licenses"]);
    expect(users[1]).toEqual(["hr@tkzim.co.zw", "HR", "HR", "Yes", "", ""]);
    expect(result.messages.join(" ")).toMatch(/Renamed .* Role column to Contracts/);
  });

  it("never overwrites a users list that is already there", async () => {
    const existing = [[...USERS_HEADERS], ["hr@tkzim.co.zw", "HR", "HR", "Yes", ""]];
    const books: Books = { [CONTRACTS_ID]: contractsBook(), [USERS_ID]: usersBook(existing) };

    await setUpSheet(fakeClient(books), config(), { seedAdmins: ["admin@tkzim.co.zw"] });

    expect(books[USERS_ID].tabs.get("Users")).toEqual(existing);
  });

  it("adds the Billboards column to a list made before it existed, without touching anyone", async () => {
    const books: Books = {
      [CONTRACTS_ID]: contractsBook(),
      [USERS_ID]: usersBook([
        ["Email", "Name", "Role", "Active", "Last Signed In"],
        ["hr@tkzim.co.zw", "HR", "HR", "Yes", ""],
      ]),
    };

    await setUpSheet(fakeClient(books), config(), { seedAdmins: [] });

    expect(books[USERS_ID].tabs.get("Users")).toEqual([
      [...USERS_HEADERS],
      ["hr@tkzim.co.zw", "HR", "HR", "Yes", ""],
    ]);
  });

  it("puts strict dropdowns on the access columns, wherever they are", async () => {
    const books: Books = {
      [CONTRACTS_ID]: contractsBook(),
      [USERS_ID]: usersBook([["Email", "Billboard Tracker", "Name", "Contract Tracker", "Active", "Last Signed In"]]),
    };
    const client = fakeClient(books);
    const requests: sheets_v4.Schema$Request[] = [];
    const original = client.spreadsheets.batchUpdate.bind(client.spreadsheets);
    client.spreadsheets.batchUpdate = (async (params: { requestBody: sheets_v4.Schema$BatchUpdateSpreadsheetRequest }) => {
      requests.push(...(params.requestBody.requests ?? []));
      return original(params as never);
    }) as never;

    await setUpSheet(client, config(), { seedAdmins: [] });

    const dropdowns = requests
      .filter((request) => request.setDataValidation?.rule?.condition?.type?.startsWith("ONE_OF"))
      .map((request) => ({
        column: request.setDataValidation!.range!.startColumnIndex,
        type: request.setDataValidation!.rule!.condition!.type,
        values: request.setDataValidation!.rule!.condition!.values!.map((value) => value.userEnteredValue),
        strict: request.setDataValidation!.rule!.strict,
      }));
    expect(dropdowns).toEqual(
      expect.arrayContaining([
        // The role columns offer whatever roles are on the roles tabs.
        { column: 3, type: "ONE_OF_RANGE", values: ["='Contract Roles'!$A$2:$A"], strict: true },
        { column: 4, type: "ONE_OF_LIST", values: ["Yes", "No"], strict: true },
        { column: 1, type: "ONE_OF_RANGE", values: ["='Billboard Roles'!$A$2:$A"], strict: true },
      ]),
    );
  });

  it("creates the roles tabs with today's roles, ticked as they work now", async () => {
    const books: Books = { [CONTRACTS_ID]: contractsBook(), [USERS_ID]: usersBook() };
    await setUpSheet(fakeClient(books), config(), { seedAdmins: [] });

    const contracts = books[USERS_ID].tabs.get("Contract Roles")!;
    expect(contracts[0].slice(0, 3)).toEqual(["Role", "Description", "See all employees"]);
    expect(contracts.map((row) => row[0])).toEqual(["Role", "Administrator", "HR", "Manager", "Not allowed"]);
    const manager = contracts.find((row) => row[0] === "Manager")!;
    expect(manager.slice(2)).toEqual([false, true, false, false, false, false]);
    expect(books[USERS_ID].tabs.get("Billboard Roles")!.map((row) => row[0])).toEqual([
      "Role",
      "Administrator",
      "Editor",
      "Viewer",
      "Not allowed",
    ]);
    const notAllowed = contracts.find((row) => row[0] === "Not allowed")!;
    expect(notAllowed.slice(2).every((cell) => cell === false)).toBe(true);
  });

  it("moves a Not allowed row stranded below the tickbox rows up under the roles", async () => {
    const header = ["Role", "Description", "See billboards", "Add & edit billboards"];
    const stranded = [
      header,
      ["Administrator", "All", true, true],
      ["Editor", "Edits", true, true],
      ...Array.from({ length: 5 }, () => ["", "", false, false]),
      ["Not allowed", "Cannot open the Billboard Tracker, whatever else is set.", false, false],
    ];
    const books: Books = {
      [CONTRACTS_ID]: contractsBook(),
      [USERS_ID]: {
        title: "Tracker users",
        tabs: new Map<string, unknown[][]>([
          ["Users", [[...USERS_HEADERS]]],
          ["Billboard Roles", stranded.map((row) => [...row])],
        ]),
      },
    };
    const result = await setUpSheet(fakeClient(books), config(), { seedAdmins: [] });
    const tab = books[USERS_ID].tabs.get("Billboard Roles")!;
    expect(tab[3].slice(0, 2)).toEqual(["Not allowed", "Cannot open the Billboard Tracker, whatever else is set."]);
    expect(tab[8].slice(0, 2)).toEqual(["", ""]);
    // Ticks on the real roles are untouched.
    expect(tab[2]).toEqual(["Editor", "Edits", true, true]);
    expect(result.messages.join(" ")).toMatch(/Moved "Not allowed" up/);
  });

  it("keeps a single Not allowed row, clearing duplicates further down", async () => {
    const rows = [
      ["Role", "Description", "See billboards"],
      ["Administrator", "All", true],
      ["Viewer", "Reads", true],
      ["Not allowed", "Typed by hand", false],
      ...Array.from({ length: 4 }, () => ["", "", false]),
      ["Not allowed", "Stranded", false],
    ];
    const books: Books = {
      [CONTRACTS_ID]: contractsBook(),
      [USERS_ID]: {
        title: "Tracker users",
        tabs: new Map<string, unknown[][]>([
          ["Users", [[...USERS_HEADERS]]],
          ["Billboard Roles", rows.map((row) => [...row])],
        ]),
      },
    };
    await setUpSheet(fakeClient(books), config(), { seedAdmins: [] });
    const tab = books[USERS_ID].tabs.get("Billboard Roles")!;
    expect(tab.filter((row) => row[0] === "Not allowed")).toHaveLength(1);
    expect(tab[3].slice(0, 2)).toEqual(["Not allowed", "Typed by hand"]);
  });

  it("never changes ticks on roles tabs that already exist", async () => {
    const edited = [
      ["Role", "Description", "See all employees", "See own team only"],
      ["HR Clerk", "Custom", true, false],
    ];
    const books: Books = {
      [CONTRACTS_ID]: contractsBook(),
      [USERS_ID]: {
        title: "Tracker users",
        tabs: new Map<string, unknown[][]>([
          ["Users", [[...USERS_HEADERS]]],
          ["Contract Roles", edited.map((row) => [...row])],
        ]),
      },
    };
    await setUpSheet(fakeClient(books), config(), { seedAdmins: [] });
    const tab = books[USERS_ID].tabs.get("Contract Roles")!;
    // Missing permission columns are added, unticked; nothing else moves.
    expect(tab[0]).toEqual([
      "Role",
      "Description",
      "See all employees",
      "See own team only",
      "Add & edit contracts",
      "Export data",
      "Run reports",
      "Manage settings",
    ]);
    expect(tab[1]).toEqual(["HR Clerk", "Custom", true, false]);
    // A tab made before "Not allowed" existed gets it as a new last row.
    expect(tab.at(-1)).toEqual(["Not allowed", "Cannot open the Contract Tracker, whatever else is set."]);
    expect(tab).toHaveLength(3);
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

    // An outage is reported as one, never as "nobody may sign in".
    await expect(repo.listUsers()).rejects.toThrow();
    expect(await repo.listContracts()).toEqual([]);
    const health = await repo.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.warnings.join(" ")).toMatch(/users spreadsheet could not be read/);
  });

  it("finds the columns by heading, so reordering them breaks nothing", async () => {
    books[USERS_ID] = usersBook([
      ["Billboard Tracker", "Email", "Active", "Name", "Last Signed In", "Contract Tracker"],
      ["Viewer", "hr@tkzim.co.zw", "Yes", "HR Officer", "", "HR"],
    ]);
    const repo = await repository();
    const [user] = await repo.listUsers();
    expect(user).toMatchObject({ email: "hr@tkzim.co.zw", name: "HR Officer", role: "HR", billboards: "Viewer" });

    await repo.recordSignIn(user, "2026-09-28T08:00:00Z");
    expect(books[USERS_ID].tabs.get("Users")?.[1]?.[4]).toBe("2026-09-28T08:00:00Z");
  });

  it("reads what each role may do from the roles tabs next to Users", async () => {
    books[USERS_ID].tabs.set("Billboard Roles", [
      ["Role", "Description", "See billboards", "Add & edit billboards", "Remove documents"],
      ["Photographer", "Adds site photos", true, true, false],
    ]);
    const table = await (await repository()).readRoleTable();
    expect(table.billboards.find((role) => role.name === "Photographer")?.permissions).toEqual([
      "viewBillboards",
      "editBillboards",
    ]);
    // Administrator is always there and always complete.
    expect(table.billboards[0]).toMatchObject({ name: "Administrator", locked: true });
    // No Contract Roles tab yet: the built-in contract roles apply.
    expect(table.contracts.map((role) => role.name)).toEqual(["Administrator", "HR", "Manager", "Not allowed"]);
  });

  it("saves access changes made in the app to the right cells, leaving the rest alone", async () => {
    books[USERS_ID] = usersBook([
      ["Email", "Name", "Active", "Contracts", "Billboards", "Last Signed In"],
      ["hr@tkzim.co.zw", "HR", "Yes", "HR", "", "2026-09-01"],
    ]);
    const repo = await repository();

    await repo.saveUser({ email: "HR@tkzim.co.zw", billboards: "Viewer" });
    expect(books[USERS_ID].tabs.get("Users")?.[1]).toEqual(["hr@tkzim.co.zw", "HR", "Yes", "HR", "Viewer", "2026-09-01"]);

    await repo.saveUser({ email: "new@tkzim.co.zw", name: "=HYPERLINK(1)", role: "Manager" });
    expect(books[USERS_ID].tabs.get("Users")?.[2]).toEqual(["new@tkzim.co.zw", "'=HYPERLINK(1)", "Yes", "Manager", null, null, null]);
    expect((await repo.listUsers()).map((user) => user.email)).toEqual(["hr@tkzim.co.zw", "new@tkzim.co.zw"]);
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
