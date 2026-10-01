import { LICENSE_STATUS_META } from "@/lib/licenses/meta";
import type { EvaluatedLicense, LicenseStatus } from "@/lib/licenses/types";
import { getLicenseView } from "@/lib/licenses/views";
import type { SearchParamsInput } from "@/lib/domain/filters";

/**
 * Search and filters for the license register: the brief's location, asset
 * type, license type, department and expiry status, plus a dashboard view, a
 * category and a single asset. Filters live in the URL so a list can be shared.
 */
export interface LicenseFilters {
  view: string;
  q: string;
  location: string;
  assetType: string;
  type: string;
  department: string;
  status: string;
  category: string;
  asset: string;
}

const KEYS = ["view", "q", "location", "assetType", "type", "department", "status", "category", "asset"] as const;

export const EMPTY_LICENSE_FILTERS: LicenseFilters = Object.fromEntries(KEYS.map((key) => [key, ""])) as unknown as LicenseFilters;

export function parseLicenseFilters(params: SearchParamsInput): LicenseFilters {
  const single = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  return Object.fromEntries(KEYS.map((key) => [key, single(key)])) as unknown as LicenseFilters;
}

export function countActiveLicenseFilters(filters: LicenseFilters): number {
  return KEYS.filter((key) => filters[key]).length;
}

/** Everything a search should find a license by — the brief's search list. */
function searchText(license: EvaluatedLicense): string {
  const asset = license.computed.asset;
  return [
    license.id,
    license.name,
    license.number,
    license.type,
    license.category,
    license.issuingAuthority,
    license.department,
    license.responsibleName,
    asset?.name,
    asset?.registration,
    asset?.city,
    asset?.address,
    asset?.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterLicenses(licenses: EvaluatedLicense[], filters: LicenseFilters): EvaluatedLicense[] {
  const view = filters.view ? getLicenseView(filters.view) : undefined;
  const terms = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  const same = (a: string | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

  return licenses.filter((license) => {
    const asset = license.computed.asset;
    if (view && !view.matches(license)) return false;
    if (filters.location && !same(asset?.city, filters.location)) return false;
    if (filters.assetType && !same(asset?.type, filters.assetType)) return false;
    if (filters.type && !same(license.type, filters.type)) return false;
    if (filters.department && !same(license.department, filters.department)) return false;
    if (filters.status && license.computed.status !== filters.status) return false;
    if (filters.category && !same(license.category, filters.category)) return false;
    if (filters.asset && license.assetId !== filters.asset) return false;
    if (terms.length) {
      const text = searchText(license);
      if (!terms.every((term) => text.includes(term))) return false;
    }
    return true;
  });
}

/** Most urgent first: expired, then expiring (soonest first), then the rest by name. */
export function sortLicensesByUrgency(licenses: EvaluatedLicense[]): EvaluatedLicense[] {
  return [...licenses].sort((a, b) => {
    const status = LICENSE_STATUS_META[a.computed.status].priority - LICENSE_STATUS_META[b.computed.status].priority;
    if (status) return status;
    const days = (a.computed.daysRemaining ?? Infinity) - (b.computed.daysRemaining ?? Infinity);
    if (days) return days;
    return a.name.localeCompare(b.name);
  });
}

export const STATUS_FILTER_OPTIONS = (Object.keys(LICENSE_STATUS_META) as LicenseStatus[]).map((value) => ({
  value,
  label: LICENSE_STATUS_META[value].label,
}));

/** The distinct, sorted values in use — for filter dropdowns and form suggestions. */
export function distinct(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
