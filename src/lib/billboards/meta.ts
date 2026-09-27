import type { Tone } from "@/lib/domain/meta";
import type {
  BillboardFlagCode,
  BillboardStatus,
  LeaseStatus,
  SiteCondition,
} from "@/lib/billboards/types";

/**
 * Labels and colours for the billboard tracker. Colours are tones from the
 * shared palette (`lib/ui/tones.ts`), so "expired" looks the same here as it
 * does on the contract side, and the map markers use the same hex values.
 */

export const BILLBOARD_STATUS_META: Record<BillboardStatus, { tone: Tone; description: string }> = {
  Active: { tone: "success", description: "Standing and available for campaigns." },
  "Under Maintenance": { tone: "caution", description: "Being repaired or inspected." },
  Inactive: { tone: "neutral", description: "Not in use." },
};

export const LEASE_STATUS_META: Record<LeaseStatus, { label: string; tone: Tone; priority: number }> = {
  EXPIRED: { label: "Lease expired", tone: "critical", priority: 1 },
  EXPIRING_30: { label: "Expires within 30 days", tone: "warning", priority: 2 },
  EXPIRING_90: { label: "Expires within 90 days", tone: "caution", priority: 3 },
  ACTIVE: { label: "Lease active", tone: "success", priority: 4 },
  NO_LEASE: { label: "No lease recorded", tone: "neutral", priority: 5 },
};

export const CONDITION_TONES: Record<SiteCondition, Tone> = {
  Good: "success",
  Fair: "info",
  Poor: "warning",
  Damaged: "critical",
};

export interface BillboardFlagMeta {
  label: string;
  tone: Tone;
  description: string;
  /** Counts towards "sites requiring follow-up". */
  followUp: boolean;
}

export const BILLBOARD_FLAG_META: Record<BillboardFlagCode, BillboardFlagMeta> = {
  LEASE_EXPIRED: {
    label: "Lease expired",
    tone: "critical",
    description: "The lease end date has passed. Renew it or record the new dates.",
    followUp: true,
  },
  LEASE_EXPIRING_30: {
    label: "Lease expires within 30 days",
    tone: "warning",
    description: "Start the renewal now.",
    followUp: true,
  },
  NOTICE_DUE: {
    label: "Notice deadline close",
    tone: "warning",
    description: "The last day to give notice under the lease is close or has passed.",
    followUp: true,
  },
  INSPECTION_OVERDUE: {
    label: "Inspection overdue",
    tone: "warning",
    description: "The next inspection date has passed without a new one being recorded.",
    followUp: true,
  },
  CONDITION_POOR: {
    label: "Poor condition",
    tone: "danger",
    description: "The last recorded condition was Poor or Damaged.",
    followUp: true,
  },
  OPEN_ISSUES: {
    label: "Open maintenance issue",
    tone: "caution",
    description: "Maintenance issues are recorded against the site.",
    followUp: true,
  },
  CAMPAIGN_NOT_REMOVED: {
    label: "Campaign past its end date",
    tone: "caution",
    description: "A campaign has ended but no removal date has been recorded.",
    followUp: true,
  },
  FOLLOW_UP: {
    label: "Marked for follow-up",
    tone: "info",
    description: "Someone has asked for this site to be followed up.",
    followUp: true,
  },
  MISSING_LOCATION: {
    label: "No GPS coordinates",
    tone: "neutral",
    description: "The site cannot be shown on the map until its coordinates are added.",
    followUp: false,
  },
  NO_LEASE_DOCUMENT: {
    label: "No lease document",
    tone: "neutral",
    description: "Lease dates are recorded but the signed agreement is not linked.",
    followUp: false,
  },
};
