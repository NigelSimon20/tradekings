import "server-only";

import { GoogleSheetsBillboardRepository } from "@/lib/billboards/data/google-sheets-repository";
import { LocalBillboardRepository } from "@/lib/billboards/data/local-repository";
import type { BillboardRepository } from "@/lib/billboards/data/repository";
import { getConfig } from "@/lib/config/env";

let repository: BillboardRepository | null = null;

/**
 * The billboard store, chosen once per process: the billboard spreadsheet when
 * GOOGLE_BILLBOARDS_SHEET_ID is set, otherwise the local sample file.
 */
export function getBillboardRepository(): BillboardRepository {
  if (repository) return repository;

  const config = getConfig();
  repository = config.billboards.google
    ? new GoogleSheetsBillboardRepository(config.billboards.google)
    : new LocalBillboardRepository(config.billboards.localDataFile, config.timezone);
  return repository;
}
