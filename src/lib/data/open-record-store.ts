import "server-only";

import type { BillboardSheetConfig } from "@/lib/config/env";
import { getConfig } from "@/lib/config/env";
import { todayIn, type ISODate } from "@/lib/date/dates";
import { LocalRecordStore } from "@/lib/data/local-record-store";
import type { DataSet, RecordStore, RecordStoreInfo } from "@/lib/data/record-store";
import { GoogleSheetsRecordStore } from "@/lib/data/sheet-record-store";

/**
 * A tracker's store: its own Google Sheet when one is configured, otherwise a
 * local file seeded with sample data dated from today.
 */
export function openRecordStore<D extends DataSet<D>>(
  info: RecordStoreInfo<D>,
  source: { google: BillboardSheetConfig | null; localDataFile: string },
  seed: (today: ISODate) => D,
): RecordStore<D> {
  if (source.google) return new GoogleSheetsRecordStore(source.google, info);
  const { timezone } = getConfig();
  return new LocalRecordStore(source.localDataFile, info, () => seed(todayIn(timezone)));
}
