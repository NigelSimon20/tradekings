import type { sheets_v4 } from "@googleapis/sheets";

import type { GoogleConfig } from "@/lib/config/env";
import {
  CONTRACT_COLUMNS,
  RUN_LOG_HEADERS,
  SETTINGS_HEADERS,
  SETTINGS_ROWS,
  USERS_HEADERS,
  buildColumnIndex,
  settingKeyFor,
} from "@/lib/data/sheet-schema";
import { STATUS_META } from "@/lib/domain/meta";
import { CONTRACT_STATUSES } from "@/lib/domain/types";
import { TONE_COLORS } from "@/lib/ui/tones";

export interface SheetSetupResult {
  ok: boolean;
  createdTabs: string[];
  addedColumns: string[];
  addedSettings: string[];
  colourCoded: boolean;
  /** One line per thing that was done, for showing back to the person. */
  messages: string[];
}

/**
 * Prepares the spreadsheet: creates the tabs, writes the headings, adds the
 * dropdowns and date formats, and colour codes the contract status column.
 *
 * Safe to run again at any time — it only ever adds what is missing, and never
 * touches a value someone has filled in.
 */
export async function setUpSheet(
  client: sheets_v4.Sheets,
  config: GoogleConfig,
  options: { seedAdmins?: string[] } = {},
): Promise<SheetSetupResult> {
  const { spreadsheetId, contractsSheet, runLogSheet, dashboardSheet, settingsSheet, usersSheet } =
    config;
  const result: SheetSetupResult = {
    ok: true,
    createdTabs: [],
    addedColumns: [],
    addedSettings: [],
    colourCoded: false,
    messages: [],
  };

  // 1. Tabs.
  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets(properties(sheetId,title),conditionalFormats)",
  });
  const tabs = spreadsheet.data.sheets ?? [];
  const missingTabs = [contractsSheet, dashboardSheet, settingsSheet, usersSheet, runLogSheet].filter(
    (title) => !tabs.some((tab) => tab.properties?.title === title),
  );

  if (missingTabs.length) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    result.createdTabs = missingTabs;
    result.messages.push(`Created the ${missingTabs.join(", ")} tab${missingTabs.length > 1 ? "s" : ""}.`);
  }

  const refreshed = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title),conditionalFormats)",
  });
  const tabByTitle = (title: string) =>
    (refreshed.data.sheets ?? []).find((tab) => tab.properties?.title === title);
  const contractsTab = tabByTitle(contractsSheet);
  const sheetId = contractsTab?.properties?.sheetId;
  if (sheetId === null || sheetId === undefined) {
    throw new Error(`Could not find the "${contractsSheet}" tab after creating it.`);
  }

  // 2. Headings: keep what is there, append anything missing.
  const existing = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${contractsSheet}'!1:1`,
  });
  const headerRow = (existing.data.values?.[0] ?? []) as string[];
  const index = buildColumnIndex(headerRow);
  const missingColumns = CONTRACT_COLUMNS.filter((column) => !index.has(column.key));
  const header = [...headerRow];
  for (const column of missingColumns) {
    index.set(column.key, header.length);
    header.push(column.header);
  }

  if (missingColumns.length) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${contractsSheet}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
    result.addedColumns = missingColumns.map((column) => column.header);
    result.messages.push(`Added ${missingColumns.length} column heading(s).`);
  }

  // 3. Frozen header, widths, dropdowns and date formats.
  const requests: sheets_v4.Schema$Request[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb("#0f172a"),
            textFormat: { bold: true, foregroundColor: hexToRgb("#ffffff") },
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
      },
    },
  ];

  for (const column of CONTRACT_COLUMNS) {
    const position = index.get(column.key);
    if (position === undefined) continue;
    const range = { sheetId, startColumnIndex: position, endColumnIndex: position + 1 };

    if (column.width) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: position, endIndex: position + 1 },
          properties: { pixelSize: column.width },
          fields: "pixelSize",
        },
      });
    }

    if (column.type === "date") {
      requests.push({
        repeatCell: {
          range: { ...range, startRowIndex: 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd mmm yyyy" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }

    if (column.options) {
      requests.push({
        setDataValidation: {
          range: { ...range, startRowIndex: 1, endRowIndex: 5000 },
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

    if (column.kind === "calculated") {
      requests.push({
        repeatCell: {
          range: { ...range, startRowIndex: 1 },
          cell: {
            userEnteredFormat: { textFormat: { italic: true, foregroundColor: hexToRgb("#475569") } },
          },
          fields: "userEnteredFormat.textFormat",
        },
      });
    }
  }

  // 4. Colour code the status column, unless rules are already there.
  const statusPosition = index.get("status");
  if (statusPosition !== undefined && !(contractsTab?.conditionalFormats ?? []).length) {
    CONTRACT_STATUSES.forEach((status, order) => {
      const colors = TONE_COLORS[STATUS_META[status].tone];
      requests.push({
        addConditionalFormatRule: {
          index: order,
          rule: {
            ranges: [
              {
                sheetId,
                startRowIndex: 1,
                startColumnIndex: statusPosition,
                endColumnIndex: statusPosition + 1,
              },
            ],
            booleanRule: {
              condition: { type: "TEXT_EQ", values: [{ userEnteredValue: STATUS_META[status].label }] },
              format: {
                backgroundColor: hexToRgb(colors.bg),
                textFormat: { bold: true, foregroundColor: hexToRgb(colors.fg) },
              },
            },
          },
        },
      });
    });
    result.colourCoded = true;
    result.messages.push("Colour coded the Contract Status column.");
  }

  // 5. Tidy the supporting tabs.
  for (const title of [settingsSheet, dashboardSheet, usersSheet, runLogSheet]) {
    const id = tabByTitle(title)?.properties?.sheetId;
    if (id === null || id === undefined) continue;
    requests.push(
      {
        repeatCell: {
          range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: "userEnteredFormat.textFormat",
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: id, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 300 },
          fields: "pixelSize",
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: id, dimension: "COLUMNS", startIndex: 1, endIndex: 3 },
          properties: { pixelSize: 240 },
          fields: "pixelSize",
        },
      },
    );
  }

  await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  // 6. Run Log headings.
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `'${runLogSheet}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...RUN_LOG_HEADERS]] },
  });

  // 7. Settings rows — never overwriting a value someone has typed.
  const settingsValues = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${settingsSheet}'`,
  });
  const settingsRows = (settingsValues.data.values ?? []) as string[][];
  const present = new Set(
    settingsRows.map((row) => settingKeyFor(String(row?.[0] ?? ""))).filter(Boolean),
  );
  const missingSettings = SETTINGS_ROWS.filter((row) => !present.has(row.key));

  if (!settingsRows.length) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${settingsSheet}'!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [...SETTINGS_HEADERS],
          ...SETTINGS_ROWS.map((row) => [row.label, row.example, row.note]),
        ],
      },
    });
    result.addedSettings = SETTINGS_ROWS.map((row) => row.label);
    result.messages.push(`Set up the Settings tab with ${SETTINGS_ROWS.length} settings.`);
  } else if (missingSettings.length) {
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `'${settingsSheet}'!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: missingSettings.map((row) => [row.label, row.example, row.note]) },
    });
    result.addedSettings = missingSettings.map((row) => row.label);
    result.messages.push(`Added ${missingSettings.length} new setting(s) to the Settings tab.`);
  }

  // 8. Users tab — who may sign in. Whoever sets the sheet up is added as an
  //    administrator, so switching sign-in on cannot lock everyone out.
  const usersValues = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${usersSheet}'`,
  });
  const userRows = (usersValues.data.values ?? []) as string[][];

  if (!userRows.length) {
    const admins = [...new Set((options.seedAdmins ?? []).map((email) => email.trim().toLowerCase()))]
      .filter((email) => email.includes("@"));

    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${usersSheet}'!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [...USERS_HEADERS],
          ...admins.map((email) => [email, "", "Administrator", "Yes", ""]),
        ],
      },
    });

    result.messages.push(
      admins.length
        ? `Created the Users tab with ${admins.length} administrator(s).`
        : "Created the Users tab — add the people who may sign in.",
    );
  }

  // 9. Dashboard placeholder until the first check fills it in.
  const dashboard = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${dashboardSheet}'`,
  });
  if (!(dashboard.data.values ?? []).length) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${dashboardSheet}'!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          ["Blue Collar Contract Tracker — Dashboard"],
          ["This tab is filled in by the system on the first check."],
        ],
      },
    });
  }

  if (!result.messages.length) result.messages.push("The sheet was already set up correctly.");
  return result;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const value = hex.replace("#", "");
  return {
    red: parseInt(value.slice(0, 2), 16) / 255,
    green: parseInt(value.slice(2, 4), 16) / 255,
    blue: parseInt(value.slice(4, 6), 16) / 255,
  };
}
