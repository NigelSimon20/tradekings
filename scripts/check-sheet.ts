import { getConfig } from "@/lib/config/env";
import { GoogleSheetsRepository } from "@/lib/data/google-sheets-repository";
import { CONTRACT_COLUMNS } from "@/lib/data/sheet-schema";
import { todayIn } from "@/lib/date/dates";
import { DATA_QUALITY_FLAGS, FLAG_META, STATUS_META } from "@/lib/domain/meta";
import { CONTRACT_VIEWS, countView, rowsForView } from "@/lib/domain/views";
import { groupByManager } from "@/lib/reports/build";
import { evaluateContracts } from "@/lib/rules/evaluate";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Read-only health report for the connected Google Sheet.
 *
 *   npm run sheet:check
 *
 * It never writes anything: use it to confirm the connection, see how the
 * columns were matched, and check what the rules make of the data.
 */
async function main(): Promise<void> {
  const config = getConfig();
  if (!config.google) {
    throw new Error("No Google Sheet is configured. Fill in .env.local first.");
  }

  const repository = new GoogleSheetsRepository(config.google);
  const today = todayIn(config.timezone);

  console.log("Connection");
  const health = await repository.healthCheck();
  console.log(`  ${health.ok ? "OK" : "PROBLEM"} — ${health.detail}`);
  for (const warning of health.warnings) console.log(`  ! ${warning}`);
  if (!health.ok) process.exit(1);

  console.log("\nReading contracts");
  const rows = await repository.listContracts();
  console.log(`  ${rows.length} rows in the "${config.google.contractsSheet}" tab`);
  if (!rows.length) {
    console.log("  (nothing to check — add contracts, or run: npm run sheet:setup -- --seed)");
    return;
  }

  // How well did the columns come through?
  const blank = (key: keyof (typeof rows)[number]) =>
    rows.filter((row) => {
      const value = row[key];
      return value === null || value === undefined || value === "";
    }).length;

  console.log("\nColumn quality (blank cells)");
  for (const key of ["employeeId", "employeeName", "startDate", "endDate", "managerEmail", "company"] as const) {
    const count = blank(key);
    const header = CONTRACT_COLUMNS.find((column) => column.key === key)?.header ?? key;
    console.log(`  ${header.padEnd(22)} ${count === 0 ? "all present" : `${count} blank`}`);
  }

  console.log("\nApplying the rules");
  const contracts = evaluateContracts(rows, { today });
  const latest = contracts.filter((contract) => contract.computed.isLatest);
  console.log(`  ${latest.length} employees with a current contract, as at ${today}`);

  const byStatus = new Map<string, number>();
  for (const contract of latest) {
    const label = STATUS_META[contract.computed.status].label;
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
  }
  console.log("\nContract status");
  for (const [label, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(24)} ${count}`);
  }

  console.log("\nDashboard counts");
  for (const view of CONTRACT_VIEWS) {
    const count = countView(rowsForView(view, { latest, all: contracts }), view);
    console.log(`  ${view.label.padEnd(44)} ${count}`);
  }

  const flagged = new Map<string, number>();
  for (const contract of contracts) {
    for (const flag of contract.computed.flags) {
      flagged.set(flag.code, (flagged.get(flag.code) ?? 0) + 1);
    }
  }
  if (flagged.size) {
    console.log("\nFlags raised");
    for (const [code, count] of [...flagged.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${FLAG_META[code as keyof typeof FLAG_META].label.padEnd(44)} ${count}`);
    }
  }

  const issues = contracts.filter((contract) =>
    contract.computed.flags.some((flag) => DATA_QUALITY_FLAGS.includes(flag.code)),
  );
  if (issues.length) {
    console.log(`\nRows to fix in the sheet (${issues.length})`);
    for (const contract of issues.slice(0, 10)) {
      const reasons = contract.computed.flags
        .filter((flag) => DATA_QUALITY_FLAGS.includes(flag.code))
        .map((flag) => FLAG_META[flag.code].label)
        .join(", ");
      console.log(`  row ${String(contract.rowNumber).padEnd(4)} ${(contract.employeeName || "(no name)").padEnd(24)} ${reasons}`);
    }
    if (issues.length > 10) console.log(`  …and ${issues.length - 10} more`);
  }

  console.log("\nWeekly report recipients");
  const settings = await repository.readSettings();
  console.log(`  HR: ${settings.hrRecipient || config.hrRecipient || "not set"}`);
  for (const manager of groupByManager(latest)) {
    const needsAction = manager.contracts.filter((contract) => contract.computed.needsAction).length;
    console.log(`  ${manager.name.padEnd(28)} ${manager.email.padEnd(34)} ${manager.contracts.length} employees, ${needsAction} needing action`);
  }

  console.log("\nNothing was written. Run a system check in the app to update the sheet.");
}

main().catch((error: Error) => {
  console.error(`\nCheck failed: ${error.message}`);
  process.exit(1);
});
