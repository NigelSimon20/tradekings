import type { RepositoryHealth } from "@/lib/data/repository";
import type {
  Asset,
  License,
  LicenseActivity,
  LicenseData,
  LicenseDocument,
  Renewal,
} from "@/lib/licenses/types";

/**
 * The only way the License Tracker touches stored data: its own Google Sheet
 * in production, a local JSON file in development. Records arrive fully
 * stamped (ids, timestamps, who) from the service layer.
 */
export interface LicenseRepository {
  readonly kind: "google-sheets" | "local";
  readonly label: string;
  readAll(fresh?: boolean): Promise<LicenseData>;
  saveAsset(asset: Asset): Promise<void>;
  saveLicense(license: License): Promise<void>;
  addRenewal(renewal: Renewal): Promise<void>;
  saveDocument(document: LicenseDocument): Promise<void>;
  appendActivity(entries: LicenseActivity[]): Promise<void>;
  /** Small pieces of system state: reminder days, the sealed Drive connection. */
  readSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string | null): Promise<void>;
  /** Appends many records at once, one write per tab. Used to load sample data. */
  appendAll(data: LicenseData): Promise<void>;
  healthCheck(): Promise<RepositoryHealth>;
  setUpStorage(): Promise<{ ok: boolean; messages: string[] }>;
}
