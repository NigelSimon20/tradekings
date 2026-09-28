import type { RepositoryHealth } from "@/lib/data/repository";
import type {
  ActivityEntry,
  Billboard,
  BillboardData,
  BillboardFile,
  Campaign,
  MaintenanceRecord,
} from "@/lib/billboards/types";

export interface BillboardSetupResult {
  ok: boolean;
  messages: string[];
}

/**
 * The only way the billboard tracker touches stored data: its own Google
 * Sheet in production, a local JSON file in development. Records arrive fully
 * stamped (ids, timestamps, who) from the service layer, so both stores only
 * have to keep them.
 */
export interface BillboardRepository {
  readonly kind: "google-sheets" | "local";
  readonly label: string;
  /** Everything, in one read. Pass `fresh` to bypass the short read cache. */
  readAll(fresh?: boolean): Promise<BillboardData>;
  /** Inserts the billboard, or replaces the row with the same id. */
  saveBillboard(billboard: Billboard): Promise<void>;
  addCampaign(campaign: Campaign): Promise<void>;
  addMaintenance(record: MaintenanceRecord): Promise<void>;
  /** Inserts the document, or replaces the row with the same id. */
  saveFile(file: BillboardFile): Promise<void>;
  appendActivity(entries: ActivityEntry[]): Promise<void>;
  /**
   * Small pieces of system state (such as the sealed Drive connection), kept
   * out of the way of the records. `null` clears a setting.
   */
  readSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string | null): Promise<void>;
  /** Appends many records at once — one write per tab. Used to load sample data. */
  appendAll(data: BillboardData): Promise<void>;
  healthCheck(): Promise<RepositoryHealth>;
  /** Creates the tabs, headings and dropdowns; safe to run again. */
  setUpStorage(): Promise<BillboardSetupResult>;
}
