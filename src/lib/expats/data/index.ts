import "server-only";

import { getConfig } from "@/lib/config/env";
import { openRecordStore } from "@/lib/data/open-record-store";
import type { ExpatRepository } from "@/lib/expats/data/repository";
import { buildSeedExpats } from "@/lib/expats/data/seed";
import { EXPAT_STORE } from "@/lib/expats/data/sheet-tables";

let repository: ExpatRepository | null = null;

/** The expat store, chosen once per process: its spreadsheet, or the local sample file. */
export function getExpatRepository(): ExpatRepository {
  repository ??= openRecordStore(EXPAT_STORE, getConfig().expats, buildSeedExpats);
  return repository;
}
