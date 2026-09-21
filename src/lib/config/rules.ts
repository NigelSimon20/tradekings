import type { Company, RuleSetId, WorkerType } from "@/lib/domain/types";

/**
 * The contract rules from the Trade Kings / Zimkings specification, in one
 * place. Everything the rules engine does is driven by this file — change a
 * number here and the dashboard, sheet write-back and weekly emails follow.
 */
export interface RuleSet {
  id: RuleSetId;
  label: string;
  /** Default contract length offered in the UI, in months. */
  standardTermMonths: number | null;
  /** Default contract length offered in the UI, in days (casuals). */
  standardTermDays: number | null;
  /** Hard cap on contract length; contracts longer than this are flagged. */
  maxTermMonths: number | null;
  /** Maximum number of contracts per employee; null = unlimited renewals. */
  maxContracts: number | null;
  /** Contract count at which the employee is "approaching" the limit. */
  approachingAtCount: number | null;
  /** Window the contract limit is measured over, in weeks (casuals). */
  limitWindowWeeks: number | null;
  /** Months out of the system before a rehire is allowed (casuals). */
  waitingPeriodMonths: number | null;
  /** Plain-English rules shown on the Settings page. */
  summary: string[];
}

export const RULE_SETS: Record<RuleSetId, RuleSet> = {
  TK_BLUE_COLLAR: {
    id: "TK_BLUE_COLLAR",
    label: "Trade Kings — Blue Collar",
    standardTermMonths: 6,
    standardTermDays: null,
    maxTermMonths: null,
    maxContracts: null,
    approachingAtCount: null,
    limitWindowWeeks: null,
    waitingPeriodMonths: null,
    summary: [
      "Standard blue-collar contract: 6 months.",
      "Contract renewals: unlimited.",
      "Alerts at 30 days, 15 days, on expiry and once overdue.",
    ],
  },
  ZK_BLUE_COLLAR: {
    id: "ZK_BLUE_COLLAR",
    label: "Zimkings — Blue Collar",
    standardTermMonths: 12,
    standardTermDays: null,
    maxTermMonths: 12,
    maxContracts: 5,
    approachingAtCount: 4,
    limitWindowWeeks: null,
    waitingPeriodMonths: null,
    summary: [
      "Maximum fixed-term contract duration: 1 year.",
      "Maximum of 5 contracts per employee.",
      "Employees on contract 4 are flagged as approaching the limit.",
      "Alerts at 30 days, 15 days, on expiry and once overdue.",
    ],
  },
  CASUAL: {
    id: "CASUAL",
    label: "Casual Employees — Trade Kings & Zimkings",
    standardTermMonths: null,
    standardTermDays: 7,
    maxTermMonths: null,
    maxContracts: 6,
    approachingAtCount: 5,
    limitWindowWeeks: 6,
    waitingPeriodMonths: 3,
    summary: [
      "Contracts are issued weekly.",
      "Maximum of 6 contracts within a 6-week period.",
      "After 6 contracts the employee is out of the system for 3 months.",
      "The next eligible rehire date is calculated automatically.",
      "Casual contracts and renewals are monitored weekly.",
    ],
  },
};

/** Days before expiry at which a contract is escalated. */
export const ALERT_DAYS = {
  first: 30,
  second: 15,
} as const;

/**
 * An expired contract becomes "Overdue" once it has been past its end date for
 * this many days without HR updating it.
 */
export const OVERDUE_AFTER_DAYS = 7;

export function resolveRuleSetId(company: Company, workerType: WorkerType): RuleSetId {
  if (workerType === "Casual") return "CASUAL";
  return company === "Zimkings" ? "ZK_BLUE_COLLAR" : "TK_BLUE_COLLAR";
}

export function resolveRuleSet(company: Company, workerType: WorkerType): RuleSet {
  return RULE_SETS[resolveRuleSetId(company, workerType)];
}

/**
 * Default end date for a new contract, following the rule set for the employee.
 * A 6 month contract starting 1 Jan ends 30 Jun (the day before the anniversary).
 */
export function defaultEndDateOffset(ruleSet: RuleSet): { months: number; days: number } {
  if (ruleSet.standardTermDays !== null) {
    return { months: 0, days: ruleSet.standardTermDays - 1 };
  }
  return { months: ruleSet.standardTermMonths ?? 6, days: -1 };
}
