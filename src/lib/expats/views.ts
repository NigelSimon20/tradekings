import type { ISODate } from "@/lib/date/dates";
import type { Tone } from "@/lib/domain/meta";
import {
  OPEN_ACTION,
  type EvaluatedExpat,
  type EvaluatedPermit,
  type ExpiryGroup,
  type ExpiryItem,
  type FollowUp,
} from "@/lib/expats/types";

/**
 * The saved views behind the expat dashboard. Each tile counts with the same
 * predicate its list filters with (`?view=<id>`), so a number and the list it
 * opens cannot disagree.
 */
export interface SavedView<T> {
  id: string;
  label: string;
  description: string;
  matches: (item: T, today: ISODate) => boolean;
}

const DOCUMENT_GROUPS: readonly ExpiryGroup[] = [
  "Passports & immigration",
  "Dependant documents",
  "Employment",
  "Other documents",
];
const ASSET_GROUPS: readonly ExpiryGroup[] = ["Accommodation", "Vehicles & licences", "Insurance"];

export const PEOPLE_VIEWS: SavedView<EvaluatedExpat>[] = [
  { id: "active", label: "Active expats", description: "Everyone not marked inactive.", matches: (row) => row.expat.employmentStatus !== "Inactive" },
  { id: "inactive", label: "Inactive expats", description: "Marked inactive but not yet offboarded.", matches: (row) => row.expat.employmentStatus === "Inactive" },
  {
    id: "families",
    label: "With dependants",
    description: "Expats with a spouse, children or other dependants on record.",
    matches: (row) => row.dependants.some((dependant) => !dependant.archived),
  },
  { id: "incomplete", label: "Incomplete profiles", description: "Missing documents or needing action.", matches: (row) => row.status !== "COMPLETE" },
  { id: "action", label: "Action required", description: "Something expired or due, or a follow-up overdue.", matches: (row) => row.status === "ACTION_REQUIRED" },
  { id: "missing", label: "Missing documents", description: "A document or permit is not on file.", matches: (row) => row.status === "MISSING_DOCUMENTS" },
  { id: "applications", label: "Applications in progress", description: "A permit or passport application is under way.", matches: (row) => row.applicationsInProgress > 0 },
];

export const EXPIRY_VIEWS: SavedView<ExpiryItem>[] = [
  {
    id: "documents",
    label: "Documents & permits approaching expiry",
    description: "Passports, visas, permits, dependant documents and contracts inside a reminder window.",
    matches: (item) => item.status === "EXPIRING" && DOCUMENT_GROUPS.includes(item.group),
  },
  {
    id: "assets",
    label: "Leases, licences & insurance approaching expiry",
    description: "Leases, notice dates, vehicle and driver's licences and cover inside a reminder window.",
    matches: (item) => item.status === "EXPIRING" && ASSET_GROUPS.includes(item.group),
  },
  { id: "expired", label: "Expired", description: "Past the expiry date and still current.", matches: (item) => item.status === "EXPIRED" },
  { id: "action", label: "Needing action", description: "Expired or due, with no renewal under way.", matches: (item) => item.needsAction },
  {
    id: "upcoming",
    label: "Next 90 days",
    description: "Everything that expires in the next 90 days.",
    matches: (item) => item.daysRemaining >= 0 && item.daysRemaining <= 90,
  },
];

const isOpen = (action: FollowUp) => OPEN_ACTION.includes(action.status);

export const ACTION_VIEWS: SavedView<FollowUp>[] = [
  { id: "open", label: "Outstanding", description: "Open or in progress.", matches: isOpen },
  {
    id: "overdue",
    label: "Overdue",
    description: "Open and past the due date.",
    matches: (action, today) => isOpen(action) && Boolean(action.dueDate && action.dueDate < today),
  },
  { id: "done", label: "Done", description: "Completed or cancelled.", matches: (action) => !isOpen(action) },
  { id: "all", label: "All", description: "Every follow-up.", matches: () => true },
];

export function findView<T>(views: SavedView<T>[], id: string | undefined): SavedView<T> | undefined {
  return id ? views.find((view) => view.id === id) : undefined;
}

export interface DashboardInput {
  people: EvaluatedExpat[];
  expiries: ExpiryItem[];
  actions: FollowUp[];
  applications: EvaluatedPermit[];
  today: ISODate;
}

export interface ExpatTile {
  id: string;
  label: string;
  description: (input: DashboardInput) => string;
  tone: Tone;
  href: string;
  count: (input: DashboardInput) => number;
}

const countView = <T,>(views: SavedView<T>[], id: string, rows: T[], today: ISODate) => {
  const view = findView(views, id)!;
  return rows.filter((row) => view.matches(row, today)).length;
};

/** The brief's dashboard overview, in its order. */
export const EXPAT_TILES: ExpatTile[] = [
  {
    id: "active",
    label: "Active expats",
    tone: "success",
    href: "/expats/people?view=active",
    count: ({ people, today }) => countView(PEOPLE_VIEWS, "active", people, today),
    description: ({ people, today }) => `${countView(PEOPLE_VIEWS, "inactive", people, today)} inactive.`,
  },
  {
    id: "dependants",
    label: "Dependants",
    tone: "info",
    href: "/expats/people?view=families",
    count: ({ people }) => people.reduce((sum, row) => sum + row.dependants.filter((dependant) => !dependant.archived).length, 0),
    description: ({ people, today }) => `In ${countView(PEOPLE_VIEWS, "families", people, today)} households.`,
  },
  {
    id: "documents",
    label: "Documents & permits expiring",
    tone: "warning",
    href: "/expats/expiries?view=documents",
    count: ({ expiries, today }) => countView(EXPIRY_VIEWS, "documents", expiries, today),
    description: () => "Passports, visas, permits and contracts in a reminder window.",
  },
  {
    id: "assets",
    label: "Leases, licences & insurance",
    tone: "caution",
    href: "/expats/expiries?view=assets",
    count: ({ expiries, today }) => countView(EXPIRY_VIEWS, "assets", expiries, today),
    description: () => "Approaching expiry.",
  },
  {
    id: "expired",
    label: "Expired",
    tone: "critical",
    href: "/expats/expiries?view=expired",
    count: ({ expiries, today }) => countView(EXPIRY_VIEWS, "expired", expiries, today),
    description: () => "Still current on a profile but past the date.",
  },
  {
    id: "applications",
    label: "Applications in progress",
    tone: "info",
    href: "/expats/applications",
    count: ({ applications }) => applications.length,
    description: ({ applications }) =>
      `${applications.filter((permit) => permit.status === "Documents Required").length} waiting for documents.`,
  },
  {
    id: "incomplete",
    label: "Incomplete profiles",
    tone: "danger",
    href: "/expats/people?view=incomplete",
    count: ({ people, today }) => countView(PEOPLE_VIEWS, "incomplete", people, today),
    description: ({ people, today }) => `${countView(PEOPLE_VIEWS, "action", people, today)} need action now.`,
  },
  {
    id: "actions",
    label: "Outstanding follow-ups",
    tone: "warning",
    href: "/expats/actions?view=open",
    count: ({ actions, today }) => countView(ACTION_VIEWS, "open", actions, today),
    description: ({ actions, today }) => `${countView(ACTION_VIEWS, "overdue", actions, today)} overdue.`,
  },
];
