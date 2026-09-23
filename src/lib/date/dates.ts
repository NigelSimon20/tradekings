/**
 * Date helpers for the contract tracker.
 *
 * Every date in the system is an ISO calendar date string (`yyyy-mm-dd`) with no
 * time component. Contract rules are calendar based, so we deliberately avoid
 * `Date` arithmetic in local time (which breaks across DST/timezones) and work
 * with UTC midnight instead.
 */

/** Calendar date, `yyyy-mm-dd`. */
export type ISODate = string;

const MS_PER_DAY = 86_400_000;
/** Google Sheets serial dates count from 1899-12-30. */
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE_RE = /^(\d{1,4})[/.](\d{1,2})[/.](\d{1,4})$/;

export function isISODate(value: unknown): value is ISODate {
  return typeof value === "string" && ISO_DATE_RE.test(value) && !Number.isNaN(toUTC(value));
}

/** Milliseconds (UTC midnight) for an ISO date, or NaN when unparseable. */
function toUTC(value: ISODate): number {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return NaN;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return NaN;
  const ms = Date.UTC(year, month - 1, day);
  // Reject overflow such as 2026-02-31.
  return new Date(ms).getUTCDate() === day ? ms : NaN;
}

export function fromUTC(ms: number): ISODate {
  const date = new Date(ms);
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's calendar date in the given IANA timezone (e.g. `Africa/Harare`). */
export function todayIn(timeZone: string): ISODate {
  // `en-CA` formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / MS_PER_DAY);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * MS_PER_DAY);
}

/** Adds calendar months, clamping the day to the end of the target month. */
export function addMonths(date: ISODate, months: number): ISODate {
  const base = new Date(toUTC(date));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate();
  return fromUTC(Date.UTC(year, month + months, Math.min(day, lastDayOfTarget)));
}

export function isBefore(a: ISODate, b: ISODate): boolean {
  return toUTC(a) < toUTC(b);
}

export function isOnOrBefore(a: ISODate, b: ISODate): boolean {
  return toUTC(a) <= toUTC(b);
}

/**
 * Accepts the many shapes a date can arrive in (Google Sheets serial number,
 * `Date`, ISO string, `dd/mm/yyyy` typed by hand) and returns an ISO date.
 * Returns `null` when the value is blank or cannot be understood.
 */
export function parseDateValue(value: unknown): ISODate | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : fromUTC(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? fromUTC(SHEETS_EPOCH_MS + Math.round(value) * MS_PER_DAY) : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (ISO_DATE_RE.test(raw)) return isISODate(raw) ? raw : null;

  // A bare number arriving as text is a sheet serial.
  if (/^\d+(\.\d+)?$/.test(raw)) return parseDateValue(Number(raw));

  const slash = SLASH_DATE_RE.exec(raw);
  if (slash) {
    const [, first, second, third] = slash;
    // yyyy/mm/dd when the first part is a 4 digit year, otherwise dd/mm/yyyy
    // (Zimbabwe writes day first).
    const [day, month, year] = first.length === 4 ? [third, second, first] : [first, second, third];
    const fullYear = year.length === 2 ? `20${year}` : year.padStart(4, "0");
    const candidate = `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return isISODate(candidate) ? candidate : null;
  }

  // Last resort: let the runtime try (handles "12 March 2026", ISO datetimes).
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return fromUTC(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

/** `12 Mar 2026` — short, unambiguous, safe in email clients. */
export function formatDate(date: ISODate | null | undefined): string {
  if (!date || !isISODate(date)) return "—";
  const ms = toUTC(date);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

/** `12 Mar 2026, 08:00` in the given timezone, for run logs and timestamps. */
export function formatDateTime(isoDateTime: string | null | undefined, timeZone: string): string {
  if (!isoDateTime) return "—";
  const parsed = new Date(isoDateTime);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

/** Human phrasing for a days-remaining count, used in tables and emails. */
export function describeDays(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days === -1) return "1 day ago";
  return days > 0 ? `${days} days` : `${Math.abs(days)} days ago`;
}

const SHEETS_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * Timestamps come back from Google Sheets either as the ISO string we wrote or,
 * when the sheet has parsed the cell into a real datetime, as a serial number.
 */
export function parseTimestampValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const numeric = typeof value === "number" ? value : Number(String(value).trim());
  if (Number.isFinite(numeric) && String(value).trim() !== "") {
    const date = new Date(SHEETS_EPOCH_MS + numeric * MS_PER_DAY);
    if (Number.isNaN(date.getTime())) return null;
    // Sheet serials are wall-clock values, so keep them as written.
    return `${fromUTC(date.getTime())} ${String(date.getUTCHours()).padStart(2, "0")}:${String(
      date.getUTCMinutes(),
    ).padStart(2, "0")}`;
  }

  return String(value).trim();
}

/**
 * Formats a stored timestamp. ISO instants are converted into the app
 * timezone; wall-clock strings from the sheet are shown as captured.
 */
export function formatTimestamp(value: string | null | undefined, timeZone: string): string {
  if (!value) return "—";
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) return formatDateTime(value, timeZone);
  if (SHEETS_TIMESTAMP_RE.test(value)) return value.replace("T", " ").slice(0, 16);
  return value;
}

/**
 * The next date on or after `date` that falls on `weekday`
 * (0 = Sunday … 6 = Saturday) — used to show when the weekly report next runs.
 */
export function nextWeekday(date: ISODate, weekday: number): ISODate {
  const current = new Date(toUTC(date)).getUTCDay();
  const offset = (weekday - current + 7) % 7;
  return addDays(date, offset);
}

/**
 * A scheduled UTC hour expressed in the app's timezone, e.g. 6 → "08:00" in
 * Harare. Used to describe the weekly run without exposing UTC to people.
 */
export function formatUtcHourInZone(hoursUtc: number, timeZone: string): string {
  const reference = new Date(Date.UTC(2026, 0, 5, hoursUtc, 0, 0));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(reference);
}
