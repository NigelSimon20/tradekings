import { z } from "zod";

import {
  money,
  optionalDate,
  optionalEmail,
  parseForm,
  requiredDate,
  requiredUrl,
  text,
  withOptionalId,
  type Parsed,
} from "@/lib/forms/fields";
import {
  ACTION_STATUSES,
  APPLICATION_STATUSES,
  DOCUMENT_CATEGORIES,
  EMPLOYMENT_STATUSES,
  EXPAT_COMPANIES,
  LEASE_STATUSES,
  VEHICLE_OWNERSHIP,
  VEHICLE_STATUSES,
  type Dependant,
  type ExpatInput,
  type FollowUp,
  type Lease,
  type OffboardingInput,
  type Permit,
  type Vehicle,
} from "@/lib/expats/types";

/**
 * Validation for the Expat Tracker's forms, shared by the pages and the server
 * actions. Links must be http(s), so a `javascript:` URL can never be saved
 * into the sheet and run when clicked.
 */

const expatSchema = z
  .object({
    id: text,
    fullName: text.min(1, "Enter the expat's full name"),
    employeeNumber: text,
    nationality: text.min(1, "Enter their nationality"),
    dateOfBirth: optionalDate,
    phone: text,
    email: optionalEmail,
    residentialAddress: text,
    emergencyName: text,
    emergencyRelationship: text,
    emergencyPhone: text,
    company: z.enum(EXPAT_COMPANIES),
    department: text,
    position: text.min(1, "Enter their position"),
    managerName: text,
    managerEmail: optionalEmail,
    employmentStart: optionalDate,
    contractEnd: optionalDate,
    employmentStatus: z.enum(EMPLOYMENT_STATUSES),
    notes: text,
  })
  .refine((value) => !value.employmentStart || !value.contractEnd || value.contractEnd >= value.employmentStart, {
    message: "The contract must end after it starts",
    path: ["contractEnd"],
  });

const offboardSchema = z.object({
  departureDate: requiredDate("When did they leave (or when will they)?"),
  departureReason: text.min(1, "Say why they are leaving, e.g. contract ended or transferred"),
  permitClosure: text,
  propertyHandover: text,
  vehicleReturn: text,
  outstandingActions: text,
  offboardingNotes: text,
});

const dependantSchema = z.object({
  expatId: text.min(1),
  fullName: text.min(1, "Enter the dependant's full name"),
  relationship: text.min(1, "Choose the relationship"),
  dateOfBirth: optionalDate,
  nationality: text,
  notes: text,
});

const permitSchema = z
  .object({
    expatId: text.min(1),
    dependantId: text,
    type: text.min(1, "Choose or type what this is"),
    number: text,
    issuedBy: text,
    issueDate: optionalDate,
    expiryDate: optionalDate,
    status: z.enum(APPLICATION_STATUSES),
    reference: text,
    submittedOn: optionalDate,
    outstandingDocuments: text,
    replacesId: text,
    notes: text,
  })
  .refine((value) => !value.issueDate || !value.expiryDate || value.expiryDate >= value.issueDate, {
    message: "The expiry date must be on or after the issue date",
    path: ["expiryDate"],
  });

const leaseSchema = z
  .object({
    expatId: text.min(1),
    address: text.min(1, "Enter the property address"),
    landlordName: text,
    landlordPhone: text,
    landlordEmail: optionalEmail,
    startDate: optionalDate,
    expiryDate: optionalDate,
    monthlyRent: money("Monthly rent"),
    deposit: money("Deposit"),
    currency: text,
    noticeDate: optionalDate,
    status: z.enum(LEASE_STATUSES),
    notes: text,
  })
  .refine((value) => !value.startDate || !value.expiryDate || value.expiryDate >= value.startDate, {
    message: "The lease must end after it starts",
    path: ["expiryDate"],
  });

const vehicleSchema = z.object({
  expatId: text.min(1),
  description: text.min(1, "Describe the vehicle, e.g. Toyota Hilux"),
  registration: text,
  ownership: z.enum(VEHICLE_OWNERSHIP),
  licenceExpiry: optionalDate,
  insurer: text,
  policyNumber: text,
  insuranceExpiry: optionalDate,
  status: z.enum(VEHICLE_STATUSES),
  notes: text,
});

const actionSchema = z.object({
  expatId: text.min(1, "Choose the expat this is for"),
  title: text.min(1, "Say what needs doing"),
  responsibleName: text,
  responsibleEmail: optionalEmail,
  dueDate: optionalDate,
  status: z.enum(ACTION_STATUSES),
  notes: text,
});

const documentLinkSchema = z.object({
  expatId: text.min(1),
  dependantId: text,
  recordId: text,
  category: z.enum(DOCUMENT_CATEGORIES),
  title: text.min(1, "Give the document a title"),
  url: requiredUrl(),
  expiryDate: optionalDate,
});

const uploadSchema = z.object({
  expatId: text.min(1),
  dependantId: text,
  recordId: text,
  category: z.enum(DOCUMENT_CATEGORIES),
  title: text,
  expiryDate: optionalDate,
});

export type DependantInput = Omit<Dependant, "id" | "archived" | "lastUpdated" | "lastUpdatedBy">;
export type PermitInput = Omit<Permit, "id" | "lastUpdated" | "lastUpdatedBy">;
export type LeaseInput = Omit<Lease, "id" | "lastUpdated" | "lastUpdatedBy">;
export type VehicleInput = Omit<Vehicle, "id" | "lastUpdated" | "lastUpdatedBy">;
export type FollowUpInput = Omit<FollowUp, "id" | "createdAt" | "createdBy" | "completedAt" | "lastUpdated" | "lastUpdatedBy">;
export type DocumentLinkInput = z.infer<typeof documentLinkSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;

export const parseExpatForm = (formData: FormData): Parsed<ExpatInput> =>
  withOptionalId(parseForm(expatSchema, formData, { company: EXPAT_COMPANIES[0], employmentStatus: "Active" }));

export const parseOffboardForm = (formData: FormData): Parsed<OffboardingInput> => parseForm(offboardSchema, formData);

export const parseDependantForm = (formData: FormData): Parsed<DependantInput> => parseForm(dependantSchema, formData);

export const parsePermitForm = (formData: FormData): Parsed<PermitInput> => parseForm(permitSchema, formData, { status: "Issued" });

export const parseLeaseForm = (formData: FormData): Parsed<LeaseInput> => parseForm(leaseSchema, formData, { status: "Active" });

export const parseVehicleForm = (formData: FormData): Parsed<VehicleInput> =>
  parseForm(vehicleSchema, formData, { ownership: VEHICLE_OWNERSHIP[0], status: "In use" });

export const parseFollowUpForm = (formData: FormData): Parsed<FollowUpInput> => parseForm(actionSchema, formData, { status: "Open" });

export const parseDocumentLinkForm = (formData: FormData) => parseForm(documentLinkSchema, formData);

export const parseUploadForm = (formData: FormData) => parseForm(uploadSchema, formData);
