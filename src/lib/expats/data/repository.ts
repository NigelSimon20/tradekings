import { emptyData, type RecordStore, type RowOf } from "@/lib/data/record-store";
import { EXPAT_STORE } from "@/lib/expats/data/sheet-tables";
import type { ExpatData } from "@/lib/expats/types";

/**
 * The only way the Expat Tracker touches stored data: its own Google Sheet in
 * production, a local JSON file in development (`EXPAT_STORE`).
 */
export type ExpatRepository = RecordStore<ExpatData>;
export type ExpatTable = keyof ExpatData;
export type ExpatRecord<K extends ExpatTable> = RowOf<ExpatData, K>;

export const EMPTY_EXPAT_DATA: ExpatData = emptyData(EXPAT_STORE);
