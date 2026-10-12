import type { RepositoryHealth } from "@/lib/data/repository";
import type { TableSpec } from "@/lib/data/table-spec";

/**
 * The storage every tracker except the contract one uses: a data set of named
 * record lists (billboards, campaigns, …), kept on one Google Sheet tab each in
 * production and in a local JSON file on sample data. Records arrive fully
 * stamped (ids, timestamps, who) from the service layer, so a store only keeps
 * them. One implementation of each kind serves every app.
 */

/** A data set: named lists of records. */
export type DataSet<D> = { [K in keyof D]: readonly unknown[] };

/** One record type in a data set: `RowOf<LicenseData, "licenses">` is `License`. */
export type RowOf<D extends DataSet<D>, K extends keyof D> = D[K][number];

/** The tab definition for every record list in a data set. */
export type TableSet<D extends DataSet<D>> = { [K in keyof D]: TableSpec<RowOf<D, K>> };

export interface RecordStoreInfo<D extends DataSet<D>> {
  /** "billboard", "license", "expat" — for messages. */
  name: string;
  tables: TableSet<D>;
  /** "12 billboards", for the health line. */
  summary: (data: D) => string;
  /** The setting that names the spreadsheet, for the message shown on sample data. */
  sheetSetting: string;
}

export interface RecordStore<D extends DataSet<D>> {
  readonly kind: "google-sheets" | "local";
  readonly label: string;
  /** Everything, in one read. `fresh` skips the short read cache. */
  readAll(fresh?: boolean): Promise<D>;
  /** Replaces the record with the same id, or adds it. */
  save<K extends keyof D & string>(table: K, record: RowOf<D, K>): Promise<void>;
  /** Adds records to the end of a list: history, the activity log, sample data. */
  append<K extends keyof D & string>(table: K, records: RowOf<D, K>[]): Promise<void>;
  /** Adds a whole data set, one write per list. Used to load sample data. */
  appendAll(data: D): Promise<void>;
  /** Small pieces of system state (reminder settings, the sealed Drive connection). `null` clears one. */
  readSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string | null): Promise<void>;
  healthCheck(): Promise<RepositoryHealth>;
  /** Creates missing tabs, headings and dropdowns; safe to run again. */
  setUpStorage(): Promise<{ ok: boolean; messages: string[] }>;
}

export function tableNames<D extends DataSet<D>>(info: RecordStoreInfo<D>): (keyof D & string)[] {
  return Object.keys(info.tables) as (keyof D & string)[];
}

/** An empty data set: every list present and empty. */
export function emptyData<D extends DataSet<D>>(info: RecordStoreInfo<D>): D {
  return Object.fromEntries(tableNames(info).map((name) => [name, []])) as unknown as D;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const storeLabel = (info: { name: string }) => `${capitalise(info.name)} Google Sheet`;

/** The tab names, in order — for "Creates any missing tab (…)" on Setup & access. */
export function tabNames(info: { tables: object }): string[] {
  return Object.values(info.tables as Record<string, { tab: string }>).map((table) => table.tab);
}
