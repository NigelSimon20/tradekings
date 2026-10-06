import type { ISODate } from "@/lib/date/dates";
import type { SearchParamsInput } from "@/lib/domain/filters";
import { ACTION_VIEWS, EXPIRY_VIEWS, PEOPLE_VIEWS, findView } from "@/lib/expats/views";
import {
  OPEN_ACTION,
  RIGHT_TO_WORK_TYPES,
  type EvaluatedExpat,
  type ExpiryItem,
  type FollowUp,
} from "@/lib/expats/types";

/**
 * Search and filters for the expat list, the master expiry view and the
 * follow-ups — the brief's list. Filters live in the URL, so a list can be
 * bookmarked, shared and exported exactly as it is on screen.
 */

function reader(params: SearchParamsInput) {
  return (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
}

function parse<K extends string>(keys: readonly K[], params: SearchParamsInput): Record<K, string> {
  const single = reader(params);
  return Object.fromEntries(keys.map((key) => [key, single(key)])) as Record<K, string>;
}

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const same = (a: string | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
const matchesAll = (terms: string[], parts: (string | null | undefined)[]) => {
  if (!terms.length) return true;
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  return terms.every((term) => text.includes(term));
};

// ---------------------------------------------------------------------------
// The expat list.
// ---------------------------------------------------------------------------

export const PEOPLE_FILTER_KEYS = [
  "view",
  "q",
  "company",
  "department",
  "nationality",
  "position",
  "permitType",
  "permitStatus",
  "expiresWithin",
  "leaseStatus",
  "completeness",
  "actions",
] as const;
export type PeopleFilters = Record<(typeof PEOPLE_FILTER_KEYS)[number], string>;

export const parsePeopleFilters = (params: SearchParamsInput): PeopleFilters => parse(PEOPLE_FILTER_KEYS, params);

export const PERMIT_STATUS_OPTIONS = [
  { value: "valid", label: "Valid" },
  { value: "expiring", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
  { value: "application", label: "Application in progress" },
  { value: "none", label: "None on record" },
];

export const ACTION_FILTER_OPTIONS = [
  { value: "open", label: "Has outstanding follow-ups" },
  { value: "overdue", label: "Has overdue follow-ups" },
  { value: "none", label: "No outstanding follow-ups" },
];

export const WITHIN_OPTIONS = [
  { value: "30", label: "Within 30 days" },
  { value: "60", label: "Within 60 days" },
  { value: "90", label: "Within 90 days" },
  { value: "180", label: "Within 6 months" },
  { value: "365", label: "Within a year" },
];

function permitState(row: EvaluatedExpat, type: string): string[] {
  const types = type ? [type] : RIGHT_TO_WORK_TYPES;
  const own = row.permits.filter((permit) => !permit.dependantId && types.some((wanted) => same(permit.type, wanted)));
  const states = new Set<string>();
  for (const permit of own) {
    if (permit.inProgress) states.add("application");
    if (permit.current) {
      const status = permit.expiry?.status;
      states.add(status === "EXPIRED" ? "expired" : status === "EXPIRING" ? "expiring" : "valid");
    }
  }
  if (!states.size) states.add("none");
  return [...states];
}

export function filterPeople(rows: EvaluatedExpat[], filters: PeopleFilters, today: ISODate): EvaluatedExpat[] {
  const view = findView(PEOPLE_VIEWS, filters.view);
  const terms = words(filters.q);
  const within = Number(filters.expiresWithin) || 0;
  return rows.filter((row) => {
    const { expat } = row;
    if (view && !view.matches(row, today)) return false;
    if (filters.company && !same(expat.company, filters.company)) return false;
    if (filters.department && !same(expat.department, filters.department)) return false;
    if (filters.nationality && !same(expat.nationality, filters.nationality)) return false;
    if (filters.position && !same(expat.position, filters.position)) return false;
    if (filters.permitStatus) {
      if (!permitState(row, filters.permitType).includes(filters.permitStatus)) return false;
    } else if (filters.permitType && permitState(row, filters.permitType).includes("none")) {
      return false;
    }
    if (within && !row.expiries.some((item) => item.daysRemaining <= within)) return false;
    if (filters.leaseStatus) {
      const status = row.currentLease?.status ?? "none";
      if (!same(status, filters.leaseStatus)) return false;
    }
    if (filters.completeness && row.status !== filters.completeness) return false;
    if (filters.actions === "open" && !row.openActions) return false;
    if (filters.actions === "overdue" && !row.overdueActions) return false;
    if (filters.actions === "none" && row.openActions) return false;
    return matchesAll(terms, [
      expat.id,
      expat.fullName,
      expat.employeeNumber,
      expat.nationality,
      expat.company,
      expat.department,
      expat.position,
      expat.managerName,
      ...row.dependants.map((dependant) => dependant.fullName),
    ]);
  });
}

// ---------------------------------------------------------------------------
// The master expiry view.
// ---------------------------------------------------------------------------

export const EXPIRY_FILTER_KEYS = ["view", "q", "expat", "kind", "group", "status", "within", "from", "to", "responsible"] as const;
export type ExpiryFilters = Record<(typeof EXPIRY_FILTER_KEYS)[number], string>;

export const parseExpiryFilters = (params: SearchParamsInput): ExpiryFilters => parse(EXPIRY_FILTER_KEYS, params);

export function filterExpiries(items: ExpiryItem[], filters: ExpiryFilters, today: ISODate): ExpiryItem[] {
  const view = findView(EXPIRY_VIEWS, filters.view);
  const terms = words(filters.q);
  const within = Number(filters.within) || 0;
  return items.filter((item) => {
    if (view && !view.matches(item, today)) return false;
    if (filters.expat && item.expatId !== filters.expat) return false;
    if (filters.kind && !same(item.kind, filters.kind)) return false;
    if (filters.group && !same(item.group, filters.group)) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (within && item.daysRemaining > within) return false;
    if (filters.from && item.expiryDate < filters.from) return false;
    if (filters.to && item.expiryDate > filters.to) return false;
    if (filters.responsible && !same(item.responsibleName || item.responsibleEmail, filters.responsible)) return false;
    return matchesAll(terms, [item.expatName, item.personName, item.kind, item.reference, item.group, item.responsibleName]);
  });
}

// ---------------------------------------------------------------------------
// Follow-ups.
// ---------------------------------------------------------------------------

export const ACTION_FILTER_KEYS = ["view", "q", "responsible", "expat"] as const;
export type ActionFilters = Record<(typeof ACTION_FILTER_KEYS)[number], string>;

export const parseActionFilters = (params: SearchParamsInput): ActionFilters => parse(ACTION_FILTER_KEYS, params);

export function filterActions(
  actions: FollowUp[],
  filters: ActionFilters,
  today: ISODate,
  nameOf: (expatId: string) => string,
): FollowUp[] {
  const view = findView(ACTION_VIEWS, filters.view || "open");
  const terms = words(filters.q);
  return actions
    .filter((action) => {
      if (view && !view.matches(action, today)) return false;
      if (filters.expat && action.expatId !== filters.expat) return false;
      if (filters.responsible && !same(action.responsibleName || action.responsibleEmail, filters.responsible)) return false;
      return matchesAll(terms, [action.title, action.notes, action.responsibleName, nameOf(action.expatId)]);
    })
    .sort((a, b) => {
      const open = Number(OPEN_ACTION.includes(b.status)) - Number(OPEN_ACTION.includes(a.status));
      return open || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title);
    });
}

export function countActive(filters: Record<string, string>, ignore: string[] = ["view"]): number {
  return Object.entries(filters).filter(([key, value]) => value && !ignore.includes(key)).length;
}

export { distinct } from "@/lib/licenses/filters";
