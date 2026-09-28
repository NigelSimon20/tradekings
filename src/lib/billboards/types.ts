import type { ISODate } from "@/lib/date/dates";

/**
 * The billboard tracker's records. A billboard row holds the site as it is
 * now; campaigns, maintenance visits, documents and the activity log are
 * append-only, so history is kept rather than overwritten.
 */

export const BILLBOARD_STATUSES = ["Active", "Inactive", "Under Maintenance"] as const;
export type BillboardStatus = (typeof BILLBOARD_STATUSES)[number];

export const BILLBOARD_TYPES = [
  "Static billboard",
  "Unipole",
  "Digital / LED",
  "Wall wrap",
  "Rooftop",
  "Street pole",
  "Other",
] as const;

export const SITE_CONDITIONS = ["Good", "Fair", "Poor", "Damaged"] as const;
export type SiteCondition = (typeof SITE_CONDITIONS)[number];

export const MAINTENANCE_KINDS = [
  "Inspection",
  "Repair",
  "Issue reported",
  "Cleaning",
  "Installation / flighting",
  "Other",
] as const;

export const FILE_CATEGORIES = [
  "Site photo",
  "Structure / surroundings",
  "Campaign artwork",
  "Lease agreement",
  "Council approval",
  "Correspondence",
  "Maintenance",
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** Categories shown as photos on the profile; the rest are documents. */
export const PHOTO_CATEGORIES: readonly FileCategory[] = [
  "Site photo",
  "Structure / surroundings",
  "Campaign artwork",
];

export interface Billboard {
  id: string;
  /** Short site name people use, e.g. "Samora Machel / Julius Nyerere". */
  name: string;
  address: string;
  city: string;
  area: string;
  road: string;
  latitude: number | null;
  longitude: number | null;
  type: string;
  dimensions: string;
  faces: number | null;
  status: BillboardStatus;

  owner: string;
  leaseStart: ISODate | null;
  leaseExpiry: ISODate | null;
  /** Free text so the currency and period can be written as agreed. */
  leaseCost: string;
  noticePeriodDays: number | null;
  renewalNotes: string;
  leaseDocumentUrl: string;

  landlordName: string;
  landlordPhone: string;
  landlordEmail: string;
  councilName: string;
  councilPhone: string;
  councilEmail: string;
  contractorName: string;
  contractorPhone: string;
  contractorEmail: string;
  responsibleName: string;
  responsibleEmail: string;

  siteCondition: SiteCondition | "";
  lastInspection: ISODate | null;
  nextInspection: ISODate | null;
  maintenanceIssues: string;
  maintenanceNotes: string;

  /** Set by a person when a site needs chasing for a reason the rules cannot see. */
  followUp: boolean;
  followUpNote: string;
  notes: string;

  /** Archived rather than deleted, so its history stays readable. */
  archived: boolean;
  lastUpdated: string;
  lastUpdatedBy: string;
}

/** What a person fills in; the system owns the id stamp and the audit fields. */
export type BillboardInput = Omit<
  Billboard,
  "id" | "archived" | "lastUpdated" | "lastUpdatedBy" | "rowNumber"
> & { id?: string };

export interface Campaign {
  id: string;
  billboardId: string;
  brand: string;
  campaign: string;
  startDate: ISODate | null;
  endDate: ISODate | null;
  installedOn: ISODate | null;
  removedOn: ISODate | null;
  artworkUrl: string;
  notes: string;
  recordedAt: string;
  recordedBy: string;
}

export interface MaintenanceRecord {
  id: string;
  billboardId: string;
  date: ISODate | null;
  kind: string;
  condition: SiteCondition | "";
  description: string;
  photoUrl: string;
  nextInspection: ISODate | null;
  recordedAt: string;
  recordedBy: string;
}

export interface BillboardFile {
  id: string;
  billboardId: string;
  category: FileCategory;
  title: string;
  /** Where to open the file: a Drive link, or any https link pasted in. */
  url: string;
  /**
   * Set when the file was uploaded through the tracker: the id the photo store
   * gave it (a Google Drive file id). The tracker shows these as previews.
   */
  storedFileId: string;
  mimeType: string;
  documentDate: ISODate | null;
  addedAt: string;
  addedBy: string;
  /** Removed files stay on record, hidden from the profile. */
  removed: boolean;
}

export interface ActivityEntry {
  id: string;
  at: string;
  by: string;
  billboardId: string;
  action: string;
  details: string;
}

export interface BillboardData {
  billboards: Billboard[];
  campaigns: Campaign[];
  maintenance: MaintenanceRecord[];
  files: BillboardFile[];
  activity: ActivityEntry[];
}

export type NewCampaign = Omit<Campaign, "id" | "recordedAt" | "recordedBy">;
export type NewMaintenanceRecord = Omit<MaintenanceRecord, "id" | "recordedAt" | "recordedBy">;
export type NewBillboardFile = Omit<
  BillboardFile,
  "id" | "addedAt" | "addedBy" | "removed" | "storedFileId" | "mimeType"
>;

export const LEASE_STATUSES = ["EXPIRED", "EXPIRING_30", "EXPIRING_90", "ACTIVE", "NO_LEASE"] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

export const BILLBOARD_FLAGS = [
  "LEASE_EXPIRED",
  "LEASE_EXPIRING_30",
  "NOTICE_DUE",
  "INSPECTION_OVERDUE",
  "CONDITION_POOR",
  "OPEN_ISSUES",
  "CAMPAIGN_NOT_REMOVED",
  "FOLLOW_UP",
  "MISSING_LOCATION",
  "NO_LEASE_DOCUMENT",
] as const;
export type BillboardFlagCode = (typeof BILLBOARD_FLAGS)[number];

export interface BillboardFlag {
  code: BillboardFlagCode;
  detail?: string;
}

export interface BillboardComputed {
  leaseStatus: LeaseStatus;
  /** Days until the lease expires; negative once it has. */
  leaseDaysRemaining: number | null;
  /** Last day to give notice under the lease, when a notice period is known. */
  noticeDeadline: ISODate | null;
  currentCampaign: Campaign | null;
  nextCampaign: Campaign | null;
  inspectionOverdue: boolean;
  hasLocation: boolean;
  flags: BillboardFlag[];
  /** True when any flag asks a person to act. */
  needsFollowUp: boolean;
  photoCount: number;
  documentCount: number;
  /** The newest uploaded site photo, shown on the map and the profile. */
  coverPhotoId: string | null;
}

export interface EvaluatedBillboard extends Billboard {
  computed: BillboardComputed;
}
