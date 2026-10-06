import type { Tone } from "@/lib/domain/meta";
import type {
  ActionStatus,
  ApplicationStatus,
  ExpiryGroup,
  ExpiryStatus,
  LeaseStatus,
  ProfileSection,
  ProfileStatus,
  VehicleStatus,
} from "@/lib/expats/types";

/**
 * Labels and colours for the Expat Tracker, as tones from the shared palette
 * (`lib/ui/tones.ts`), so "expired" looks the same in every app and email.
 */

export const EXPIRY_STATUS_META: Record<ExpiryStatus, { label: string; tone: Tone; priority: number }> = {
  EXPIRED: { label: "Expired", tone: "critical", priority: 1 },
  EXPIRING: { label: "Expiring soon", tone: "warning", priority: 2 },
  VALID: { label: "Valid", tone: "success", priority: 3 },
};

export const PROFILE_STATUS_META: Record<ProfileStatus, { label: string; tone: Tone; description: string }> = {
  ACTION_REQUIRED: {
    label: "Action required",
    tone: "critical",
    description: "Something has expired or is due for renewal, or a follow-up is overdue.",
  },
  MISSING_DOCUMENTS: {
    label: "Missing documents",
    tone: "caution",
    description: "A passport, permit, contract or supporting document is not on file.",
  },
  COMPLETE: { label: "Complete", tone: "success", description: "Everything is on file and in date." },
};

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, Tone> = {
  "Documents Required": "caution",
  "Ready for Submission": "info",
  Submitted: "info",
  "In Progress": "info",
  Approved: "success",
  Issued: "success",
  Refused: "critical",
  Cancelled: "neutral",
};

export const LEASE_STATUS_TONE: Record<LeaseStatus, Tone> = {
  Active: "success",
  "Renewal in progress": "info",
  "Notice given": "caution",
  Ended: "neutral",
};

export const VEHICLE_STATUS_TONE: Record<VehicleStatus, Tone> = {
  "In use": "success",
  Returned: "neutral",
  "Sold / disposed": "neutral",
};

export const ACTION_STATUS_TONE: Record<ActionStatus, Tone> = {
  Open: "warning",
  "In progress": "info",
  Done: "success",
  Cancelled: "neutral",
};

export const SECTION_FOR_GROUP: Record<ExpiryGroup, ProfileSection> = {
  "Passports & immigration": "immigration",
  "Dependant documents": "household",
  Employment: "employment",
  Accommodation: "accommodation",
  "Vehicles & licences": "vehicles",
  Insurance: "immigration",
  "Other documents": "documents",
};

/** A link to the part of a profile an item lives in. */
export function profileHref(expatId: string, section?: ProfileSection): string {
  return `/expats/${encodeURIComponent(expatId)}${section ? `#${section}` : ""}`;
}
