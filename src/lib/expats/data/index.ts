import "server-only";

import { getConfig } from "@/lib/config/env";
import { GoogleSheetsExpatRepository } from "@/lib/expats/data/google-sheets-repository";
import { LocalExpatRepository } from "@/lib/expats/data/local-repository";
import type { ExpatRepository } from "@/lib/expats/data/repository";

let repository: ExpatRepository | null = null;

/**
 * The expat store, chosen once per process: the expat spreadsheet when
 * GOOGLE_EXPATS_SHEET_ID is set, otherwise the local sample file.
 */
export function getExpatRepository(): ExpatRepository {
  if (repository) return repository;
  const config = getConfig();
  repository = config.expats.google
    ? new GoogleSheetsExpatRepository(config.expats.google)
    : new LocalExpatRepository(config.expats.localDataFile, config.timezone);
  return repository;
}
