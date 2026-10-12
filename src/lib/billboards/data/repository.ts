import type { BillboardData } from "@/lib/billboards/types";
import type { RecordStore } from "@/lib/data/record-store";

/**
 * The only way the billboard tracker touches stored data: its own Google Sheet
 * in production, a local JSON file in development (`BILLBOARD_STORE`).
 */
export type BillboardRepository = RecordStore<BillboardData>;
