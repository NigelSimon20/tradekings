import type { ISODate } from "@/lib/date/dates";

/**
 * The Expat Tracker's records. An expat's profile holds their dependants,
 * passports and permits (and applications for them), leases, vehicles,
 * follow-up actions and documents. Nothing is overwritten: a renewal is a new
 * permit record that replaces the old one, an ended lease or returned vehicle
 * stays as history, and an expat who leaves is archived with their offboarding
 * notes.
 */

export const EXPAT_COMPANIES = ["Trade Kings", "ZimKings"] as const;

export const EMPLOYMENT_STATUSES = ["Active", "On leave", "Notice period", "Inactive"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const RELATIONSHIPS = ["Spouse", "Partner", "Child", "Parent", "Other"] as const;

/** What a permit record can be. Free text is accepted too; these are offered. */
export const PERMIT_TYPES = [
  "Passport",
  "Visa",
  "Work permit",
  "Residence permit",
  "Temporary employment permit",
  "Driver's licence",
  "Medical insurance",
  "Other",
] as const;

/** Types that count as the right to work or live in the country. */
export const RIGHT_TO_WORK_TYPES: readonly string[] = ["Work permit", "Residence permit", "Temporary employment permit"];

/** The brief's application pipeline, then the two ways an application can close without being issued. */
export const APPLICATION_STATUSES = [
  "Documents Required",
  "Ready for Submission",
  "Submitted",
  "In Progress",
  "Approved",
  "Issued",
  "Refused",
  "Cancelled",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** The steps before a document is in hand. */
export const PIPELINE: readonly ApplicationStatus[] = [
  "Documents Required",
  "Ready for Submission",
  "Submitted",
  "In Progress",
  "Approved",
  "Issued",
];
export const OPEN_APPLICATION: readonly ApplicationStatus[] = PIPELINE.slice(0, -1);
export const CLOSED_APPLICATION: readonly ApplicationStatus[] = ["Refused", "Cancelled"];

export const LEASE_STATUSES = ["Active", "Renewal in progress", "Notice given", "Ended"] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

export const VEHICLE_OWNERSHIP = ["Company-owned", "Leased", "Personal"] as const;
export const VEHICLE_STATUSES = ["In use", "Returned", "Sold / disposed"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const ACTION_STATUSES = ["Open", "In progress", "Done", "Cancelled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const OPEN_ACTION: readonly ActionStatus[] = ["Open", "In progress"];

export const DOCUMENT_CATEGORIES = [
  "Passport",
  "Visa / permit",
  "Employment contract",
  "CV",
  "Dependant document",
  "Certificate",
  "Lease agreement",
  "Vehicle document",
  "Insurance document",
  "Application form",
  "Other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface Expat {
  id: string;
  fullName: string;
  employeeNumber: string;
  nationality: string;
  dateOfBirth: ISODate | null;
  phone: string;
  email: string;
  residentialAddress: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  company: string;
  department: string;
  position: string;
  managerName: string;
  managerEmail: string;
  employmentStart: ISODate | null;
  contractEnd: ISODate | null;
  employmentStatus: EmploymentStatus;
  notes: string;
  /** Offboarded: kept, but off the dashboard, lists and reminders. */
  archived: boolean;
  departureDate: ISODate | null;
  departureReason: string;
  permitClosure: string;
  propertyHandover: string;
  vehicleReturn: string;
  /** Follow-ups still open on departure, and who has them. */
  outstandingActions: string;
  offboardingNotes: string;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export type ExpatInput = Omit<
  Expat,
  | "id"
  | "archived"
  | "departureDate"
  | "departureReason"
  | "permitClosure"
  | "propertyHandover"
  | "vehicleReturn"
  | "outstandingActions"
  | "offboardingNotes"
  | "lastUpdated"
  | "lastUpdatedBy"
> & { id?: string };

export interface OffboardingInput {
  departureDate: ISODate | null;
  departureReason: string;
  permitClosure: string;
  propertyHandover: string;
  vehicleReturn: string;
  outstandingActions: string;
  offboardingNotes: string;
}

export interface Dependant {
  id: string;
  expatId: string;
  fullName: string;
  relationship: string;
  dateOfBirth: ISODate | null;
  nationality: string;
  notes: string;
  archived: boolean;
  lastUpdated: string;
  lastUpdatedBy: string;
}

/**
 * A passport, visa, permit, licence or cover — or an application for one. A
 * renewal is a new record whose `replacesId` names the one it renews; once it
 * is issued, the old one becomes history.
 */
export interface Permit {
  id: string;
  expatId: string;
  /** Blank when it belongs to the expat themselves. */
  dependantId: string;
  type: string;
  number: string;
  /** Country, authority or insurer. */
  issuedBy: string;
  issueDate: ISODate | null;
  expiryDate: ISODate | null;
  status: ApplicationStatus;
  /** Application or file reference. */
  reference: string;
  submittedOn: ISODate | null;
  /** Supporting documents still to be found, one per line. */
  outstandingDocuments: string;
  replacesId: string;
  notes: string;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export interface Lease {
  id: string;
  expatId: string;
  address: string;
  landlordName: string;
  landlordPhone: string;
  landlordEmail: string;
  startDate: ISODate | null;
  expiryDate: ISODate | null;
  monthlyRent: number | null;
  deposit: number | null;
  currency: string;
  /** The last day to give notice or agree a renewal. */
  noticeDate: ISODate | null;
  status: LeaseStatus;
  notes: string;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export interface Vehicle {
  id: string;
  expatId: string;
  description: string;
  registration: string;
  ownership: string;
  licenceExpiry: ISODate | null;
  insurer: string;
  policyNumber: string;
  insuranceExpiry: ISODate | null;
  status: VehicleStatus;
  notes: string;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export interface FollowUp {
  id: string;
  expatId: string;
  title: string;
  responsibleName: string;
  responsibleEmail: string;
  dueDate: ISODate | null;
  status: ActionStatus;
  notes: string;
  createdAt: string;
  createdBy: string;
  completedAt: string;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export interface ExpatDocument {
  id: string;
  expatId: string;
  dependantId: string;
  /** The permit, lease or vehicle it supports, if any. */
  recordId: string;
  category: DocumentCategory;
  title: string;
  url: string;
  storedFileId: string;
  mimeType: string;
  expiryDate: ISODate | null;
  /** Kept for the record but no longer the current copy. */
  historical: boolean;
  addedAt: string;
  addedBy: string;
  removed: boolean;
}

export const RECORD_TYPES = [
  "Expat",
  "Dependant",
  "Permit",
  "Lease",
  "Vehicle",
  "Action",
  "Document",
  "System",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export interface ExpatActivity {
  id: string;
  at: string;
  by: string;
  /** Whose profile it belongs to; blank for system changes. */
  expatId: string;
  recordType: RecordType;
  recordId: string;
  action: string;
  details: string;
}

/** One reminder email sent for one item and one window, so it is never sent twice. */
export interface ReminderLogEntry {
  id: string;
  /** The expiry item and its date: a renewed item (new date) starts over. */
  key: string;
  /** The reminder window (90, 60, 30, 7), or 0 for "has expired". */
  window: number;
  sentAt: string;
  sentTo: string;
}

export interface ExpatData {
  expats: Expat[];
  dependants: Dependant[];
  permits: Permit[];
  leases: Lease[];
  vehicles: Vehicle[];
  actions: FollowUp[];
  documents: ExpatDocument[];
  activity: ExpatActivity[];
  reminders: ReminderLogEntry[];
}

// ---------------------------------------------------------------------------
// Calculated by the rules engine.
// ---------------------------------------------------------------------------

export const EXPIRY_STATUSES = ["EXPIRED", "EXPIRING", "VALID"] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

/** The brief's groups of expiry dates. */
export const EXPIRY_GROUPS = [
  "Passports & immigration",
  "Dependant documents",
  "Employment",
  "Accommodation",
  "Vehicles & licences",
  "Insurance",
  "Other documents",
] as const;
export type ExpiryGroup = (typeof EXPIRY_GROUPS)[number];

/** Where on the profile an item lives, so links land on the right section. */
export type ProfileSection =
  | "immigration"
  | "household"
  | "employment"
  | "accommodation"
  | "vehicles"
  | "actions"
  | "documents";

/** One date to watch: a permit, the contract, a lease, a vehicle licence or cover. */
export interface ExpiryItem {
  key: string;
  expatId: string;
  expatName: string;
  /** Whose document it is: the expat or a dependant. */
  personName: string;
  dependantId: string;
  kind: string;
  group: ExpiryGroup;
  /** Document number, address or registration; blank when hidden from the viewer. */
  reference: string;
  recordId: string;
  section: ProfileSection;
  expiryDate: ISODate;
  daysRemaining: number;
  status: ExpiryStatus;
  /** The tightest reminder window it has entered (e.g. 30), or null. */
  reminderDays: number | null;
  /** A renewal is under way, so a reminder is not an action. */
  renewalInProgress: boolean;
  needsAction: boolean;
  responsibleName: string;
  responsibleEmail: string;
}

export const PROFILE_STATUSES = ["ACTION_REQUIRED", "MISSING_DOCUMENTS", "COMPLETE"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export interface ProfileIssue {
  status: Exclude<ProfileStatus, "COMPLETE">;
  text: string;
  section: ProfileSection;
}

/** A permit with what the engine knows about it. */
export interface EvaluatedPermit extends Permit {
  personName: string;
  /** Issued and not replaced: the copy in force. */
  current: boolean;
  /** Replaced by a newer issued record, refused or cancelled. */
  historical: boolean;
  /** Still moving through the pipeline. */
  inProgress: boolean;
  /** An open application that renews it. */
  renewal: Permit | null;
  outstanding: string[];
  expiry: ExpiryItem | null;
  documentCount: number;
}

export interface EvaluatedExpat {
  expat: Expat;
  dependants: Dependant[];
  permits: EvaluatedPermit[];
  leases: Lease[];
  vehicles: Vehicle[];
  actions: FollowUp[];
  documents: ExpatDocument[];
  expiries: ExpiryItem[];
  status: ProfileStatus;
  issues: ProfileIssue[];
  openActions: number;
  overdueActions: number;
  applicationsInProgress: number;
  /** The soonest date still ahead, for "next expiry" columns. */
  nextExpiry: ExpiryItem | null;
  currentLease: Lease | null;
}
