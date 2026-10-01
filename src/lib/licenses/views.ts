import type { Tone } from "@/lib/domain/meta";
import type { EvaluatedLicense } from "@/lib/licenses/types";

/**
 * The saved views behind the license dashboard. One predicate per tile, used
 * both to count and to filter `/licenses/register?view=<id>`, so a number and
 * its list cannot disagree.
 */
export interface LicenseView {
  id: string;
  label: string;
  description: string;
  tone: Tone;
  matches: (license: EvaluatedLicense) => boolean;
}

export const LICENSE_VIEWS: LicenseView[] = [
  {
    id: "active",
    label: "Active licenses",
    description: "Valid today, including those expiring soon.",
    tone: "success",
    matches: (license) => license.computed.status !== "EXPIRED",
  },
  {
    id: "expiring",
    label: "Expiring soon",
    description: "Inside a renewal reminder window.",
    tone: "warning",
    matches: (license) => license.computed.status === "EXPIRING",
  },
  {
    id: "expired",
    label: "Expired",
    description: "Past the expiry date.",
    tone: "critical",
    matches: (license) => license.computed.status === "EXPIRED",
  },
  {
    id: "pending",
    label: "Pending renewal",
    description: "Renewal in progress or with the authority.",
    tone: "info",
    matches: (license) => license.computed.pendingRenewal,
  },
  {
    id: "action",
    label: "Requiring action",
    description: "Overdue, due a reminder, or missing an expiry date.",
    tone: "danger",
    matches: (license) => license.computed.needsAction,
  },
  {
    id: "upcoming",
    label: "Upcoming renewals",
    description: "Renewal due within 90 days.",
    tone: "caution",
    matches: (license) =>
      license.computed.daysRemaining !== null && license.computed.daysRemaining >= 0 && license.computed.daysRemaining <= 90,
  },
];

export function getLicenseView(id: string): LicenseView | undefined {
  return LICENSE_VIEWS.find((view) => view.id === id);
}
