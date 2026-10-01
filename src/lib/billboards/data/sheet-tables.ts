import {
  BILLBOARD_STATUSES,
  BILLBOARD_TYPES,
  FILE_CATEGORIES,
  MAINTENANCE_KINDS,
  SITE_CONDITIONS,
  type ActivityEntry,
  type Billboard,
  type BillboardFile,
  type Campaign,
  type MaintenanceRecord,
} from "@/lib/billboards/types";
import { col, type TableSpec } from "@/lib/data/table-spec";

/**
 * The layout of the billboard spreadsheet: one tab per record type, columns
 * matched by their heading so people can reorder or insert columns freely.
 * Reading and writing a row are plain functions of these definitions, so the
 * Google Sheet and any future store agree on exactly one shape.
 */

export const BILLBOARDS_TABLE: TableSpec<Billboard> = {
  tab: "Billboards",
  idKey: "id",
  columns: [
    col<Billboard>("id", "Billboard ID", "text", { width: 110 }),
    col<Billboard>("name", "Site Name", "text", { width: 240 }),
    col<Billboard>("address", "Address", "text", { width: 260 }),
    col<Billboard>("city", "City / Town"),
    col<Billboard>("area", "Area"),
    col<Billboard>("road", "Road"),
    col<Billboard>("latitude", "Latitude", "number"),
    col<Billboard>("longitude", "Longitude", "number"),
    col<Billboard>("type", "Billboard Type", "text", { options: BILLBOARD_TYPES }),
    col<Billboard>("dimensions", "Dimensions"),
    col<Billboard>("faces", "Faces", "number"),
    col<Billboard>("status", "Status", "text", { options: BILLBOARD_STATUSES }),
    col<Billboard>("owner", "Owner"),
    col<Billboard>("leaseStart", "Lease Start", "date"),
    col<Billboard>("leaseExpiry", "Lease Expiry", "date"),
    col<Billboard>("leaseCost", "Lease Cost"),
    col<Billboard>("noticePeriodDays", "Notice Period (days)", "number"),
    col<Billboard>("renewalNotes", "Renewal / Notice Notes", "text", { width: 240 }),
    col<Billboard>("leaseDocumentUrl", "Lease Document Link", "text", { width: 200 }),
    col<Billboard>("landlordName", "Landlord / Property Manager"),
    col<Billboard>("landlordPhone", "Landlord Phone"),
    col<Billboard>("landlordEmail", "Landlord Email"),
    col<Billboard>("councilName", "Council Contact"),
    col<Billboard>("councilPhone", "Council Phone"),
    col<Billboard>("councilEmail", "Council Email"),
    col<Billboard>("contractorName", "Maintenance Contractor"),
    col<Billboard>("contractorPhone", "Contractor Phone"),
    col<Billboard>("contractorEmail", "Contractor Email"),
    col<Billboard>("responsibleName", "Trade Kings Responsible Person"),
    col<Billboard>("responsibleEmail", "Responsible Person Email"),
    col<Billboard>("siteCondition", "Site Condition", "text", { options: SITE_CONDITIONS }),
    col<Billboard>("lastInspection", "Last Inspection", "date"),
    col<Billboard>("nextInspection", "Next Inspection", "date"),
    col<Billboard>("maintenanceIssues", "Open Maintenance Issues", "text", { width: 240 }),
    col<Billboard>("maintenanceNotes", "Maintenance Notes", "text", { width: 240 }),
    col<Billboard>("followUp", "Follow Up", "boolean", { options: ["Yes", "No"] }),
    col<Billboard>("followUpNote", "Follow Up Note", "text", { width: 200 }),
    col<Billboard>("notes", "Notes", "text", { width: 240 }),
    col<Billboard>("archived", "Archived", "boolean", { options: ["Yes", "No"] }),
    col<Billboard>("lastUpdated", "Last Updated", "timestamp"),
    col<Billboard>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const CAMPAIGNS_TABLE: TableSpec<Campaign> = {
  tab: "Campaigns",
  idKey: "id",
  columns: [
    col<Campaign>("id", "Campaign Record ID"),
    col<Campaign>("billboardId", "Billboard ID"),
    col<Campaign>("brand", "Brand / Product"),
    col<Campaign>("campaign", "Campaign", "text", { width: 200 }),
    col<Campaign>("startDate", "Start Date", "date"),
    col<Campaign>("endDate", "End Date", "date"),
    col<Campaign>("installedOn", "Installed On", "date"),
    col<Campaign>("removedOn", "Removed On", "date"),
    col<Campaign>("artworkUrl", "Artwork Link", "text", { width: 200 }),
    col<Campaign>("notes", "Notes", "text", { width: 240 }),
    col<Campaign>("recordedAt", "Recorded At", "timestamp"),
    col<Campaign>("recordedBy", "Recorded By"),
  ],
};

export const MAINTENANCE_TABLE: TableSpec<MaintenanceRecord> = {
  tab: "Maintenance",
  idKey: "id",
  columns: [
    col<MaintenanceRecord>("id", "Maintenance Record ID"),
    col<MaintenanceRecord>("billboardId", "Billboard ID"),
    col<MaintenanceRecord>("date", "Date", "date"),
    col<MaintenanceRecord>("kind", "Type", "text", { options: MAINTENANCE_KINDS }),
    col<MaintenanceRecord>("condition", "Condition", "text", { options: SITE_CONDITIONS }),
    col<MaintenanceRecord>("description", "What Was Found / Done", "text", { width: 300 }),
    col<MaintenanceRecord>("photoUrl", "Photo Link", "text", { width: 200 }),
    col<MaintenanceRecord>("nextInspection", "Next Inspection", "date"),
    col<MaintenanceRecord>("recordedAt", "Recorded At", "timestamp"),
    col<MaintenanceRecord>("recordedBy", "Recorded By"),
  ],
};

export const FILES_TABLE: TableSpec<BillboardFile> = {
  tab: "Documents",
  idKey: "id",
  columns: [
    col<BillboardFile>("id", "Document ID"),
    col<BillboardFile>("billboardId", "Billboard ID"),
    col<BillboardFile>("category", "Category", "text", { options: FILE_CATEGORIES }),
    col<BillboardFile>("title", "Title", "text", { width: 240 }),
    col<BillboardFile>("url", "Link", "text", { width: 260 }),
    col<BillboardFile>("documentDate", "Document Date", "date"),
    col<BillboardFile>("addedAt", "Added At", "timestamp"),
    col<BillboardFile>("addedBy", "Added By"),
    col<BillboardFile>("removed", "Removed", "boolean", { options: ["Yes", "No"] }),
    col<BillboardFile>("storedFileId", "Drive File ID"),
    col<BillboardFile>("mimeType", "File Type"),
  ],
};

export const ACTIVITY_TABLE: TableSpec<ActivityEntry> = {
  tab: "Activity Log",
  idKey: "id",
  columns: [
    col<ActivityEntry>("id", "Entry ID"),
    col<ActivityEntry>("at", "When", "timestamp"),
    col<ActivityEntry>("by", "Who"),
    col<ActivityEntry>("billboardId", "Billboard ID"),
    col<ActivityEntry>("action", "Action"),
    col<ActivityEntry>("details", "Details", "text", { width: 420 }),
  ],
};

export const BILLBOARD_TABLES = [
  BILLBOARDS_TABLE,
  CAMPAIGNS_TABLE,
  MAINTENANCE_TABLE,
  FILES_TABLE,
  ACTIVITY_TABLE,
] as const;


export { indexHeader, missingHeaders, readRow, writeRow, type TableColumn, type TableSpec } from "@/lib/data/table-spec";
