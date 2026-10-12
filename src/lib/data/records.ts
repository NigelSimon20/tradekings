import type { TableSpec } from "@/lib/data/table-spec";

/**
 * Small helpers every tracker's service layer uses to stamp, number and
 * describe the records it saves.
 */

export const timestamp = (): string => new Date().toISOString();

/** A unique id for records nobody types in (log entries, documents): `DOC-MB3K9Z1A2F`. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/** `LIC-036` after `LIC-035`, so the ids people see stay short and readable. */
export function nextId(prefix: string, existing: { id: string }[]): string {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}-(\\d+)$`, "i");
  const highest = existing.reduce((max, item) => {
    const match = pattern.exec(item.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

/** Newest first by a timestamp (or any sortable text). */
export const newestFirst =
  <T,>(key: (item: T) => string) =>
  (a: T, b: T): number =>
    key(b).localeCompare(key(a));

/** A table's column headings by field, for describing changes in its own words. */
export function columnLabels(spec: { columns: readonly { key: string; header: string }[] }): Map<string, string> {
  return new Map(spec.columns.map((column) => [column.key, column.header]));
}

/** Fields that change on every save and say nothing about what changed. */
const ALWAYS_IGNORED = ["lastUpdated", "lastUpdatedBy", "rowNumber"];

/**
 * "Status: Active → Under Maintenance; Number: changed" — what an edit changed,
 * in the sheet's column names, for the activity log. `hidden` fields only say
 * that they changed, so a sensitive value never lands in the log.
 */
export function describeChanges<T extends object>(
  spec: TableSpec<T> | { columns: readonly { key: string; header: string }[] },
  before: T,
  after: T,
  options: { ignore?: string[]; hidden?: (key: string) => boolean } = {},
): string {
  const labels = columnLabels(spec as { columns: readonly { key: string; header: string }[] });
  const ignore = new Set([...ALWAYS_IGNORED, ...(options.ignore ?? [])]);
  const show = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "(blank)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };
  const was = { ...before } as Record<string, unknown>;
  const now = { ...after } as Record<string, unknown>;
  return Object.keys(now)
    .filter((key) => !ignore.has(key) && show(was[key]) !== show(now[key]))
    .map((key) =>
      options.hidden?.(key)
        ? `${labels.get(key) ?? key}: changed`
        : `${labels.get(key) ?? key}: ${show(was[key])} → ${show(now[key])}`,
    )
    .join("; ");
}
