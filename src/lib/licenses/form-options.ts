import { distinct } from "@/lib/licenses/filters";
import { DEFAULT_LICENSE_CATEGORIES, type AssetSummary, type EvaluatedLicense } from "@/lib/licenses/types";

/** The choices and suggestions the license form offers, from what is already in the register. */
export function licenseFormOptions(assets: AssetSummary[], licenses: EvaluatedLicense[]) {
  return {
    assets: assets
      .map(({ asset }) => ({
        id: asset.id,
        label: `${asset.name}${asset.registration ? ` (${asset.registration})` : ""} — ${asset.type}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    categories: distinct([...DEFAULT_LICENSE_CATEGORIES, ...licenses.map((license) => license.category)]),
    typesInUse: distinct(licenses.map((license) => license.type)),
    departments: distinct([...licenses.map((license) => license.department), ...assets.map(({ asset }) => asset.department)]),
  };
}
