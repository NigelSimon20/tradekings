import { col, type TableSpec } from "@/lib/data/table-spec";
import {
  ACTION_STATUSES,
  APPLICATION_STATUSES,
  DOCUMENT_CATEGORIES,
  EMPLOYMENT_STATUSES,
  EXPAT_COMPANIES,
  LEASE_STATUSES,
  PERMIT_TYPES,
  RECORD_TYPES,
  RELATIONSHIPS,
  VEHICLE_OWNERSHIP,
  VEHICLE_STATUSES,
  type Dependant,
  type Expat,
  type ExpatActivity,
  type ExpatData,
  type ExpatDocument,
  type FollowUp,
  type Lease,
  type Permit,
  type ReminderLogEntry,
  type Vehicle,
} from "@/lib/expats/types";

/**
 * The layout of the expat spreadsheet: one tab per record type, columns
 * matched by heading, so HR can reorder columns or add their own.
 */

export const EXPATS_TABLE: TableSpec<Expat> = {
  tab: "Expats",
  idKey: "id",
  columns: [
    col<Expat>("id", "Expat ID", "text", { width: 90 }),
    col<Expat>("fullName", "Full Name", "text", { width: 200 }),
    col<Expat>("employeeNumber", "Employee Number"),
    col<Expat>("nationality", "Nationality"),
    col<Expat>("dateOfBirth", "Date of Birth", "date"),
    col<Expat>("phone", "Phone"),
    col<Expat>("email", "Email", "text", { width: 200 }),
    col<Expat>("residentialAddress", "Residential Address", "text", { width: 240 }),
    col<Expat>("emergencyName", "Emergency Contact"),
    col<Expat>("emergencyRelationship", "Emergency Contact Relationship"),
    col<Expat>("emergencyPhone", "Emergency Contact Phone"),
    col<Expat>("company", "Company", "text", { options: EXPAT_COMPANIES }),
    col<Expat>("department", "Department"),
    col<Expat>("position", "Position", "text", { width: 180 }),
    col<Expat>("managerName", "Responsible Manager"),
    col<Expat>("managerEmail", "Manager Email", "text", { width: 200 }),
    col<Expat>("employmentStart", "Employment Start", "date"),
    col<Expat>("contractEnd", "Contract End", "date"),
    col<Expat>("employmentStatus", "Employment Status", "text", { options: EMPLOYMENT_STATUSES }),
    col<Expat>("notes", "Notes", "text", { width: 260 }),
    col<Expat>("archived", "Archived", "boolean", { options: ["Yes", "No"] }),
    col<Expat>("departureDate", "Departure Date", "date"),
    col<Expat>("departureReason", "Departure Reason"),
    col<Expat>("permitClosure", "Permit Closure / Cancellation", "text", { width: 220 }),
    col<Expat>("propertyHandover", "Property Handover", "text", { width: 220 }),
    col<Expat>("vehicleReturn", "Vehicle Return", "text", { width: 220 }),
    col<Expat>("outstandingActions", "Outstanding Actions on Departure", "text", { width: 240 }),
    col<Expat>("offboardingNotes", "Offboarding Notes", "text", { width: 260 }),
    col<Expat>("lastUpdated", "Last Updated", "timestamp"),
    col<Expat>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const DEPENDANTS_TABLE: TableSpec<Dependant> = {
  tab: "Dependants",
  idKey: "id",
  columns: [
    col<Dependant>("id", "Dependant ID", "text", { width: 100 }),
    col<Dependant>("expatId", "Expat ID"),
    col<Dependant>("fullName", "Full Name", "text", { width: 200 }),
    col<Dependant>("relationship", "Relationship", "text", { options: RELATIONSHIPS }),
    col<Dependant>("dateOfBirth", "Date of Birth", "date"),
    col<Dependant>("nationality", "Nationality"),
    col<Dependant>("notes", "Notes", "text", { width: 240 }),
    col<Dependant>("archived", "Archived", "boolean", { options: ["Yes", "No"] }),
    col<Dependant>("lastUpdated", "Last Updated", "timestamp"),
    col<Dependant>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const PERMITS_TABLE: TableSpec<Permit> = {
  tab: "Passports & Permits",
  idKey: "id",
  columns: [
    col<Permit>("id", "Record ID", "text", { width: 100 }),
    col<Permit>("expatId", "Expat ID"),
    col<Permit>("dependantId", "Dependant ID"),
    col<Permit>("type", "Type", "text", { options: PERMIT_TYPES, width: 180 }),
    col<Permit>("number", "Number"),
    col<Permit>("issuedBy", "Issued By (Country / Authority / Insurer)", "text", { width: 200 }),
    col<Permit>("issueDate", "Issue Date", "date"),
    col<Permit>("expiryDate", "Expiry Date", "date"),
    col<Permit>("status", "Status", "text", { options: APPLICATION_STATUSES, width: 160 }),
    col<Permit>("reference", "Application Reference"),
    col<Permit>("submittedOn", "Submitted On", "date"),
    col<Permit>("outstandingDocuments", "Outstanding Documents", "text", { width: 240 }),
    col<Permit>("replacesId", "Renews Record ID"),
    col<Permit>("notes", "Notes", "text", { width: 240 }),
    col<Permit>("lastUpdated", "Last Updated", "timestamp"),
    col<Permit>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const LEASES_TABLE: TableSpec<Lease> = {
  tab: "Leases",
  idKey: "id",
  columns: [
    col<Lease>("id", "Lease ID", "text", { width: 100 }),
    col<Lease>("expatId", "Expat ID"),
    col<Lease>("address", "Property / Address", "text", { width: 240 }),
    col<Lease>("landlordName", "Landlord"),
    col<Lease>("landlordPhone", "Landlord Phone"),
    col<Lease>("landlordEmail", "Landlord Email"),
    col<Lease>("startDate", "Lease Start", "date"),
    col<Lease>("expiryDate", "Lease Expiry", "date"),
    col<Lease>("monthlyRent", "Monthly Rent", "number"),
    col<Lease>("deposit", "Deposit", "number"),
    col<Lease>("currency", "Currency"),
    col<Lease>("noticeDate", "Notice / Renewal Date", "date"),
    col<Lease>("status", "Lease Status", "text", { options: LEASE_STATUSES }),
    col<Lease>("notes", "Notes", "text", { width: 240 }),
    col<Lease>("lastUpdated", "Last Updated", "timestamp"),
    col<Lease>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const VEHICLES_TABLE: TableSpec<Vehicle> = {
  tab: "Vehicles",
  idKey: "id",
  columns: [
    col<Vehicle>("id", "Vehicle ID", "text", { width: 100 }),
    col<Vehicle>("expatId", "Expat ID"),
    col<Vehicle>("description", "Vehicle", "text", { width: 200 }),
    col<Vehicle>("registration", "Registration"),
    col<Vehicle>("ownership", "Ownership", "text", { options: VEHICLE_OWNERSHIP }),
    col<Vehicle>("licenceExpiry", "Vehicle Licence Expiry", "date"),
    col<Vehicle>("insurer", "Insurer"),
    col<Vehicle>("policyNumber", "Policy Number"),
    col<Vehicle>("insuranceExpiry", "Insurance Expiry", "date"),
    col<Vehicle>("status", "Status", "text", { options: VEHICLE_STATUSES }),
    col<Vehicle>("notes", "Notes", "text", { width: 240 }),
    col<Vehicle>("lastUpdated", "Last Updated", "timestamp"),
    col<Vehicle>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const ACTIONS_TABLE: TableSpec<FollowUp> = {
  tab: "Follow-ups",
  idKey: "id",
  columns: [
    col<FollowUp>("id", "Action ID", "text", { width: 100 }),
    col<FollowUp>("expatId", "Expat ID"),
    col<FollowUp>("title", "Action", "text", { width: 260 }),
    col<FollowUp>("responsibleName", "Responsible Person"),
    col<FollowUp>("responsibleEmail", "Responsible Email", "text", { width: 200 }),
    col<FollowUp>("dueDate", "Due Date", "date"),
    col<FollowUp>("status", "Status", "text", { options: ACTION_STATUSES }),
    col<FollowUp>("notes", "Notes", "text", { width: 260 }),
    col<FollowUp>("createdAt", "Created At", "timestamp"),
    col<FollowUp>("createdBy", "Created By"),
    col<FollowUp>("completedAt", "Completed At", "timestamp"),
    col<FollowUp>("lastUpdated", "Last Updated", "timestamp"),
    col<FollowUp>("lastUpdatedBy", "Last Updated By"),
  ],
};

export const DOCUMENTS_TABLE: TableSpec<ExpatDocument> = {
  tab: "Documents",
  idKey: "id",
  columns: [
    col<ExpatDocument>("id", "Document ID"),
    col<ExpatDocument>("expatId", "Expat ID"),
    col<ExpatDocument>("dependantId", "Dependant ID"),
    col<ExpatDocument>("recordId", "Linked Record ID"),
    col<ExpatDocument>("category", "Document Type", "text", { options: DOCUMENT_CATEGORIES }),
    col<ExpatDocument>("title", "Title", "text", { width: 240 }),
    col<ExpatDocument>("url", "Link", "text", { width: 240 }),
    col<ExpatDocument>("storedFileId", "Drive File ID"),
    col<ExpatDocument>("mimeType", "File Type"),
    col<ExpatDocument>("expiryDate", "Expiry Date", "date"),
    col<ExpatDocument>("historical", "Historical", "boolean", { options: ["Yes", "No"] }),
    col<ExpatDocument>("addedAt", "Uploaded At", "timestamp"),
    col<ExpatDocument>("addedBy", "Uploaded By"),
    col<ExpatDocument>("removed", "Removed", "boolean", { options: ["Yes", "No"] }),
  ],
};

export const ACTIVITY_TABLE: TableSpec<ExpatActivity> = {
  tab: "Activity Log",
  idKey: "id",
  columns: [
    col<ExpatActivity>("id", "Entry ID"),
    col<ExpatActivity>("at", "When", "timestamp"),
    col<ExpatActivity>("by", "Who"),
    col<ExpatActivity>("expatId", "Expat ID"),
    col<ExpatActivity>("recordType", "Record Type", "text", { options: RECORD_TYPES }),
    col<ExpatActivity>("recordId", "Record ID"),
    col<ExpatActivity>("action", "Action"),
    col<ExpatActivity>("details", "Details", "text", { width: 420 }),
  ],
};

export const REMINDERS_TABLE: TableSpec<ReminderLogEntry> = {
  tab: "Reminders Sent",
  idKey: "id",
  columns: [
    col<ReminderLogEntry>("id", "Entry ID"),
    col<ReminderLogEntry>("key", "Item", "text", { width: 280 }),
    col<ReminderLogEntry>("window", "Days Before Expiry", "number"),
    col<ReminderLogEntry>("sentAt", "Sent At", "timestamp"),
    col<ReminderLogEntry>("sentTo", "Sent To", "text", { width: 280 }),
  ],
};

/** Every tab, keyed by the record type it holds. */
export const EXPAT_TABLES: { [K in keyof ExpatData]: TableSpec<ExpatData[K][number]> } = {
  expats: EXPATS_TABLE,
  dependants: DEPENDANTS_TABLE,
  permits: PERMITS_TABLE,
  leases: LEASES_TABLE,
  vehicles: VEHICLES_TABLE,
  actions: ACTIONS_TABLE,
  documents: DOCUMENTS_TABLE,
  activity: ACTIVITY_TABLE,
  reminders: REMINDERS_TABLE,
};

export const EXPAT_TABLE_NAMES = Object.keys(EXPAT_TABLES) as (keyof ExpatData)[];

/** One tab's definition, typed by its record (TypeScript cannot narrow the lookup itself). */
export function tableFor<K extends keyof ExpatData>(name: K): TableSpec<ExpatData[K][number]> {
  return EXPAT_TABLES[name] as TableSpec<ExpatData[K][number]>;
}
