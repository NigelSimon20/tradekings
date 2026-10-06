import { parseReminderDays } from "@/lib/licenses/rules";

/**
 * The Expat Tracker's numbers. Both are set on Setup & access (kept in the
 * expat sheet); these are the defaults from the brief.
 */
export interface ExpatRules {
  /** Days before expiry at which a reminder is due, largest first. */
  reminderDays: number[];
  /** Who gets every reminder email, besides each expat's responsible manager. */
  recipients: string[];
}

export const DEFAULT_EXPAT_RULES: ExpatRules = {
  reminderDays: [90, 60, 30, 7],
  recipients: [],
};

export { parseReminderDays };

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** "hr@tk.co.zw; ops@tk.co.zw" → the valid, distinct addresses, lower case. */
export function parseRecipients(text: string | null | undefined): string[] {
  return [
    ...new Set(
      String(text ?? "")
        .split(/[\s,;]+/)
        .map((part) => part.trim().toLowerCase())
        .filter((part) => EMAIL.test(part)),
    ),
  ];
}
