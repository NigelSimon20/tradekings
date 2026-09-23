import { describeDays, formatDate, formatDateTime } from "@/lib/date/dates";
import { STATUS_META } from "@/lib/domain/meta";
import type { EvaluatedContract, FlagCode } from "@/lib/domain/types";
import type { ReportData, ReportSection } from "@/lib/reports/build";
import { TONE_COLORS } from "@/lib/ui/tones";

/**
 * Renders the weekly report as an HTML email.
 *
 * Email clients ignore stylesheets and most modern CSS, so everything here is
 * inline styles on tables. The colour coding comes from the same tone palette
 * the dashboard uses.
 */
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
const BORDER = "#e2e8f0";
const INK = "#0f172a";
const MUTED = "#64748b";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderReportEmail(data: ReportData, timezone: string): RenderedEmail {
  return {
    subject: buildSubject(data),
    html: renderReportHtml(data, timezone),
    text: renderReportText(data),
  };
}

export function buildSubject(data: ReportData): string {
  const scope = data.scope.kind === "hr" ? "Weekly Contract Report" : `Contract Report — ${data.scope.label}`;
  const count = data.totals.needsAction;
  const tail = count === 0 ? "nothing outstanding" : `${count} requiring attention`;
  return `${scope} — ${formatDate(data.today)} — ${tail}`;
}

export function renderReportHtml(data: ReportData, timezone: string): string {
  const summary = renderSummary(data);
  const sections = data.sections.map((section) => renderSection(section, data)).join("");
  const flags = data.flagSections.length
    ? `<tr><td style="padding:24px 24px 0 24px;">
         <div style="font:600 13px ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Contract limits &amp; rehire eligibility</div>
       </td></tr>${data.flagSections.map((section) => renderSection(section, data)).join("")}`
    : "";

  const nothing = data.hasContent
    ? ""
    : `<tr><td style="padding:24px;">
         <div style="border:1px solid ${TONE_COLORS.success.border};background:${TONE_COLORS.success.bg};color:${TONE_COLORS.success.fg};border-radius:8px;padding:16px;font:400 14px ${FONT};">
           Nothing requires attention this week. All contracts in scope are active and up to date.
         </div>
       </td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(buildSubject(data))}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.12);">
        <tr>
          <td style="background:${INK};padding:24px;">
            <div style="font:600 12px ${FONT};letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;">Trade Kings <span style="color:#5bbaeb;">&middot;</span> Zimkings</div>
            <div style="font:700 22px ${FONT};color:#ffffff;margin-top:6px;">${data.scope.kind === "hr" ? "Weekly Contract Status Report" : "Your Weekly Contract Report"}</div>
            <div style="font:400 14px ${FONT};color:#cbd5e1;margin-top:8px;">${escapeHtml(data.scope.label)} &nbsp;•&nbsp; ${formatDate(data.today)}</div>
          </td>
        </tr>
        ${summary}
        ${nothing}
        ${sections}
        ${flags}
        <tr>
          <td style="padding:24px;border-top:1px solid ${BORDER};">
            <div style="font:400 12px ${FONT};color:${MUTED};line-height:1.6;">
              Generated ${escapeHtml(formatDateTime(data.generatedAt, timezone))} from the contract tracker Google Sheet.
              Contracts stay on this report until the contract information or renewal status is updated.
              ${data.appUrl ? `<br /><a href="${escapeHtml(data.appUrl)}" style="color:#2563eb;">Open the contract tracker</a>` : ""}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderSummary(data: ReportData): string {
  const tiles: { label: string; value: number; tone: keyof typeof TONE_COLORS }[] = [
    { label: "Expired / Overdue", value: data.totals.expiredOrOverdue, tone: "critical" },
    { label: "Expires Today", value: data.totals.expiringToday, tone: "danger" },
    { label: "Within 15 Days", value: data.totals.expiring15, tone: "warning" },
    { label: "Within 30 Days", value: data.totals.expiring30, tone: "caution" },
    { label: "Active", value: data.totals.active, tone: "success" },
  ];

  const cells = tiles
    .map((tile) => {
      const colors = TONE_COLORS[tile.tone];
      return `<td width="20%" style="padding:4px;">
        <div style="border:1px solid ${colors.border};background:${colors.bg};border-radius:8px;padding:12px 10px;text-align:center;">
          <div style="font:700 22px ${FONT};color:${colors.fg};">${tile.value}</div>
          <div style="font:600 11px ${FONT};color:${colors.fg};text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">${escapeHtml(tile.label)}</div>
        </div>
      </td>`;
    })
    .join("");

  return `<tr>
    <td style="padding:20px 20px 4px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
      <div style="font:400 13px ${FONT};color:${MUTED};padding:12px 4px 0 4px;">
        ${data.totals.contracts} employee${data.totals.contracts === 1 ? "" : "s"} in scope · <strong style="color:${INK};">${data.totals.needsAction}</strong> requiring attention
      </div>
    </td>
  </tr>`;
}

function renderSection(section: ReportSection, data: ReportData): string {
  const colors = TONE_COLORS[section.tone];

  if (section.display === "count") {
    return `<tr><td style="padding:8px 24px;">
      <div style="border-left:4px solid ${colors.solid};background:${colors.bg};border-radius:6px;padding:12px 14px;font:400 13px ${FONT};color:${colors.fg};">
        <strong>${escapeHtml(section.title)} · ${section.rows.length}</strong><br />${escapeHtml(section.subtitle)}
      </div>
    </td></tr>`;
  }

  const flagCode = section.key.startsWith("flag-") ? (section.key.slice(5) as FlagCode) : null;

  return `<tr><td style="padding:16px 24px 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-left:4px solid ${colors.solid};padding:0 0 0 10px;">
          <div style="font:700 15px ${FONT};color:${INK};">${escapeHtml(section.title)} <span style="color:${colors.fg};background:${colors.bg};border-radius:10px;padding:2px 8px;font:700 12px ${FONT};">${section.rows.length}</span></div>
          <div style="font:400 12px ${FONT};color:${MUTED};margin-top:2px;">${escapeHtml(section.subtitle)}</div>
        </td>
      </tr>
    </table>
    ${renderTable(section.rows, { showManager: data.scope.kind === "hr", flagCode })}
  </td></tr>`;
}

interface TableOptions {
  showManager: boolean;
  flagCode: FlagCode | null;
}

function renderTable(rows: EvaluatedContract[], options: TableOptions): string {
  const headers = [
    "Employee",
    "Company / Type",
    "Department",
    "End Date",
    "Days",
    "Status",
    options.flagCode ? "Detail" : "Renewal",
    ...(options.showManager ? ["Manager"] : []),
  ];

  const headerCells = headers
    .map(
      (header) =>
        `<th align="left" style="font:600 11px ${FONT};text-transform:uppercase;letter-spacing:.06em;color:${MUTED};padding:8px;border-bottom:1px solid ${BORDER};">${escapeHtml(header)}</th>`,
    )
    .join("");

  const bodyRows = rows.map((contract) => renderRow(contract, options)).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;border-spacing:0;">
    <tr style="background:#f8fafc;">${headerCells}</tr>
    ${bodyRows}
  </table>`;
}

