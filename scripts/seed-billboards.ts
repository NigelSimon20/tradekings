import { GoogleSheetsBillboardRepository } from "@/lib/billboards/data/google-sheets-repository";
import { buildSeedBillboards } from "@/lib/billboards/data/seed";
import { getConfig } from "@/lib/config/env";
import { todayIn } from "@/lib/date/dates";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Loads the sample billboard network into the billboard spreadsheet, for demos
 * and training. Prepares the tabs first if needed, and refuses to run once the
 * sheet holds any billboard so it can never mix with real data.
 *
 *   npm run billboards:seed
 */
async function main(): Promise<void> {
  const config = getConfig();
  if (!config.billboards.google) {
    throw new Error("GOOGLE_BILLBOARDS_SHEET_ID and the service account details must be set in .env.local.");
  }

  const repository = new GoogleSheetsBillboardRepository(config.billboards.google);
  const setup = await repository.setUpStorage();
  for (const message of setup.messages) console.log(`  ${message}`);

  const existing = await repository.readAll(true);
  if (existing.billboards.length) {
    throw new Error(
      `The billboard sheet already has ${existing.billboards.length} billboard(s). Sample data is only loaded into an empty sheet.`,
    );
  }

  const sample = buildSeedBillboards(todayIn(config.timezone));
  await repository.appendAll({
    ...sample,
    activity: [
      {
        id: `ACT-SEED-${Date.now().toString(36).toUpperCase()}`,
        at: new Date().toISOString(),
        by: "Sample data",
        billboardId: "",
        action: "Sample data loaded",
        details: `${sample.billboards.length} sample billboards for demos and training. Archive or clear them before real use.`,
      },
    ],
  });

  console.log(
    `  Loaded ${sample.billboards.length} billboards, ${sample.campaigns.length} campaigns, ` +
      `${sample.maintenance.length} maintenance visits and ${sample.files.length} documents.`,
  );
  const health = await repository.healthCheck();
  console.log(`\n  ${health.ok ? "Ready" : "Problem"} — ${health.detail}`);
  for (const warning of health.warnings) console.log(`  ! ${warning}`);
}

main().catch((error: Error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exit(1);
});
