import { getConfig } from "@/lib/config/env";
import { GoogleSheetsRepository } from "@/lib/data/google-sheets-repository";
import { buildSeedContracts } from "@/lib/data/seed";
import { todayIn } from "@/lib/date/dates";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Prepares the Google Sheet from the command line. The same work can be done
 * from the Rules & settings page in the app, which is what most people should
 * use — this exists for setting up before the app is running.
 *
 *   npm run sheet:setup            prepare the sheet
 *   npm run sheet:setup -- --seed  also add the sample rows
 */
async function main(): Promise<void> {
  const config = getConfig();
  if (!config.google) {
    throw new Error(
      "Google credentials are missing. Set GOOGLE_SHEET_ID and the service account details in .env.local.",
    );
  }

  const repository = new GoogleSheetsRepository(config.google);
  const result = await repository.setUpStorage();
  for (const message of result.messages) console.log(`  ${message}`);

  if (process.argv.includes("--seed")) {
    const contracts = buildSeedContracts(todayIn(config.timezone));
    await repository.createContracts(
      contracts.map(({ id, rowNumber, lastUpdated, ...input }) => {
        void id;
        void rowNumber;
        void lastUpdated;
        return input;
      }),
    );
    console.log(`  Added ${contracts.length} sample contract rows.`);
  }

  const health = await repository.healthCheck();
  console.log(`\n  ${health.ok ? "Ready" : "Problem"} — ${health.detail}`);
  for (const warning of health.warnings) console.log(`  ! ${warning}`);
  console.log("\n  Run a system check in the app to fill in the Dashboard tab.");
}

main().catch((error: Error) => {
  console.error(`\nSheet setup failed: ${error.message}`);
  process.exit(1);
});
