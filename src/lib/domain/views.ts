import type { Tone } from "@/lib/domain/meta";
import { DATA_QUALITY_FLAGS } from "@/lib/domain/meta";
import type { EvaluatedContract } from "@/lib/domain/types";

/**
 * The saved views behind the dashboard cards. Each one is a named predicate, so
 * a dashboard tile and the filtered contracts list can never drift apart: the
 * tile links to `/contracts?view=<id>` and both count the same rows.
 */
export interface ContractView {
  id: string;
  label: string;
  description: string;
  tone: Tone;
  group: "contracts" | "limits" | "rehire" | "data";
  /**
   * `latest` counts the current contract per employee (the normal case);
   * `all` counts every row, including superseded history.
   */
  scope: "latest" | "all";
  matches: (contract: EvaluatedContract) => boolean;
}

const hasFlag = (contract: EvaluatedContract, ...codes: string[]) =>
  contract.computed.flags.some((flag) => codes.includes(flag.code));

export const CONTRACT_VIEWS: ContractView[] = [
  {
    id: "active",
    label: "Total Active Contracts",
    description: "Contracts running today across both companies.",
    tone: "success",
    group: "contracts",
    scope: "latest",
    matches: (contract) => contract.computed.isInForce,
  },
  {
    id: "expired",
    label: "Expired / Overdue",
    description: "Past the end date and still waiting for a decision.",
    tone: "critical",
    group: "contracts",
    scope: "latest",
    matches: (contract) =>
      contract.computed.status === "EXPIRED" || contract.computed.status === "OVERDUE",
  },
  {
    id: "expires-today",
    label: "Expires Today",
    description: "The last day of the contract is today.",
    tone: "danger",
    group: "contracts",
    scope: "latest",
    matches: (contract) => contract.computed.status === "EXPIRES_TODAY",
  },
  {
    id: "expiring-15",
    label: "Expiring Within 15 Days",
    description: "Inside the 15 day renewal window.",
    tone: "warning",
    group: "contracts",
    scope: "latest",
    matches: (contract) => contract.computed.status === "EXPIRING_15",
  },
  {
    id: "expiring-30",
    label: "Expiring Within 30 Days",
    description: "Inside the 30 day renewal window.",
    tone: "caution",
    group: "contracts",
    scope: "latest",
    matches: (contract) => contract.computed.status === "EXPIRING_30",
  },
  {
    id: "renewals-due",
    label: "Renewals Due",
    description: "Every contract still requiring HR or manager action.",
    tone: "warning",
    group: "contracts",
    scope: "latest",
    matches: (contract) => contract.computed.needsAction,
  },
  {
    id: "zim-approaching",
    label: "Zimkings — Approaching 5 Contract Limit",
    description: "On contract 4 of the 5 allowed.",
    tone: "warning",
    group: "limits",
    scope: "latest",
    matches: (contract) => hasFlag(contract, "ZIM_LIMIT_APPROACHING"),
  },
  {
    id: "zim-reached",
    label: "Zimkings — 5 Contract Limit Reached",
    description: "No further fixed-term renewals are allowed.",
    tone: "critical",
    group: "limits",
    scope: "latest",
    matches: (contract) => hasFlag(contract, "ZIM_LIMIT_REACHED"),
  },
  {
    id: "casual-approaching",
    label: "Casual — Approaching 6 Contract Limit",
    description: "On contract 5 of the 6 allowed in the 6 week period.",
    tone: "warning",
    group: "limits",
    scope: "latest",
    matches: (contract) => hasFlag(contract, "CASUAL_LIMIT_APPROACHING"),
  },
  {
    id: "casual-reached",
    label: "Casual — 6 Contract Limit Reached",
    description: "The 3 month break applies before any rehire.",
    tone: "critical",
    group: "limits",
    scope: "latest",
    matches: (contract) => hasFlag(contract, "CASUAL_LIMIT_REACHED"),
  },
  {
    id: "casual-not-eligible",
    label: "Casual — Not Eligible for Rehire",
    description: "Inside the 3 month waiting period.",
    tone: "info",
    group: "rehire",
    scope: "latest",
    matches: (contract) =>
      contract.computed.isLatest && contract.computed.rehireStatus === "NOT_ELIGIBLE",
  },
  {
    id: "casual-eligible",
    label: "Casual — Eligible for Rehire",
    description: "Casual employees who may be engaged again.",
    tone: "success",
    group: "rehire",
    scope: "latest",
    matches: (contract) =>
      contract.computed.isLatest &&
      contract.computed.rehireStatus === "ELIGIBLE" &&
      !contract.computed.isInForce,
  },
  {
    id: "data-issues",
    label: "Rows Needing Attention in the Sheet",
    description: "Missing dates, employee IDs or manager emails.",
    tone: "critical",
    group: "data",
    scope: "all",
    matches: (contract) =>
      contract.computed.flags.some((flag) => DATA_QUALITY_FLAGS.includes(flag.code)),
  },
];

const VIEWS_BY_ID = new Map(CONTRACT_VIEWS.map((view) => [view.id, view]));

export function getView(id: string | null | undefined): ContractView | null {
  return id ? VIEWS_BY_ID.get(id) ?? null : null;
}

export function countView(contracts: EvaluatedContract[], view: ContractView): number {
  return contracts.reduce((total, contract) => (view.matches(contract) ? total + 1 : total), 0);
}

/** Picks the rows a view is counted over. */
export function rowsForView(
  view: ContractView,
  rows: { latest: EvaluatedContract[]; all: EvaluatedContract[] },
): EvaluatedContract[] {
  return view.scope === "all" ? rows.all : rows.latest;
}
