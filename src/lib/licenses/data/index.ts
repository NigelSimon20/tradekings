import "server-only";

import { getConfig } from "@/lib/config/env";
import { GoogleSheetsLicenseRepository } from "@/lib/licenses/data/google-sheets-repository";
import { LocalLicenseRepository } from "@/lib/licenses/data/local-repository";
import type { LicenseRepository } from "@/lib/licenses/data/repository";

let repository: LicenseRepository | null = null;

/**
 * The license store, chosen once per process: the license spreadsheet when
 * GOOGLE_LICENSES_SHEET_ID is set, otherwise the local sample file.
 */
export function getLicenseRepository(): LicenseRepository {
  if (repository) return repository;
  const config = getConfig();
  repository = config.licenses.google
    ? new GoogleSheetsLicenseRepository(config.licenses.google)
    : new LocalLicenseRepository(config.licenses.localDataFile, config.timezone);
  return repository;
}
