import type { RepositoryHealth } from "@/lib/data/repository";
import type { ExpatData } from "@/lib/expats/types";

export type ExpatTable = keyof ExpatData;
export type ExpatRecord<K extends ExpatTable> = ExpatData[K][number];

/**
 * The only way the Expat Tracker touches stored data: its own Google Sheet in
 * production, a local JSON file in development. Records arrive fully stamped
 * (ids, timestamps, who) from the service layer.
 */
export interface ExpatRepository {
  readonly kind: "google-sheets" | "local";
  readonly label: string;
  readAll(fresh?: boolean): Promise<ExpatData>;
  /** Replaces the record with the same id, or adds it. */
  save<K extends ExpatTable>(table: K, record: ExpatRecord<K>): Promise<void>;
  /** Adds records to the end of a tab: the activity log, reminders sent, sample data. */
  append<K extends ExpatTable>(table: K, records: ExpatRecord<K>[]): Promise<void>;
  /** Small pieces of system state: reminder days and recipients, the sealed Drive connection. */
  readSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string | null): Promise<void>;
  healthCheck(): Promise<RepositoryHealth>;
  setUpStorage(): Promise<{ ok: boolean; messages: string[] }>;
}

export const EMPTY_EXPAT_DATA: ExpatData = {
  expats: [],
  dependants: [],
  permits: [],
  leases: [],
  vehicles: [],
  actions: [],
  documents: [],
  activity: [],
  reminders: [],
};
