import { auth as googleAuth, sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";

import { getConfig } from "@/lib/config/env";
import {
  CONTRACT_COLUMNS,
  RUN_LOG_HEADERS,
  SETTINGS_HEADERS,
  SETTINGS_ROWS,
  buildColumnIndex,
  inputCellValue,
  settingKeyFor,
} from "@/lib/data/sheet-schema";
import { buildSeedContracts } from "@/lib/data/seed";
import { todayIn } from "@/lib/date/dates";
import { STATUS_META } from "@/lib/domain/meta";
import { CONTRACT_STATUSES } from "@/lib/domain/types";
import { TONE_COLORS } from "@/lib/ui/tones";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Prepares the Google Sheet: creates the tabs, writes the headers, adds the
 * dropdowns and date formats, and colour codes the Contract Status column.
 *
 *   npm run sheet:setup            prepare the sheet
 *   npm run sheet:setup -- --seed  also add the sample rows
 *
 * Safe to run again: existing columns and data are never removed.
 */
async function main(): Promise<void> {
  const config = getConfig();
  if (!config.google) {
    throw new Error(
      "Google credentials are missing. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env.local.",
    );
  }

  const { spreadsheetId, contractsSheet, runLogSheet, dashboardSheet, settingsSheet } = config.google;
  const client = sheetsApi({
    version: "v4",
    auth: new googleAuth.JWT({
      email: config.google.clientEmail,
      key: config.google.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    }),
  });

  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets(properties(sheetId,title,gridProperties),conditionalFormats)",
  });
  console.log(`Spreadsheet: ${spreadsheet.data.properties?.title}`);

  const tabs = spreadsheet.data.sheets ?? [];
  const findTab = (title: string) => tabs.find((tab) => tab.properties?.title === title);

  // 1. Make sure both tabs exist.
  const missingTabs = [contractsSheet, runLogSheet, dashboardSheet, settingsSheet].filter(
    (title) => !findTab(title),
  );
  if (missingTabs.length) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    console.log(`Created tab(s): ${missingTabs.join(", ")}`);
  }

  const refreshed = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties),conditionalFormats)",
  });
  const contractsTab = (refreshed.data.sheets ?? []).find(
    (tab) => tab.properties?.title === contractsSheet,
  );
  const sheetId = contractsTab?.properties?.sheetId;
  if (sheetId === null || sheetId === undefined) throw new Error("Could not resolve the sheet id.");

  // 2. Headers: keep what is there, append anything missing.
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
    console.log(`Added ${missingColumns.length} column(s): ${missingColumns.map((c) => c.header).join(", ")}`);
  } else {
    console.log("All columns already present.");
  }

  // 3. Formatting: frozen header, widths, dropdowns, date formats.
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
          cell: { userEnteredFormat: { textFormat: { italic: true, foregroundColor: hexToRgb("#475569") } } },
          fields: "userEnteredFormat.textFormat",
        },
      });
    }
  }

  // 4. Colour code the Contract Status column, unless rules already exist.
  const statusPosition = index.get("status");
  const alreadyFormatted = (contractsTab?.conditionalFormats ?? []).length > 0;
  if (statusPosition !== undefined && !alreadyFormatted) {
    CONTRACT_STATUSES.forEach((status, order) => {
      const colors = TONE_COLORS[STATUS_META[status].tone];
      requests.push({
        addConditionalFormatRule: {
          index: order,
          rule: {
            ranges: [
              { sheetId, startRowIndex: 1, startColumnIndex: statusPosition, endColumnIndex: statusPosition + 1 },
            ],
            booleanRule: {
              condition: {
                type: "TEXT_EQ",
                values: [{ userEnteredValue: STATUS_META[status].label }],
              },
              format: {
                backgroundColor: hexToRgb(colors.bg),
                textFormat: { bold: true, foregroundColor: hexToRgb(colors.fg) },
              },
            },
          },
        },
      });
    });
    console.log("Added colour coding to the Contract Status column.");
  }

  await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  // 5. Run Log headers.
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `'${runLogSheet}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...RUN_LOG_HEADERS]] },
  });

  // 6. Settings tab — the recipients an administrator can change without a
  //    redeploy. Values already filled in are never overwritten.
  const existingSettings = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${settingsSheet}'`,
  });
  const settingsRows = (existingSettings.data.values ?? []) as string[][];
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
    console.log(`Created the "${settingsSheet}" tab with ${SETTINGS_ROWS.length} settings.`);
  } else if (missingSettings.length) {
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `'${settingsSheet}'!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: missingSettings.map((row) => [row.label, row.example, row.note]),
      },
    });
    console.log(`Added ${missingSettings.length} missing setting(s).`);
  }

  // 7. Dashboard tab — filled in by the first system check.
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
          ["This tab is filled in by the system on the first check. Do not edit it by hand."],
        ],
      },
    });
  }

  // Tidy both tabs: bold first row, readable column widths.
  for (const title of [settingsSheet, dashboardSheet, runLogSheet]) {
    const sheet = (refreshed.data.sheets ?? []).find((tab) => tab.properties?.title === title);
    const id = sheet?.properties?.sheetId;
    if (id === null || id === undefined) continue;

    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
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
              properties: { pixelSize: 220 },
              fields: "pixelSize",
            },
          },
        ],
      },
    });
  }

  // 8. Optional sample data.
  if (process.argv.includes("--seed")) {
    const rows = buildSeedContracts(todayIn(config.timezone)).map((contract) => {
      const row = new Array(header.length).fill("");
      for (const column of CONTRACT_COLUMNS) {
        if (column.kind !== "input") continue;
        const position = index.get(column.key);
        if (position === undefined) continue;
        row[position] = inputCellValue(contract, column.key as Parameters<typeof inputCellValue>[1]);
      }
      return row;
    });

    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `'${contractsSheet}'!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
    console.log(`Added ${rows.length} sample contract rows.`);
  }

  console.log(
    `Done. The sheet now has: ${contractsSheet}, ${dashboardSheet}, ${settingsSheet}, ${runLogSheet}.`,
  );
  console.log("Run a system check in the app to fill in the Dashboard tab.");
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const value = hex.replace("#", "");
  return {
    red: parseInt(value.slice(0, 2), 16) / 255,
    green: parseInt(value.slice(2, 4), 16) / 255,
    blue: parseInt(value.slice(4, 6), 16) / 255,
  };
}

main().catch((error: Error) => {
  console.error(`\nSheet setup failed: ${error.message}`);
  process.exit(1);
});
