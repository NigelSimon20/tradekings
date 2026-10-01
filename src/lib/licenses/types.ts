import type { ISODate } from "@/lib/date/dates";

/**
 * The License & Compliance Tracker's records. Assets (warehouses, sites,
 * vehicles, equipment, the company itself) hold licenses; a license's
 * renewals, documents and every change are kept as history rather than
 * overwritten.
 */

/** Grouped as the brief groups them; the map shows the location-based ones. */
export const ASSET_TYPE_GROUPS = {
  "Warehouses & Sites": ["Warehouse", "Factory", "Depot", "Operational site", "Office"],
  "Trucks & Vehicles": ["Truck", "Vehicle"],
  "Equipment & Other Assets": ["Equipment", "Other asset"],
  "Company & Operational": ["Company-wide"],
} as const;
export const ASSET_TYPES = Object.values(ASSET_TYPE_GROUPS).flat() as string[];
export type AssetGroup = keyof typeof ASSET_TYPE_GROUPS;

/** Asset types that are places, so they belong on the map. */
export const LOCATION_ASSET_TYPES: readonly string[] = ASSET_TYPE_GROUPS["Warehouses & Sites"];

export const COMPANIES = ["Trade Kings", "ZimKings", "Both"] as const;

/**
 * The categories the brief starts with. They are suggestions, not a fixed list:
 * any other category typed on a license is accepted and offered from then on.
 */
export const DEFAULT_LICENSE_CATEGORIES = [
  "Warehouses & Sites",
  "Trucks & Vehicles",
  "Equipment & Other Assets",
  "Company & Operational",
] as const;

/** License types suggested per category; again, free text is accepted. */
export const SUGGESTED_LICENSE_TYPES: Record<string, string[]> = {
  "Warehouses & Sites": [
    "Warehouse permit",
    "Site license",
    "Fire certificate",
    "Health and safety certificate",
    "Occupancy certificate",
    "Site compliance document",
  ],
  "Trucks & Vehicles": [
    "Vehicle license",
    "Roadworthiness certificate",
    "Operating permit",
    "Fleet compliance document",
    "Vehicle insurance",
  ],
  "Equipment & Other Assets": ["Equipment certificate", "Inspection certificate", "Permit", "Asset compliance document"],
  "Company & Operational": ["Company license", "Regulatory permit", "Operational license", "Business compliance document"],
};

export const RENEWAL_FREQUENCIES = [
  "Annual",
  "Every 6 months",
  "Every 3 months",
  "Monthly",
  "Every 2 years",
  "Every 3 years",
  "Every 5 years",
  "One-off (no expiry)",
  "Other",
] as const;

/** Months per renewal frequency, for working out the next renewal when no expiry is recorded. */
export const FREQUENCY_MONTHS: Record<string, number | null> = {
  Annual: 12,
  "Every 6 months": 6,
  "Every 3 months": 3,
  Monthly: 1,
  "Every 2 years": 24,
  "Every 3 years": 36,
  "Every 5 years": 60,
  "One-off (no expiry)": null,
  Other: null,
};

export const RENEWAL_STATUSES = [
  "Not started",
  "In progress",
  "Submitted to authority",
  "Renewed",
  "Not renewing",
] as const;
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

/** Renewals someone has started but the authority has not yet issued. */
export const PENDING_RENEWAL: readonly RenewalStatus[] = ["In progress", "Submitted to authority"];

export const DOCUMENT_CATEGORIES = [
  "License / certificate",
  "Application",
  "Inspection report",
  "Correspondence",
  "Photo",
  "Other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface Asset {
  id: string;
  name: string;
  type: string;
  company: string;
  department: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  /** Vehicle registration or fleet number. */
  registration: string;
  responsibleName: string;
  responsibleEmail: string;
  notes: string;
  archived: boolean;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export type AssetInput = Omit<Asset, "id" | "archived" | "lastUpdated" | "lastUpdatedBy"> & { id?: string };

export interface License {
  id: string;
  name: string;
  category: string;
  type: string;
  number: string;
  /** The asset it belongs to; blank for a company-wide license with no asset recorded. */
  assetId: string;
  issuingAuthority: string;
  issueDate: ISODate | null;
  expiryDate: ISODate | null;
  renewalFrequency: string;
  renewalStatus: RenewalStatus;
  department: string;
  responsibleName: string;
  responsibleEmail: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  conditions: string;
  lastRenewalDate: ISODate | null;
  archived: boolean;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export type LicenseInput = Omit<License, "id" | "archived" | "lastUpdated" | "lastUpdatedBy"> & { id?: string };

export interface Renewal {
  id: string;
  licenseId: string;
  renewedOn: ISODate | null;
  previousExpiry: ISODate | null;
  newIssueDate: ISODate | null;
  newExpiry: ISODate | null;
  newNumber: string;
  /** The renewed certificate, when one was uploaded with the renewal. */
  documentId: string;
  notes: string;
  recordedAt: string;
  recordedBy: string;
}

export interface LicenseDocument {
  id: string;
  /** Attached to a license, an asset, or both. */
  licenseId: string;
  assetId: string;
  category: DocumentCategory;
  title: string;
  url: string;
  storedFileId: string;
  mimeType: string;
  documentDate: ISODate | null;
  addedAt: string;
  addedBy: string;
  removed: boolean;
}

export interface LicenseActivity {
  id: string;
  at: string;
  by: string;
  recordType: "License" | "Asset" | "System";
  recordId: string;
  action: string;
  details: string;
}

export interface LicenseData {
  assets: Asset[];
  licenses: License[];
  renewals: Renewal[];
  documents: LicenseDocument[];
  activity: LicenseActivity[];
}

export const LICENSE_STATUSES = ["EXPIRED", "EXPIRING", "ACTIVE", "NO_EXPIRY", "NO_DATE"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const LICENSE_FLAGS = [
  "RENEWAL_OVERDUE",
  "RENEWAL_PENDING",
  "REMINDER_DUE",
  "NO_EXPIRY_DATE",
  "NO_DOCUMENT",
  "NO_RESPONSIBLE_PERSON",
  "ASSET_MISSING",
] as const;
export type LicenseFlagCode = (typeof LICENSE_FLAGS)[number];

export interface LicenseFlag {
  code: LicenseFlagCode;
  detail?: string;
}

export interface LicenseComputed {
  status: LicenseStatus;
  /** Days until expiry; negative once expired. */
  daysRemaining: number | null;
  /** The renewal due next: the expiry date, or the last renewal plus the frequency. */
  nextRenewalDate: ISODate | null;
  /** The reminder window it is in (e.g. 30 for "within 30 days"), if any. */
  reminderDays: number | null;
  pendingRenewal: boolean;
  /** True when someone has to act: expired, expiring and not yet lodged, or a data gap. */
  needsAction: boolean;
  flags: LicenseFlag[];
  asset: Asset | null;
  documentCount: number;
}

export interface EvaluatedLicense extends License {
  computed: LicenseComputed;
}

export interface AssetSummary {
  asset: Asset;
  licenses: EvaluatedLicense[];
  /** The most urgent status among its licenses, for the map marker. */
  worstStatus: LicenseStatus | null;
  needsAction: number;
  hasLocation: boolean;
}
