import { col, type TableSpec } from "@/lib/data/table-spec";
import {
  ASSET_TYPES,
  COMPANIES,
  DOCUMENT_CATEGORIES,
  RENEWAL_FREQUENCIES,
  RENEWAL_STATUSES,
  type Asset,
  type License,
  type LicenseActivity,
  type LicenseDocument,
  type Renewal,
} from "@/lib/licenses/types";

/**
 * The layout of the license spreadsheet: one tab per record type, columns
 * matched by heading. Category and license type are free text (with the
 * brief's list offered in the app), so new categories need no change here.
 */

export const ASSETS_TABLE: TableSpec<Asset> = {
  tab: "Assets & Locations",
  idKey: "id",
  columns: [
    col<Asset>("id", "Asset ID", "text", { width: 100 }),
    col<Asset>("name", "Name", "text", { width: 220 }),
    col<Asset>("type", "Asset Type", "text", { options: ASSET_TYPES }),
    col<Asset>("company", "Company", "text", { options: COMPANIES }),
    col<Asset>("department", "Department"),
    col<Asset>("address", "Address / Location", "text", { width: 240 }),
    col<Asset>("city", "City / Town"),
    col<Asset>("latitude", "Latitude", "number"),
    col<Asset>("longitude", "Longitude", "number"),
    col<Asset>("registration", "Vehicle Registration / Fleet No"),
    col<Asset>("responsibleName", "Responsible Person"),
    col<Asset>("responsibleEmail", "Responsible Email"),
    col<Asset>("notes", "Notes", "text", { width: 240 }),
    col<Asset>("archived", "Archived", "boolean", { options: ["Yes", "No"] }),
    col<Asset>("lastUpdated", "Last Updated", "timestamp"),
    col<Asset>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const LICENSES_TABLE: TableSpec<License> = {
  tab: "Licenses",
  idKey: "id",
  columns: [
    col<License>("id", "License ID", "text", { width: 100 }),
    col<License>("name", "License / Permit Name", "text", { width: 240 }),
    col<License>("category", "Category", "text", { width: 180 }),
    col<License>("type", "License Type", "text", { width: 180 }),
    col<License>("number", "License / Certificate Number"),
    col<License>("assetId", "Asset ID"),
    col<License>("issuingAuthority", "Issuing Authority", "text", { width: 200 }),
    col<License>("issueDate", "Issue Date", "date"),
    col<License>("expiryDate", "Expiry Date", "date"),
    col<License>("renewalFrequency", "Renewal Frequency", "text", { options: RENEWAL_FREQUENCIES }),
    col<License>("renewalStatus", "Renewal Status", "text", { options: RENEWAL_STATUSES }),
    col<License>("department", "Responsible Department"),
    col<License>("responsibleName", "Responsible Person"),
    col<License>("responsibleEmail", "Responsible Email"),
    col<License>("contactName", "Contact Name"),
    col<License>("contactPhone", "Contact Phone"),
    col<License>("contactEmail", "Contact Email"),
    col<License>("conditions", "Notes / Conditions", "text", { width: 260 }),
    col<License>("lastRenewalDate", "Last Renewal Date", "date"),
    col<License>("archived", "Archived", "boolean", { options: ["Yes", "No"] }),
    col<License>("lastUpdated", "Last Updated", "timestamp"),
    col<License>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const RENEWALS_TABLE: TableSpec<Renewal> = {
  tab: "Renewals",
  idKey: "id",
  columns: [
    col<Renewal>("id", "Renewal ID"),
    col<Renewal>("licenseId", "License ID"),
    col<Renewal>("renewedOn", "Renewed On", "date"),
    col<Renewal>("previousExpiry", "Previous Expiry", "date"),
    col<Renewal>("newIssueDate", "New Issue Date", "date"),
    col<Renewal>("newExpiry", "New Expiry", "date"),
    col<Renewal>("newNumber", "New Certificate Number"),
    col<Renewal>("documentId", "Document ID"),
    col<Renewal>("notes", "Notes", "text", { width: 260 }),
    col<Renewal>("recordedAt", "Recorded At", "timestamp"),
    col<Renewal>("recordedBy", "Recorded By"),
  ],
};

export const DOCUMENTS_TABLE: TableSpec<LicenseDocument> = {
  tab: "Documents",
  idKey: "id",
  columns: [
    col<LicenseDocument>("id", "Document ID"),
    col<LicenseDocument>("licenseId", "License ID"),
    col<LicenseDocument>("assetId", "Asset ID"),
    col<LicenseDocument>("category", "Category", "text", { options: DOCUMENT_CATEGORIES }),
    col<LicenseDocument>("title", "Title", "text", { width: 240 }),
    col<LicenseDocument>("url", "Link", "text", { width: 240 }),
    col<LicenseDocument>("storedFileId", "Drive File ID"),
    col<LicenseDocument>("mimeType", "File Type"),
    col<LicenseDocument>("documentDate", "Document Date", "date"),
    col<LicenseDocument>("addedAt", "Added At", "timestamp"),
    col<LicenseDocument>("addedBy", "Added By"),
    col<LicenseDocument>("removed", "Removed", "boolean", { options: ["Yes", "No"] }),
  ],
};

export const LICENSE_ACTIVITY_TABLE: TableSpec<LicenseActivity> = {
  tab: "Activity Log",
  idKey: "id",
  columns: [
    col<LicenseActivity>("id", "Entry ID"),
    col<LicenseActivity>("at", "When", "timestamp"),
    col<LicenseActivity>("by", "Who"),
    col<LicenseActivity>("recordType", "Record Type"),
    col<LicenseActivity>("recordId", "Record ID"),
    col<LicenseActivity>("action", "Action"),
    col<LicenseActivity>("details", "Details", "text", { width: 420 }),
  ],
};

export const LICENSE_TABLES = [
  ASSETS_TABLE,
  LICENSES_TABLE,
  RENEWALS_TABLE,
  DOCUMENTS_TABLE,
  LICENSE_ACTIVITY_TABLE,
] as const;
