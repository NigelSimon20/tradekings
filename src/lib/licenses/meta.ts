import type { Tone } from "@/lib/domain/meta";
import { ASSET_TYPE_GROUPS, type AssetGroup, type LicenseFlagCode, type LicenseStatus } from "@/lib/licenses/types";

/**
 * Labels and colours for the License Tracker, as tones from the shared palette
 * (`lib/ui/tones.ts`), so "expired" looks the same in all three apps and the
 * map markers use the same hex values.
 */

export const LICENSE_STATUS_META: Record<LicenseStatus, { label: string; tone: Tone; priority: number }> = {
  EXPIRED: { label: "Expired", tone: "critical", priority: 1 },
  EXPIRING: { label: "Expiring soon", tone: "warning", priority: 2 },
  NO_DATE: { label: "No expiry date", tone: "caution", priority: 3 },
  ACTIVE: { label: "Active", tone: "success", priority: 4 },
  NO_EXPIRY: { label: "Does not expire", tone: "info", priority: 5 },
};

export interface LicenseFlagMeta {
  label: string;
  tone: Tone;
  description: string;
}

export const LICENSE_FLAG_META: Record<LicenseFlagCode, LicenseFlagMeta> = {
  RENEWAL_OVERDUE: {
    label: "Renewal overdue",
    tone: "critical",
    description: "The license has expired and no renewal has been lodged.",
  },
  RENEWAL_PENDING: {
    label: "Renewal pending",
    tone: "info",
    description: "A renewal is in progress or with the issuing authority.",
  },
  REMINDER_DUE: {
    label: "Renewal reminder",
    tone: "warning",
    description: "The license is inside a reminder window and its renewal has not been started.",
  },
  NO_EXPIRY_DATE: {
    label: "No expiry date",
    tone: "caution",
    description: "The license renews but no expiry date is recorded, so no reminder can be given.",
  },
  NO_DOCUMENT: {
    label: "No document",
    tone: "neutral",
    description: "No copy of the license or certificate is attached.",
  },
  NO_RESPONSIBLE_PERSON: {
    label: "No one responsible",
    tone: "neutral",
    description: "Nobody is named as responsible for renewing it.",
  },
  ASSET_MISSING: {
    label: "Asset not found",
    tone: "caution",
    description: "The license points at an asset that is not on the Assets tab.",
  },
};

/** Which brief category an asset type belongs to. */
export function assetGroupOf(type: string): AssetGroup | null {
  for (const [group, types] of Object.entries(ASSET_TYPE_GROUPS) as [AssetGroup, readonly string[]][]) {
    if (types.includes(type)) return group;
  }
  return null;
}
