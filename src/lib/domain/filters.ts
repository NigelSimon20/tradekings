import { STATUS_META } from "@/lib/domain/meta";
import { getView } from "@/lib/domain/views";
import type { ContractStatus, EvaluatedContract, FlagCode } from "@/lib/domain/types";

/** Every filter the contracts list supports, as it appears in the URL. */
export interface ContractFilters {
  view: string;
  q: string;
  company: string;
  workerType: string;
  department: string;
  costCentre: string;
  manager: string;
  contractType: string;
  status: string;
  days: string;
  flag: string;
  location: string;
  /** Include superseded (renewed) contract history. */
  history: boolean;
  page: number;
}

export const EMPTY_FILTERS: ContractFilters = {
  view: "",
  q: "",
  company: "",
  workerType: "",
  department: "",
  costCentre: "",
  manager: "",
  contractType: "",
  status: "",
  days: "",
  flag: "",
  location: "",
  history: false,
  page: 1,
};

/** Days-remaining ranges offered in the filter bar. */
export const DAYS_BUCKETS: { value: string; label: string; matches: (days: number | null) => boolean }[] = [
  { value: "overdue", label: "Already expired", matches: (days) => days !== null && days < 0 },
  { value: "0", label: "Expires today", matches: (days) => days === 0 },
  { value: "7", label: "0 – 7 days", matches: (days) => days !== null && days >= 0 && days <= 7 },
  { value: "15", label: "0 – 15 days", matches: (days) => days !== null && days >= 0 && days <= 15 },
  { value: "30", label: "0 – 30 days", matches: (days) => days !== null && days >= 0 && days <= 30 },
  { value: "60", label: "0 – 60 days", matches: (days) => days !== null && days >= 0 && days <= 60 },
  { value: "60+", label: "More than 60 days", matches: (days) => days !== null && days > 60 },
];

export type SearchParamsInput = Record<string, string | string[] | undefined>;

function single(params: SearchParamsInput, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseFilters(params: SearchParamsInput): ContractFilters {
  const page = Number(single(params, "page"));
  return {
    view: single(params, "view"),
    q: single(params, "q"),
    company: single(params, "company"),
    workerType: single(params, "workerType"),
    department: single(params, "department"),
    costCentre: single(params, "costCentre"),
    manager: single(params, "manager"),
    contractType: single(params, "contractType"),
    status: single(params, "status"),
    days: single(params, "days"),
    flag: single(params, "flag"),
    location: single(params, "location"),
    history: ["1", "true", "on"].includes(single(params, "history").toLowerCase()),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/** Turns filters back into a query string, dropping anything left at default. */
export function toSearchParams(filters: Partial<ContractFilters>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (key === "page" && value === 1) continue;
    params.set(key, value === true ? "1" : String(value));
  }
  return params;
}

export function countActiveFilters(filters: ContractFilters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof ContractFilters)[]).filter((key) => {
    if (key === "page") return false;
    return filters[key] !== EMPTY_FILTERS[key];
  }).length;
}

function matchesSearch(contract: EvaluatedContract, term: string): boolean {
  const haystack = [
    contract.employeeName,
    contract.employeeId,
    contract.id,
    contract.jobTitle,
    contract.department,
    contract.costCentre,
    contract.manager,
    contract.managerEmail,
    contract.location,
    contract.notes,
  ]
    .join(" ")
    .toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function applyFilters(
  contracts: EvaluatedContract[],
  filters: ContractFilters,
): EvaluatedContract[] {
  const view = getView(filters.view);
  const bucket = DAYS_BUCKETS.find((entry) => entry.value === filters.days);

  return contracts.filter((contract) => {
    const { computed } = contract;
    // Superseded history is hidden unless explicitly requested. Rows that need
    // fixing in the sheet stay visible either way.
    if (!filters.history && !computed.isLatest && computed.status === "RENEWED") return false;
    if (view && !view.matches(contract)) return false;
    if (filters.company && contract.company !== filters.company) return false;
    if (filters.workerType && contract.workerType !== filters.workerType) return false;
    if (filters.department && contract.department !== filters.department) return false;
    if (filters.costCentre && contract.costCentre !== filters.costCentre) return false;
    if (filters.location && contract.location !== filters.location) return false;
    if (filters.manager && contract.managerEmail.toLowerCase() !== filters.manager.toLowerCase()) {
      return false;
    }
    if (filters.contractType && contract.contractType !== filters.contractType) return false;
    if (filters.status && computed.status !== (filters.status as ContractStatus)) return false;
    if (filters.flag && !computed.flags.some((flag) => flag.code === (filters.flag as FlagCode))) {
      return false;
    }
    if (bucket && !bucket.matches(computed.daysRemaining)) return false;
    if (filters.q && !matchesSearch(contract, filters.q)) return false;
    return true;
  });
}

/** Most urgent first, then soonest expiry, then name. */
export function sortByUrgency(contracts: EvaluatedContract[]): EvaluatedContract[] {
  return [...contracts].sort((a, b) => {
    const priority = STATUS_META[a.computed.status].priority - STATUS_META[b.computed.status].priority;
    if (priority !== 0) return priority;
    const daysA = a.computed.daysRemaining ?? Number.MAX_SAFE_INTEGER;
    const daysB = b.computed.daysRemaining ?? Number.MAX_SAFE_INTEGER;
    if (daysA !== daysB) return daysA - daysB;
    return a.employeeName.localeCompare(b.employeeName);
  });
}

export interface FilterOptions {
  departments: string[];
  costCentres: string[];
  locations: string[];
  managers: { name: string; email: string }[];
}

/** Distinct values for the filter dropdowns, taken from the data itself. */
export function buildFilterOptions(contracts: EvaluatedContract[]): FilterOptions {
  const departments = new Set<string>();
  const costCentres = new Set<string>();
  const locations = new Set<string>();
  const managers = new Map<string, string>();

  for (const contract of contracts) {
    if (contract.department) departments.add(contract.department);
    if (contract.costCentre) costCentres.add(contract.costCentre);
    if (contract.location) locations.add(contract.location);
    const email = contract.managerEmail.trim().toLowerCase();
    if (email && !managers.has(email)) managers.set(email, contract.manager || email);
  }

  const sort = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b));

  return {
    departments: sort(departments),
    costCentres: sort(costCentres),
    locations: sort(locations),
    managers: [...managers.entries()]
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
