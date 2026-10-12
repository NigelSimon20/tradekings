import "server-only";

import { buildSeedBillboards } from "@/lib/billboards/data/seed";
import type { BillboardRepository } from "@/lib/billboards/data/repository";
import { BILLBOARD_STORE } from "@/lib/billboards/data/sheet-tables";
import { getConfig } from "@/lib/config/env";
import { openRecordStore } from "@/lib/data/open-record-store";

let repository: BillboardRepository | null = null;

/** The billboard store, chosen once per process: its spreadsheet, or the local sample file. */
export function getBillboardRepository(): BillboardRepository {
  repository ??= openRecordStore(BILLBOARD_STORE, getConfig().billboards, buildSeedBillboards);
  return repository;
}
