import type {
  ContractStatus,
  FlagCode,
  LimitStatus,
  RehireStatus,
  RenewalStatus,
} from "@/lib/domain/types";

/**
 * Severity vocabulary shared by the dashboard, the contracts table and the
 * weekly emails, so a colour means the same thing everywhere.
 */
export const TONES = [
  "critical",
  "danger",
  "warning",
  "caution",
  "success",
  "info",
  "neutral",
] as const;
export type Tone = (typeof TONES)[number];

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** 1 = most urgent. Used for sorting and report ordering. */
  priority: number;
  description: string;
}

export const STATUS_META: Record<ContractStatus, StatusMeta> = {
  OVERDUE: {
    label: "Overdue",
    tone: "critical",
    priority: 1,
    description: "Past the end date and still not actioned.",
  },
  EXPIRED: {
    label: "Expired",
    tone: "danger",
    priority: 2,
    description: "The end date has passed.",
  },
  EXPIRES_TODAY: {
    label: "Expires Today",
    tone: "danger",
    priority: 3,
    description: "The contract ends today.",
  },
  EXPIRING_15: {
    label: "Expiring ≤ 15 Days",
    tone: "warning",
    priority: 4,
    description: "Inside the 15 day renewal window.",
  },
  EXPIRING_30: {
    label: "Expiring ≤ 30 Days",
    tone: "caution",
    priority: 5,
    description: "Inside the 30 day renewal window.",
  },
  ACTIVE: {
    label: "Active",
    tone: "success",
    priority: 6,
    description: "Running with more than 30 days to go.",
  },
  NOT_STARTED: {
    label: "Not Started",
    tone: "info",
    priority: 7,
    description: "Captured, but the start date is in the future.",
  },
  RENEWED: {
    label: "Renewed",
    tone: "neutral",
    priority: 8,
    description: "A follow-on contract has been captured for this employee.",
  },
  CLOSED: {
    label: "Closed",
    tone: "neutral",
    priority: 9,
    description: "Ended and no further action is required.",
  },
  INVALID: {
    label: "Check Dates",
    tone: "critical",
    priority: 0,
    description: "The start or end date is missing or invalid.",
  },
};

export const LIMIT_STATUS_META: Record<LimitStatus, StatusMeta> = {
  NOT_APPLICABLE: {
    label: "Unlimited",
    tone: "neutral",
    priority: 4,
    description: "No contract limit applies.",
  },
  WITHIN_LIMIT: {
    label: "Within Limit",
    tone: "success",
    priority: 3,
    description: "Comfortably inside the contract limit.",
  },
  APPROACHING_LIMIT: {
    label: "Approaching Limit",
    tone: "warning",
    priority: 2,
    description: "One contract away from the limit.",
  },
  LIMIT_REACHED: {
    label: "Limit Reached",
    tone: "critical",
    priority: 1,
    description: "The contract limit has been reached.",
  },
  LIMIT_EXCEEDED: {
    label: "Limit Exceeded",
    tone: "critical",
    priority: 0,
    description: "More contracts than the rules allow.",
  },
};

export const REHIRE_STATUS_META: Record<RehireStatus, StatusMeta> = {
  NOT_APPLICABLE: {
    label: "—",
    tone: "neutral",
    priority: 4,
    description: "Rehire rules only apply to casual employees.",
  },
  IN_CONTRACT: {
    label: "In Contract",
    tone: "info",
    priority: 3,
    description: "Currently engaged and still under the contract limit.",
  },
  NOT_ELIGIBLE: {
    label: "Not Eligible",
    tone: "critical",
    priority: 1,
    description: "Contract limit reached — inside the 3 month waiting period.",
  },
  ELIGIBLE: {
    label: "Eligible for Rehire",
    tone: "success",
    priority: 2,
    description: "May be engaged again.",
  },
};

export const RENEWAL_STATUS_META: Record<RenewalStatus, { tone: Tone }> = {
  Pending: { tone: "caution" },
  "In Progress": { tone: "info" },
  Renewed: { tone: "success" },
  "Not Renewing": { tone: "neutral" },
  Terminated: { tone: "neutral" },
};

export interface FlagMeta {
  label: string;
  tone: Tone;
  /** Short line used as the section subtitle in the weekly report. */
  description: string;
}

export const FLAG_META: Record<FlagCode, FlagMeta> = {
  ZIM_LIMIT_APPROACHING: {
    label: "Zimkings — Approaching 5 Contract Limit",
    tone: "warning",
    description: "On contract 4 of 5. Plan the next step before the renewal falls due.",
  },
  ZIM_LIMIT_REACHED: {
    label: "Zimkings — 5 Contract Limit Reached",
    tone: "critical",
    description: "No further fixed-term renewals are allowed under the Zimkings rules.",
  },
  ZIM_TERM_EXCEEDS_MAX: {
    label: "Zimkings — Contract Longer Than 1 Year",
    tone: "critical",
    description: "Fixed-term contracts may not exceed the 1 year maximum.",
  },
  CASUAL_LIMIT_APPROACHING: {
    label: "Casual — Approaching 6 Contract Limit",
    tone: "warning",
    description: "On contract 5 of 6 within the 6 week period.",
  },
  CASUAL_LIMIT_REACHED: {
    label: "Casual — 6 Contract Limit Reached",
    tone: "critical",
    description: "The 6 contract limit has been reached — the 3 month break applies.",
  },
  CASUAL_WAITING_PERIOD: {
    label: "Casual — Within 3 Month Waiting Period",
    tone: "info",
    description: "Out of the system until the rehire eligibility date.",
  },
  CASUAL_ELIGIBLE_FOR_REHIRE: {
    label: "Casual — Eligible for Rehire",
    tone: "success",
    description: "Available to be engaged again.",
  },
  CASUAL_REHIRED_DURING_WAIT: {
    label: "Casual — Rehired Before Waiting Period Ended",
    tone: "critical",
    description: "A contract was captured before the 3 month break was complete.",
  },
  RENEWAL_NOT_CAPTURED: {
    label: "Renewal Not Captured",
    tone: "warning",
    description: "Marked as renewed, but no follow-on contract row exists.",
  },
  MISSING_MANAGER_EMAIL: {
    label: "No Manager Email",
    tone: "warning",
    description: "This employee cannot be included in any manager report.",
  },
  MISSING_EMPLOYEE_ID: {
    label: "No Employee ID",
    tone: "warning",
    description: "Contract history cannot be linked without an employee ID.",
  },
  INVALID_DATES: {
    label: "Check Contract Dates",
    tone: "critical",
    description: "The start or end date is missing or invalid.",
  },
};

/** Flags that point at a data problem rather than a contract decision. */
export const DATA_QUALITY_FLAGS: readonly FlagCode[] = [
  "INVALID_DATES",
  "MISSING_EMPLOYEE_ID",
  "MISSING_MANAGER_EMAIL",
  "RENEWAL_NOT_CAPTURED",
];

/** How a run was started, in words rather than scheduler jargon. */
export const TRIGGER_LABELS = {
  cron: "Automatic",
  manual: "Started by hand",
} as const;

/** Sheet column types, written the way they appear to someone filling them in. */
export const COLUMN_TYPE_LABELS = {
  text: "Text",
  date: "Date",
  number: "Number",
  datetime: "Date & time",
} as const;

export function statusLabel(status: ContractStatus): string {
  return STATUS_META[status].label;
}

export function flagLabel(code: FlagCode): string {
  return FLAG_META[code].label;
}
