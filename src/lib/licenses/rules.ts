/**
 * The License Tracker's numbers. Reminder days are configurable on Setup &
 * access (kept in the license sheet); these are the defaults from the brief.
 */
export interface LicenseRules {
  /** Days before expiry at which a reminder is due, largest first. */
  reminderDays: number[];
}

export const DEFAULT_LICENSE_RULES: LicenseRules = {
  reminderDays: [90, 60, 30, 7],
};

/** Reads "90, 60, 30, 7" as typed by an administrator; a bad value keeps the defaults. */
export function parseReminderDays(text: string | null | undefined): number[] {
  const days = String(text ?? "")
    .split(/[\s,;]+/)
    .map((part) => Number(part))
    .filter((day) => Number.isInteger(day) && day > 0 && day <= 730);
  const unique = [...new Set(days)].sort((a, b) => b - a);
  return unique.length ? unique : [...DEFAULT_LICENSE_RULES.reminderDays];
}
