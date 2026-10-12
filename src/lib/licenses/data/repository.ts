import type { RecordStore } from "@/lib/data/record-store";
import type { LicenseData } from "@/lib/licenses/types";

/**
 * The only way the License Tracker touches stored data: its own Google Sheet
 * in production, a local JSON file in development (`LICENSE_STORE`).
 */
export type LicenseRepository = RecordStore<LicenseData>;
