import { getBillboardView } from "@/lib/billboards/views";
import { LEASE_STATUS_META } from "@/lib/billboards/meta";
import type { EvaluatedBillboard, LeaseStatus } from "@/lib/billboards/types";
import type { SearchParamsInput } from "@/lib/domain/filters";

/**
 * Search and filters for the billboard map and list. The same function runs on
 * the server for the list and in the browser for the map, so a search finds the
 * same sites in both.
 */
export interface BillboardFilters {
  view: string;
  q: string;
  status: string;
  city: string;
  lease: string;
}

export const EMPTY_BILLBOARD_FILTERS: BillboardFilters = {
  view: "",
  q: "",
  status: "",
  city: "",
  lease: "",
};

export function parseBillboardFilters(params: SearchParamsInput): BillboardFilters {
  const single = (key: keyof BillboardFilters) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  return {
    view: single("view"),
    q: single("q"),
    status: single("status"),
    city: single("city"),
    lease: single("lease"),
  };
}

/** Everything a search box should find a site by. */
function searchText(billboard: EvaluatedBillboard): string {
  const campaign = billboard.computed.currentCampaign;
  return [
    billboard.id,
    billboard.name,
    billboard.address,
    billboard.road,
    billboard.area,
    billboard.city,
    billboard.owner,
    billboard.type,
    campaign?.brand,
    campaign?.campaign,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterBillboards(
  billboards: EvaluatedBillboard[],
  filters: BillboardFilters,
): EvaluatedBillboard[] {
  const view = filters.view ? getBillboardView(filters.view) : undefined;
  const terms = filters.q.toLowerCase().split(/\s+/).filter(Boolean);

  return billboards.filter((billboard) => {
    if (view && !view.matches(billboard)) return false;
    if (filters.status && billboard.status !== filters.status) return false;
    if (filters.city && billboard.city !== filters.city) return false;
    if (filters.lease && billboard.computed.leaseStatus !== filters.lease) return false;
    if (terms.length) {
      const text = searchText(billboard);
      if (!terms.every((term) => text.includes(term))) return false;
    }
    return true;
  });
}

export function countActiveBillboardFilters(filters: BillboardFilters): number {
  return (["q", "status", "city", "lease", "view"] as const).filter((key) => filters[key]).length;
}

/** Most urgent first: lease trouble, then anything to follow up, then by name. */
export function sortBillboardsByUrgency(billboards: EvaluatedBillboard[]): EvaluatedBillboard[] {
  return [...billboards].sort((a, b) => {
    const lease =
      LEASE_STATUS_META[a.computed.leaseStatus].priority -
      LEASE_STATUS_META[b.computed.leaseStatus].priority;
    if (lease) return lease;
    const followUp = Number(b.computed.needsFollowUp) - Number(a.computed.needsFollowUp);
    if (followUp) return followUp;
    return a.name.localeCompare(b.name);
  });
}

export const LEASE_FILTER_OPTIONS = (Object.keys(LEASE_STATUS_META) as LeaseStatus[]).map((value) => ({
  value,
  label: LEASE_STATUS_META[value].label,
}));
