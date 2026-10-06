import { getConfig } from "@/lib/config/env";
import { todayIn } from "@/lib/date/dates";
import { GoogleSheetsExpatRepository } from "@/lib/expats/data/google-sheets-repository";
import { buildSeedExpats } from "@/lib/expats/data/seed";
import { EXPAT_TABLE_NAMES } from "@/lib/expats/data/sheet-tables";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Loads the sample expat register into the expat spreadsheet, for demos and
 * training. Prepares the tabs first if needed, and refuses to run once the
 * sheet holds any expat so it can never mix with real data.
 *
 *   npm run expats:seed
 */
async function main(): Promise<void> {
  const config = getConfig();
  if (!config.expats.google) {
    throw new Error("GOOGLE_EXPATS_SHEET_ID and the service account details must be set in .env.local.");
  }
  const repository = new GoogleSheetsExpatRepository(config.expats.google);
  const setup = await repository.setUpStorage();
  for (const message of setup.messages) console.log(`  ${message}`);

  const existing = await repository.readAll(true);
  if (existing.expats.length || existing.dependants.length) {
    throw new Error("The expat sheet already has records. Sample data is only loaded into an empty sheet.");
  }

  const sample = buildSeedExpats(todayIn(config.timezone));
  sample.activity.push({
    id: `LOG-SEED-${Date.now().toString(36).toUpperCase()}`,
    at: new Date().toISOString(),
    by: "Sample data",
    expatId: "",
    recordType: "System",
    recordId: "",
    action: "Sample data loaded",
    details: `${sample.expats.length} sample expats and ${sample.dependants.length} dependants. Clear them before real use.`,
  });
  // One tab at a time, to stay well inside the Sheets write quota.
  for (const table of EXPAT_TABLE_NAMES) await repository.append(table, sample[table] as never[]);

  console.log(
    `  Loaded ${sample.expats.length} expats, ${sample.dependants.length} dependants, ${sample.permits.length} passports and permits, ${sample.leases.length} leases, ${sample.vehicles.length} vehicles, ${sample.actions.length} follow-ups.`,
  );
  const health = await repository.healthCheck();
  console.log(`\n  ${health.ok ? "Ready" : "Problem"} — ${health.detail}`);
}

main().catch((error: Error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exit(1);
});
