import { formatDate, type ISODate } from "@/lib/date/dates";
import { EXPIRY_STATUS_META, profileHref } from "@/lib/expats/meta";
import type { ExpiryItem, ReminderLogEntry } from "@/lib/expats/types";
import { escapeHtml } from "@/lib/reports/render-email";
import { TONE_COLORS } from "@/lib/ui/tones";

/**
 * Expiry reminder emails. Pure: which reminders are due, who gets them, and
 * the email itself. Each item is reminded once per window (90, 60, 30, 7 days
 * before) and once when it expires; the Reminders Sent tab remembers what went
 * out, so a run that is repeated — or missed for a day — never sends twice and
 * never skips one. A renewed item has a new date, so its reminders start over.
 */

export interface DueReminder {
  item: ExpiryItem;
  /** The window being reminded about, or 0 for "has expired". */
  window: number;
  logKey: string;
}

export const reminderLogKey = (item: Pick<ExpiryItem, "key" | "expiryDate">) => `${item.key}@${item.expiryDate}`;

export function dueReminders(items: ExpiryItem[], log: ReminderLogEntry[]): DueReminder[] {
  const sent = new Map<string, number[]>();
  for (const entry of log) sent.set(entry.key, [...(sent.get(entry.key) ?? []), entry.window]);

  const due: DueReminder[] = [];
  for (const item of items) {
    const window = item.status === "EXPIRED" ? 0 : item.status === "EXPIRING" ? item.reminderDays : null;
    if (window === null) continue;
    const logKey = reminderLogKey(item);
    // Already told about this window, or a tighter one (e.g. after the windows were changed).
    if ((sent.get(logKey) ?? []).some((previous) => previous <= window)) continue;
    due.push({ item, window, logKey });
  }
  return due.sort((a, b) => a.item.daysRemaining - b.item.daysRemaining);
}

/** Every reminder goes to the HR recipients; each also goes to the expat's responsible manager. */
export function recipientsFor(due: DueReminder[], everyone: string[]): Map<string, DueReminder[]> {
  const byRecipient = new Map<string, DueReminder[]>();
  const add = (email: string, reminder: DueReminder) => {
    const key = email.trim().toLowerCase();
    if (!key.includes("@")) return;
    const list = byRecipient.get(key) ?? [];
    if (!list.includes(reminder)) byRecipient.set(key, [...list, reminder]);
  };
  for (const reminder of due) {
    for (const email of everyone) add(email, reminder);
    if (reminder.item.responsibleEmail) add(reminder.item.responsibleEmail, reminder);
  }
  return byRecipient;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function when(item: ExpiryItem): string {
  if (item.status === "EXPIRED") return `Expired ${formatDate(item.expiryDate)} (${Math.abs(item.daysRemaining)} days ago)`;
  return `Expires ${formatDate(item.expiryDate)} — in ${item.daysRemaining} day${item.daysRemaining === 1 ? "" : "s"}`;
}

export function renderReminderEmail(input: {
  reminders: DueReminder[];
  appUrl: string;
  today: ISODate;
}): { subject: string; html: string; text: string } {
  const { reminders, appUrl, today } = input;
  const expired = reminders.filter((reminder) => reminder.window === 0).length;
  const subject = `Expat Tracker: ${reminders.length} expiry reminder${reminders.length === 1 ? "" : "s"}${expired ? ` (${expired} expired)` : ""} — ${formatDate(today)}`;
  const link = (item: ExpiryItem) => `${appUrl}${profileHref(item.expatId, item.section)}`;

  const rows = reminders
    .map(({ item }) => {
      const tone = TONE_COLORS[EXPIRY_STATUS_META[item.status].tone];
      const whose = item.dependantId ? `${escapeHtml(item.personName)} (dependant of ${escapeHtml(item.expatName)})` : escapeHtml(item.expatName);
      return `<tr>
  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font:400 14px ${FONT};color:#0f172a;">
    <div style="font-weight:600;"><a href="${escapeHtml(link(item))}" style="color:#0f4c81;text-decoration:none;">${escapeHtml(item.kind)}</a> — ${whose}</div>
    <div style="color:#475569;font-size:13px;margin-top:2px;">${escapeHtml(when(item))}${item.renewalInProgress ? " · renewal under way" : ""}</div>
  </td>
  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;text-align:right;white-space:nowrap;">
    <span style="display:inline-block;border:1px solid ${tone.border};background:${tone.bg};color:${tone.fg};border-radius:999px;padding:2px 10px;font:600 12px ${FONT};">${EXPIRY_STATUS_META[item.status].label}</span>
  </td>
</tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td colspan="2" style="background:#0f172a;padding:24px;">
    <div style="font:600 12px ${FONT};letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;">Trade Kings <span style="color:#5bbaeb;">&middot;</span> Zimkings</div>
    <div style="font:700 22px ${FONT};color:#ffffff;margin-top:6px;">Expat expiry reminders</div>
    <div style="font:400 14px ${FONT};color:#cbd5e1;margin-top:8px;">${formatDate(today)} &nbsp;•&nbsp; ${reminders.length} item${reminders.length === 1 ? "" : "s"} to look at</div>
  </td></tr>
  ${rows}
  <tr><td colspan="2" style="padding:20px 16px;border-top:1px solid #e2e8f0;font:400 13px ${FONT};color:#475569;">
    Open the <a href="${escapeHtml(`${appUrl}/expats/expiries`)}" style="color:#0f4c81;">master expiry view</a> for every date.
    You get this because you are an Expat Tracker reminder recipient or the expat's responsible manager.
  </td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    "Expat expiry reminders",
    formatDate(today),
    "",
    ...reminders.map(({ item }) =>
      [
        `- ${item.kind} — ${item.dependantId ? `${item.personName} (dependant of ${item.expatName})` : item.expatName}`,
        `  ${when(item)}${item.renewalInProgress ? " · renewal under way" : ""}`,
        `  ${link(item)}`,
      ].join("\n"),
    ),
    "",
    `Master expiry view: ${appUrl}/expats/expiries`,
  ].join("\n");

  return { subject, html, text };
}
