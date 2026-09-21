import type { ISODate } from "@/lib/date/dates";

/** Companies covered by the tracker. */
export const COMPANIES = ["Trade Kings", "Zimkings"] as const;
export type Company = (typeof COMPANIES)[number];

/** Worker type / employee category (also used as the "Employment Type" filter). */
export const WORKER_TYPES = ["Blue Collar", "Casual"] as const;
export type WorkerType = (typeof WORKER_TYPES)[number];

/** Why this contract exists. */
export const CONTRACT_TYPES = ["New", "Renewal", "Rehire"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/**
 * What HR has decided about the contract. The tracker keeps a contract in the
 * weekly report until this moves off "Pending"/"In Progress" (or a follow-on
 * contract row is captured).
 */
export const RENEWAL_STATUSES = [
  "Pending",
  "In Progress",
  "Renewed",
  "Not Renewing",
  "Terminated",
] as const;
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

/** Renewal decisions that stop a contract from needing further action. */
export const RESOLVED_RENEWAL_STATUSES: readonly RenewalStatus[] = [
  "Renewed",
  "Not Renewing",
  "Terminated",
];

/** Calculated contract status, most urgent first. */
export const CONTRACT_STATUSES = [
  "OVERDUE",
  "EXPIRED",
  "EXPIRES_TODAY",
  "EXPIRING_15",
  "EXPIRING_30",
  "ACTIVE",
  "NOT_STARTED",
  "RENEWED",
  "CLOSED",
  "INVALID",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** Statuses that put a contract on the weekly "requires attention" list. */
export const ATTENTION_STATUSES: readonly ContractStatus[] = [
  "OVERDUE",
  "EXPIRED",
  "EXPIRES_TODAY",
  "EXPIRING_15",
  "EXPIRING_30",
];

export const LIMIT_STATUSES = [
  "NOT_APPLICABLE",
  "WITHIN_LIMIT",
  "APPROACHING_LIMIT",
  "LIMIT_REACHED",
  "LIMIT_EXCEEDED",
] as const;
export type LimitStatus = (typeof LIMIT_STATUSES)[number];

export const REHIRE_STATUSES = [
  "NOT_APPLICABLE",
  "IN_CONTRACT",
  "NOT_ELIGIBLE",
  "ELIGIBLE",
] as const;
export type RehireStatus = (typeof REHIRE_STATUSES)[number];

export const FLAG_CODES = [
  "ZIM_LIMIT_APPROACHING",
  "ZIM_LIMIT_REACHED",
  "ZIM_TERM_EXCEEDS_MAX",
  "CASUAL_LIMIT_APPROACHING",
  "CASUAL_LIMIT_REACHED",
  "CASUAL_WAITING_PERIOD",
  "CASUAL_ELIGIBLE_FOR_REHIRE",
  "CASUAL_REHIRED_DURING_WAIT",
  "RENEWAL_NOT_CAPTURED",
  "MISSING_MANAGER_EMAIL",
  "MISSING_EMPLOYEE_ID",
  "INVALID_DATES",
] as const;
export type FlagCode = (typeof FLAG_CODES)[number];

export interface ContractFlag {
  code: FlagCode;
  /** Row specific explanation, e.g. "Contract 5 of 5". */
  detail?: string;
}

/** A single contract row exactly as it is captured in the Google Sheet. */
export interface Contract {
  id: string;
  /** 1-based row number in the sheet; absent for the local data source. */
  rowNumber?: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  company: Company;
  workerType: WorkerType;
  department: string;
  costCentre: string;
  jobTitle: string;
  contractType: ContractType;
  startDate: ISODate | null;
  endDate: ISODate | null;
  /** Sequence number of this contract for the employee, when HR captures it. */
  contractNumber: number | null;
  renewalStatus: RenewalStatus;
  hrPerson: string;
  hrEmail: string;
  manager: string;
  managerEmail: string;
  location: string;
  notes: string;
  /** ISO datetime of the last write by this system. */
  lastUpdated: string | null;
}

/** Fields the UI writes. Everything else is calculated. */
export type ContractInput = Omit<Contract, "id" | "rowNumber" | "lastUpdated"> & {
  id?: string;
};

/** Everything the rules engine derives for a contract row. */
export interface ContractComputed {
  ruleSetId: RuleSetId;
  /** Days until the end date; negative once it has passed. */
  daysRemaining: number | null;
  /** Length of the contract in days. */
  termDays: number | null;
  status: ContractStatus;
  /** Sequence of this contract for the employee (or casual cycle). */
  contractNumber: number;
  /** Total contracts for the employee (casuals: within the current cycle). */
  contractCount: number;
  /** Contracts still available before the limit is hit; null when unlimited. */
  contractsRemaining: number | null;
  limitStatus: LimitStatus;
  rehireEligibleDate: ISODate | null;
  rehireStatus: RehireStatus;
  flags: ContractFlag[];
  /** Still needs an HR/manager decision — drives the weekly report. */
  needsAction: boolean;
  /** Latest contract row for this employee. */
  isLatest: boolean;
  /** Today falls inside the contract period. */
  isInForce: boolean;
}

export type EvaluatedContract = Contract & { computed: ContractComputed };

export type RuleSetId = "TK_BLUE_COLLAR" | "ZK_BLUE_COLLAR" | "CASUAL";

/** One line of the summary view written into the Google Sheet. */
export interface DashboardRow {
  label: string;
  count: number;
  /** Saved view this row corresponds to, for the link back into the app. */
  viewId: string;
}

export interface DashboardCompanyRow {
  company: string;
  workerType: string;
  total: number;
  active: number;
  needsAction: number;
}

/**
 * The dashboard the specification asks for inside the Google Sheet. It is
 * rebuilt from the contract data on every system check.
 */
export interface DashboardSummary {
  today: string;
  generatedAt: string;
  rows: DashboardRow[];
  byCompany: DashboardCompanyRow[];
  appUrl: string;
  /** Employees in the database (current contracts only). */
  employees: number;
}

/** Report settings an administrator can change in the sheet. */
export interface ReportSettings {
  hrRecipient: string;
  reportCc: string[];
  managerReportsEnabled: boolean;
  skipEmptyManagerReports: boolean;
  /** Which of the above came from the Google Sheet rather than the environment. */
  fromSheet: string[];
}

export interface RunLogEntry {
  id: string;
  /** ISO datetime. */
  runAt: string;
  type: "weekly-report" | "system-check";
  trigger: "cron" | "manual";
  mode: "send" | "preview";
  recipients: number;
  emailsSent: number;
  rowsChecked: number;
  needsAction: number;
  errors: string[];
  note: string;
}