function renderRow(contract: EvaluatedContract, options: TableOptions): string {
  const { computed } = contract;
  const status = STATUS_META[computed.status];
  const colors = TONE_COLORS[status.tone];
  const cell = `font:400 13px ${FONT};color:${INK};padding:8px;border-bottom:1px solid ${BORDER};vertical-align:top;`;

  const detail = options.flagCode
    ? computed.flags.find((flag) => flag.code === options.flagCode)?.detail ??
      defaultFlagDetail(contract, options.flagCode)
    : contract.renewalStatus;

  return `<tr>
    <td style="${cell}">
      <div style="font-weight:600;">${escapeHtml(contract.employeeName || "—")}</div>
      <div style="font-size:11px;color:${MUTED};">${escapeHtml(contract.employeeId || contract.id)}${contract.jobTitle ? ` · ${escapeHtml(contract.jobTitle)}` : ""}</div>
    </td>
    <td style="${cell}">${escapeHtml(contract.company)}<div style="font-size:11px;color:${MUTED};">${escapeHtml(contract.workerType)}</div></td>
    <td style="${cell}">${escapeHtml(contract.department || "—")}<div style="font-size:11px;color:${MUTED};">${escapeHtml(contract.costCentre || "")}</div></td>
    <td style="${cell};white-space:nowrap;">${formatDate(contract.endDate)}</td>
    <td style="${cell};white-space:nowrap;font-weight:600;color:${colors.fg};">${escapeHtml(describeDays(computed.daysRemaining))}</td>
    <td style="${cell};white-space:nowrap;">
      <span style="display:inline-block;background:${colors.bg};color:${colors.fg};border:1px solid ${colors.border};border-radius:10px;padding:2px 8px;font:600 11px ${FONT};">${escapeHtml(status.label)}</span>
    </td>
    <td style="${cell}">${escapeHtml(detail || "—")}</td>
    ${options.showManager ? `<td style="${cell}">${escapeHtml(contract.manager || "—")}<div style="font-size:11px;color:${MUTED};">${escapeHtml(contract.managerEmail || "no email")}</div></td>` : ""}
  </tr>`;
}

function defaultFlagDetail(contract: EvaluatedContract, code: FlagCode): string {
  const { computed } = contract;
  if (code === "CASUAL_WAITING_PERIOD" || code === "CASUAL_ELIGIBLE_FOR_REHIRE") {
    return computed.rehireEligibleDate
      ? `Rehire from ${formatDate(computed.rehireEligibleDate)}`
      : "Eligible now";
  }
  return `Contract ${computed.contractNumber}`;
}

export function renderReportText(data: ReportData): string {
  const lines: string[] = [
    `${data.appName} — ${data.scope.kind === "hr" ? "Weekly Contract Status Report" : "Weekly Contract Report"}`,
    `${data.scope.label} · ${formatDate(data.today)}`,
    "",
    `Expired/Overdue: ${data.totals.expiredOrOverdue} | Expires today: ${data.totals.expiringToday} | Within 15 days: ${data.totals.expiring15} | Within 30 days: ${data.totals.expiring30} | Active: ${data.totals.active}`,
    `${data.totals.needsAction} of ${data.totals.contracts} employees require attention.`,
    "",
  ];

  const appendSection = (section: ReportSection) => {
    if (section.display === "count") {
      lines.push(`${section.title}: ${section.rows.length} — ${section.subtitle}`, "");
      return;
    }
    lines.push(`${section.title} (${section.rows.length})`);
    for (const contract of section.rows) {
      lines.push(
        `  - ${contract.employeeName} [${contract.employeeId || contract.id}] ${contract.company}/${contract.workerType} — ends ${formatDate(contract.endDate)} (${describeDays(contract.computed.daysRemaining)}) — ${STATUS_META[contract.computed.status].label}`,
      );
    }
    lines.push("");
  };

  data.sections.forEach(appendSection);
  if (data.flagSections.length) {
    lines.push("CONTRACT LIMITS & REHIRE ELIGIBILITY", "");
    data.flagSections.forEach(appendSection);
  }
  if (!data.hasContent) lines.push("Nothing requires attention this week.", "");
  if (data.appUrl) lines.push(`Open the contract tracker: ${data.appUrl}`);

  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
