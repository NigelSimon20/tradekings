import { neutraliseFormula, parseSheetBoolean } from "@/lib/data/sheet-schema";
import { parseDateValue, parseTimestampValue } from "@/lib/date/dates";

/**
 * Typed tabs in a Google Sheet: each tab's columns are matched by their
 * heading, so people can reorder or insert columns freely, and reading and
 * writing a row are plain functions of the table's definition. Shared by the
 * billboard and license trackers.
 */

export type Kind = "text" | "number" | "date" | "timestamp" | "boolean";

export interface TableColumn<T> {
  key: keyof T & string;
  header: string;
  kind: Kind;
  /** Offered as a dropdown in the sheet. */
  options?: readonly string[];
  width?: number;
}

export interface TableSpec<T> {
  /** The default tab name. */
  tab: string;
  columns: TableColumn<T>[];
  /** Every row must have this, or it is treated as blank. */
  idKey: keyof T & string;
}

export const col = <T,>(
  key: keyof T & string,
  header: string,
  kind: Kind = "text",
  extra: Partial<TableColumn<T>> = {},
): TableColumn<T> => ({ key, header, kind, ...extra });

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Which position each column occupies in a tab's header row. */
export function indexHeader<K extends string>(
  spec: { columns: readonly { key: K; header: string }[] },
  header: unknown[],
): Map<K, number> {
  const positions = new Map<string, number>();
  header.forEach((cell, position) => {
    const key = normaliseHeader(String(cell ?? ""));
    if (key && !positions.has(key)) positions.set(key, position);
  });

  const index = new Map<K, number>();
  for (const column of spec.columns) {
    const position = positions.get(normaliseHeader(column.header));
    if (position !== undefined) index.set(column.key, position);
  }
  return index;
}

export function missingHeaders(
  spec: { columns: readonly { key: string; header: string }[] },
  header: unknown[],
): string[] {
  const index = indexHeader(spec, header);
  return spec.columns.filter((column) => !index.has(column.key)).map((column) => column.header);
}

function readCell(kind: Kind, value: unknown): unknown {
  switch (kind) {
    case "number": {
      if (value === "" || value === null || value === undefined) return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    case "date":
      return parseDateValue(value);
    case "timestamp":
      return parseTimestampValue(value) ?? "";
    case "boolean":
      return parseSheetBoolean(String(value ?? ""), false);
    default:
      return String(value ?? "").trim();
  }
}

/** One sheet row as a record; null for blank rows (no id). */
export function readRow<T>(
  spec: TableSpec<T>,
  index: Map<keyof T & string, number>,
  row: unknown[],
): T | null {
  const record: Record<string, unknown> = {};
  for (const column of spec.columns) {
    const position = index.get(column.key);
    record[column.key] = readCell(column.kind, position === undefined ? "" : row[position]);
  }
  return String(record[spec.idKey] ?? "").trim() ? (record as T) : null;
}

function writeCell(kind: Kind, value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (kind === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value;
  const text = String(value);
  // Rows are written as if typed, so dates become real dates. Text that looks
  // like a number (a phone number, say) is marked as text so its leading zero
  // survives.
  if (kind === "text" && /^\d[\d.]*$/.test(text)) return `'${text}`;
  // Spreadsheet cells execute: user text must never start a formula.
  return neutraliseFormula(text);
}

/**
 * A record as a row laid out like the tab's header. Columns the tab does not
 * have are skipped, and cells in columns the system does not know are `null`,
 * which the Sheets API leaves untouched, so someone's extra column survives an
 * update.
 */
export function writeRow<T>(
  spec: TableSpec<T>,
  index: Map<keyof T & string, number>,
  record: T,
  width: number,
): (string | number | null)[] {
  const row: (string | number | null)[] = new Array(width).fill(null);
  for (const column of spec.columns) {
    const position = index.get(column.key);
    if (position === undefined) continue;
    row[position] = writeCell(column.kind, record[column.key]);
  }
  return row;
}
