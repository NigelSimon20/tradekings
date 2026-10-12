import "server-only";

import { getConfig } from "@/lib/config/env";
import { openRecordStore } from "@/lib/data/open-record-store";
import type { LicenseRepository } from "@/lib/licenses/data/repository";
import { buildSeedLicenses } from "@/lib/licenses/data/seed";
import { LICENSE_STORE } from "@/lib/licenses/data/sheet-tables";

let repository: LicenseRepository | null = null;

/** The license store, chosen once per process: its spreadsheet, or the local sample file. */
export function getLicenseRepository(): LicenseRepository {
  repository ??= openRecordStore(LICENSE_STORE, getConfig().licenses, buildSeedLicenses);
  return repository;
}
