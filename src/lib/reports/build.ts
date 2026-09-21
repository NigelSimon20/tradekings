import { FLAG_META, STATUS_META, type Tone } from "@/lib/domain/meta";
import { sortByUrgency } from "@/lib/domain/filters";
import type { ContractStatus, EvaluatedContract, FlagCode } from "@/lib/domain/types";
import type { ISODate } from "@/lib/date/dates";

export interface ReportScope {
  kind: "hr" | "manager";
  /** Shown in the email header, e.g. "All employees" or the manager's name. */
  label: string;
  recipient: string;
}

export interface ReportSection {
  key: string;
  title: string;
  subtitle: string;
  tone: Tone;
  rows: EvaluatedContract[];
  /** `count` renders as a single summary line instead of a table. */
  display: "table" | "count";
}

export interface ReportTotals {
  contracts: number;
  active: number;
  needsAction: number;
  expiredOrOverdue: number;
  expiringToday: number;
  expiring15: number;
  expiring30: number;
}

export interface ReportData {
  scope: ReportScope;
  today: ISODate;
  generatedAt: string;
  appName: string;
  appUrl: string;
  totals: ReportTotals;
  /** Priority sections: expired, today, 15 days, 30 days, active. */
  sections: ReportSection[];
  /** Contract-limit and rehire flags. */
  flagSections: ReportSection[];
  /** True when there is something the recipient must act on. */
  hasContent: boolean;
}

/** Priority order from the specification. */
const PRIORITY_GROUPS: { key: string; title: string; statuses: ContractStatus[] }[] = [
  { key: "expired", title: "Expired / Overdue", statuses: ["OVERDUE", "EXPIRED"] },
  { key: "today", title: "Expires Today", statuses: ["EXPIRES_TODAY"] },
  { key: "expiring-15", title: "Expiring Within 15 Days", statuses: ["EXPIRING_15"] },
  { key: "expiring-30", title: "Expiring Within 30 Days", statuses: ["EXPIRING_30"] },
];

/** Flag sections, in the order they appear in the weekly email. */
const FLAG_ORDER: FlagCode[] = [
  "ZIM_LIMIT_REACHED",
  "ZIM_LIMIT_APPROACHING",
  "CASUAL_LIMIT_REACHED",
  "CASUAL_LIMIT_APPROACHING",
  "CASUAL_WAITING_PERIOD",
  "CASUAL_ELIGIBLE_FOR_REHIRE",
  "ZIM_TERM_EXCEEDS_MAX",
  "CASUAL_REHIRED_DURING_WAIT",
  "RENEWAL_NOT_CAPTURED",
  "INVALID_DATES",
  "MISSING_EMPLOYEE_ID",
  "MISSING_MANAGER_EMAIL",
];

export interface BuildReportOptions {
  scope: ReportScope;
  today: ISODate;
  appName: string;
  appUrl: string;
  generatedAt?: string;
}

/**
 * Turns the current contract list into the structure the weekly email renders.
 * Pure data — no HTML, no sending — so the same report can be previewed in the
 * browser and emailed without any chance of the two differing.
 */
export function buildReport(
  contracts: EvaluatedContract[],
  options: BuildReportOptions,
): ReportData {
  const sorted = sortByUrgency(contracts);
  const actionable = sorted.filter((contract) => contract.computed.needsAction);

  const sections: ReportSection[] = PRIORITY_GROUPS.map((group) => {
    const rows = actionable.filter((contract) => group.statuses.includes(contract.computed.status));
    return {
      key: group.key,
      title: group.title,
      subtitle: STATUS_META[group.statuses[0]].description,
      tone: STATUS_META[group.statuses[0]].tone,
      rows,
      display: "table" as const,
    };
  }).filter((section) => section.rows.length > 0);

  const active = sorted.filter(
    (contract) => contract.computed.isInForce && !contract.computed.needsAction,
  );
  if (active.length) {
    sections.push({
      key: "active",
      title: "Active — no action required",
      subtitle: "Running, with the renewal decision either not yet due or already made.",
      tone: "success",
      rows: active,
      display: "count",
    });
  }

  const flagSections: ReportSection[] = FLAG_ORDER.map((code) => {
    const rows = sorted.filter((contract) =>
      contract.computed.flags.some((flag) => flag.code === code),
    );
    return {
      key: `flag-${code}`,
      title: FLAG_META[code].label,
      subtitle: FLAG_META[code].description,
      tone: FLAG_META[code].tone,
      rows,
      display: "table" as const,
    };
  }).filter((section) => section.rows.length > 0);

  const countStatus = (...statuses: ContractStatus[]) =>
    contracts.filter((contract) => statuses.includes(contract.computed.status)).length;

  return {
    scope: options.scope,
    today: options.today,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    appName: options.appName,
    appUrl: options.appUrl,
    totals: {
      contracts: contracts.length,
      active: contracts.filter((contract) => contract.computed.isInForce).length,
      needsAction: actionable.length,
      expiredOrOverdue: countStatus("EXPIRED", "OVERDUE"),
      expiringToday: countStatus("EXPIRES_TODAY"),
      expiring15: countStatus("EXPIRING_15"),
      expiring30: countStatus("EXPIRING_30"),
    },
    sections,
    flagSections,
    hasContent: actionable.length > 0 || flagSections.length > 0,
  };
}

/** Groups the current contracts by manager email for the filtered reports. */
export function groupByManager(
  contracts: EvaluatedContract[],
): { email: string; name: string; contracts: EvaluatedContract[] }[] {
  const groups = new Map<string, { email: string; name: string; contracts: EvaluatedContract[] }>();

  for (const contract of contracts) {
    const email = contract.managerEmail.trim().toLowerCase();
    if (!email) continue;
    const group = groups.get(email) ?? { email, name: contract.manager || email, contracts: [] };
    group.contracts.push(contract);
    groups.set(email, group);
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
