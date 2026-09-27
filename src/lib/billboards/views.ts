import type { Tone } from "@/lib/domain/meta";
import type { EvaluatedBillboard } from "@/lib/billboards/types";

/**
 * The saved views behind the billboard dashboard. One predicate per tile, used
 * both to count and to filter `/billboards/list?view=<id>`, so a number and its
 * list cannot disagree.
 */
export interface BillboardView {
  id: string;
  label: string;
  description: string;
  tone: Tone;
  matches: (billboard: EvaluatedBillboard) => boolean;
}

export const BILLBOARD_VIEWS: BillboardView[] = [
  {
    id: "all",
    label: "Total billboards",
    description: "Every site in the network.",
    tone: "info",
    matches: () => true,
  },
  {
    id: "active",
    label: "Active sites",
    description: "Standing and available for campaigns.",
    tone: "success",
    matches: (billboard) => billboard.status === "Active",
  },
  {
    id: "inactive",
    label: "Inactive sites",
    description: "Not in use.",
    tone: "neutral",
    matches: (billboard) => billboard.status === "Inactive",
  },
  {
    id: "maintenance",
    label: "Under maintenance",
    description: "Being repaired or inspected.",
    tone: "caution",
    matches: (billboard) => billboard.status === "Under Maintenance",
  },
  {
    id: "lease-expired",
    label: "Expired leases",
    description: "Past the lease end date.",
    tone: "critical",
    matches: (billboard) => billboard.computed.leaseStatus === "EXPIRED",
  },
  {
    id: "lease-30",
    label: "Leases expiring ≤ 30 days",
    description: "Renewal should be under way.",
    tone: "warning",
    matches: (billboard) => billboard.computed.leaseStatus === "EXPIRING_30",
  },
  {
    id: "lease-90",
    label: "Leases expiring ≤ 90 days",
    description: "Includes those within 30 days.",
    tone: "caution",
    matches: (billboard) =>
      billboard.computed.leaseStatus === "EXPIRING_30" ||
      billboard.computed.leaseStatus === "EXPIRING_90",
  },
  {
    id: "follow-up",
    label: "Requiring follow-up",
    description: "Leases, inspections, repairs or campaigns to chase.",
    tone: "danger",
    matches: (billboard) => billboard.computed.needsFollowUp,
  },
];

export function getBillboardView(id: string): BillboardView | undefined {
  return BILLBOARD_VIEWS.find((view) => view.id === id);
}
