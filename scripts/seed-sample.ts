import { buildSeedBillboards } from "@/lib/billboards/data/seed";
import { BILLBOARD_STORE } from "@/lib/billboards/data/sheet-tables";
import { getConfig, type BillboardSheetConfig } from "@/lib/config/env";
import { tableNames, type DataSet, type RecordStoreInfo } from "@/lib/data/record-store";
import { GoogleSheetsRecordStore } from "@/lib/data/sheet-record-store";
import { todayIn, type ISODate } from "@/lib/date/dates";
import { buildSeedExpats } from "@/lib/expats/data/seed";
import { EXPAT_STORE } from "@/lib/expats/data/sheet-tables";
import { buildSeedLicenses } from "@/lib/licenses/data/seed";
import { LICENSE_STORE } from "@/lib/licenses/data/sheet-tables";

import { loadEnv } from "./load-env";

loadEnv();

/**
 * Loads an app's sample data into its (empty) spreadsheet, for demos and
 * training. Prepares the tabs first if needed, and refuses to run once the
 * sheet holds any record, so it can never mix with real data.
 *
 *   npm run billboards:seed   (tsx scripts/seed-sample.ts billboards)
 *   npm run licenses:seed
 *   npm run expats:seed
 */

interface Seeder<D extends DataSet<D>> {
  info: RecordStoreInfo<D>;
  sheet: (config: ReturnType<typeof getConfig>) => BillboardSheetConfig | null;
  build: (today: ISODate) => D;
  /** The Activity Log entry that says sample data was loaded. */
  note: (sample: D, at: string) => D;
}

const seeder = <D extends DataSet<D>>(definition: Seeder<D>) => definition as unknown as Seeder<never>;
const id = () => `LOG-SEED-${Date.now().toString(36).toUpperCase()}`;

const SEEDERS: Record<string, Seeder<never>> = {
  billboards: seeder({
    info: BILLBOARD_STORE,
    sheet: (config) => config.billboards.google,
    build: buildSeedBillboards,
    note: (sample, at) => ({
      ...sample,
      activity: [
        ...sample.activity,
        { id: id(), at, by: "Sample data", billboardId: "", action: "Sample data loaded", details: "Sample billboards for demos and training. Archive or clear them before real use." },
      ],
    }),
  }),
  licenses: seeder({
    info: LICENSE_STORE,
    sheet: (config) => config.licenses.google,
    build: buildSeedLicenses,
    note: (sample, at) => ({
      ...sample,
      activity: [
        ...sample.activity,
        { id: id(), at, by: "Sample data", recordType: "System" as const, recordId: "", action: "Sample data loaded", details: "Sample licenses for demos and training. Clear them before real use." },
      ],
    }),
  }),
  expats: seeder({
    info: EXPAT_STORE,
    sheet: (config) => config.expats.google,
    build: buildSeedExpats,
    note: (sample, at) => ({
      ...sample,
      activity: [
        ...sample.activity,
        { id: id(), at, by: "Sample data", expatId: "", recordType: "System" as const, recordId: "", action: "Sample data loaded", details: "Sample expats for demos and training. Clear them before real use." },
      ],
    }),
  }),
};

async function main(): Promise<void> {
  const app = process.argv[2] ?? "";
  const definition = SEEDERS[app];
  if (!definition) throw new Error(`Say which app to seed: ${Object.keys(SEEDERS).join(", ")}.`);
  const { info, sheet, build, note } = definition as unknown as Seeder<Record<string, unknown[]>>;

  const config = getConfig();
  const google = sheet(config);
  if (!google) throw new Error(`${info.sheetSetting} and the service account details must be set in .env.local.`);
  const store = new GoogleSheetsRecordStore(google, info);
  for (const message of (await store.setUpStorage()).messages) console.log(`  ${message}`);

  const existing = await store.readAll(true);
  if (tableNames(info).some((name) => name !== "activity" && existing[name].length)) {
    throw new Error(`The ${info.name} sheet already has records. Sample data is only loaded into an empty sheet.`);
  }

  const sample = note(build(todayIn(config.timezone)), new Date().toISOString());
  await store.appendAll(sample);
  console.log(`  Loaded ${info.summary(sample)}.`);
  const health = await store.healthCheck();
  console.log(`\n  ${health.ok ? "Ready" : "Problem"} — ${health.detail}`);
  for (const warning of health.warnings) console.log(`  ! ${warning}`);
}

main().catch((error: Error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exit(1);
});
