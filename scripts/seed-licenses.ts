import { getConfig } from "@/lib/config/env";
import { GoogleSheetsLicenseRepository } from "@/lib/licenses/data/google-sheets-repository";
import { buildSeedLicenses } from "@/lib/licenses/data/seed";
import { todayIn } from "@/lib/date/dates";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Loads the sample license register into the license spreadsheet, for demos
 * and training. Prepares the tabs first if needed, and refuses to run once the
 * sheet holds any license so it can never mix with real data.
 *
 *   npm run licenses:seed
 */
async function main(): Promise<void> {
  const config = getConfig();
  if (!config.licenses.google) {
    throw new Error("GOOGLE_LICENSES_SHEET_ID and the service account details must be set in .env.local.");
  }
  const repository = new GoogleSheetsLicenseRepository(config.licenses.google);
  const setup = await repository.setUpStorage();
  for (const message of setup.messages) console.log(`  ${message}`);

  const existing = await repository.readAll(true);
  if (existing.licenses.length || existing.assets.length) {
    throw new Error("The license sheet already has records. Sample data is only loaded into an empty sheet.");
  }

  const sample = buildSeedLicenses(todayIn(config.timezone));
  await repository.appendAll({
    ...sample,
    activity: [
      {
        id: `ACT-SEED-${Date.now().toString(36).toUpperCase()}`,
        at: new Date().toISOString(),
        by: "Sample data",
        recordType: "System",
        recordId: "",
        action: "Sample data loaded",
        details: `${sample.licenses.length} sample licenses across ${sample.assets.length} assets. Clear them before real use.`,
      },
    ],
  });
  console.log(`  Loaded ${sample.assets.length} assets, ${sample.licenses.length} licenses, ${sample.renewals.length} renewals.`);
  const health = await repository.healthCheck();
  console.log(`\n  ${health.ok ? "Ready" : "Problem"} — ${health.detail}`);
}

main().catch((error: Error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exit(1);
});
