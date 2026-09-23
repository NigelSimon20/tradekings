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

/** Every number the rules engine uses, in one object. */
export interface RulesConfig {
  ruleSets: Record<RuleSetId, RuleSet>;
  /** Days before expiry at which a contract is escalated. */
  alertDays: { first: number; second: number };
  /** Days past the end date before an expired contract becomes overdue. */
  overdueAfterDays: number;
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

/** The rules as shipped. An administrator can override the numbers in the sheet. */
export const DEFAULT_RULES: RulesConfig = {
  ruleSets: RULE_SETS,
  alertDays: { first: ALERT_DAYS.first, second: ALERT_DAYS.second },
  overdueAfterDays: 7,
};

/**
 * Applies the numbers an administrator has typed on the sheet's Settings tab.
 * A blank or unusable value keeps the shipped default, so a typo can never
 * switch a rule off.
 */
export function applyRuleOverrides(overrides: Record<string, string>): RulesConfig {
  const number = (key: string, fallback: number | null): number | null => {
    const raw = overrides[key]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
  };

  const tk = RULE_SETS.TK_BLUE_COLLAR;
  const zk = RULE_SETS.ZK_BLUE_COLLAR;
  const casual = RULE_SETS.CASUAL;

  const config: RulesConfig = {
    ruleSets: {
      TK_BLUE_COLLAR: {
        ...tk,
        standardTermMonths: number("tkTermMonths", tk.standardTermMonths),
      },
      ZK_BLUE_COLLAR: {
        ...zk,
        standardTermMonths: number("zkMaxTermMonths", zk.standardTermMonths),
        maxTermMonths: number("zkMaxTermMonths", zk.maxTermMonths),
        maxContracts: number("zkMaxContracts", zk.maxContracts),
      },
      CASUAL: {
        ...casual,
        standardTermDays: number("casualTermDays", casual.standardTermDays),
        maxContracts: number("casualMaxContracts", casual.maxContracts),
        limitWindowWeeks: number("casualWindowWeeks", casual.limitWindowWeeks),
        waitingPeriodMonths: number("casualWaitMonths", casual.waitingPeriodMonths),
      },
    },
    alertDays: {
      first: number("firstAlertDays", ALERT_DAYS.first) ?? ALERT_DAYS.first,
      second: number("secondAlertDays", ALERT_DAYS.second) ?? ALERT_DAYS.second,
    },
    overdueAfterDays: number("overdueAfterDays", 7) ?? 7,
  };

  // "Approaching the limit" always means one contract short of it.
  for (const ruleSet of Object.values(config.ruleSets)) {
    ruleSet.approachingAtCount = ruleSet.maxContracts === null ? null : Math.max(1, ruleSet.maxContracts - 1);
    ruleSet.summary = describeRules(ruleSet, config);
  }

  return config;
}

/** The plain-English rules shown in the app, rebuilt from the current numbers. */
function describeRules(ruleSet: RuleSet, config: RulesConfig): string[] {
  const alerts = `Alerts at ${config.alertDays.first} days, ${config.alertDays.second} days, on expiry and once overdue.`;

  if (ruleSet.id === "CASUAL") {
    return [
      `Contracts are issued every ${ruleSet.standardTermDays} days.`,
      `Maximum of ${ruleSet.maxContracts} contracts within a ${ruleSet.limitWindowWeeks} week period.`,
      `After ${ruleSet.maxContracts} contracts the employee is out of the system for ${ruleSet.waitingPeriodMonths} months.`,
      "The next eligible rehire date is calculated automatically.",
      "Casual contracts and renewals are monitored weekly.",
    ];
  }

  if (ruleSet.maxContracts === null) {
    return [
      `Standard blue-collar contract: ${ruleSet.standardTermMonths} months.`,
      "Contract renewals: unlimited.",
      alerts,
    ];
  }

  return [
    `Maximum fixed-term contract duration: ${ruleSet.maxTermMonths} months.`,
    `Maximum of ${ruleSet.maxContracts} contracts per employee.`,
    `Employees on contract ${ruleSet.approachingAtCount} are flagged as approaching the limit.`,
    alerts,
  ];
}

export function resolveRuleSetId(company: Company, workerType: WorkerType): RuleSetId {
  if (workerType === "Casual") return "CASUAL";
  return company === "Zimkings" ? "ZK_BLUE_COLLAR" : "TK_BLUE_COLLAR";
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
