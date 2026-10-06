import { z } from "zod";

import { isSafeUrl } from "@/lib/billboards/schema";
import { isISODate } from "@/lib/date/dates";
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

const text = z.string().trim();

const optionalEmail = text.refine((value) => value === "" || z.email().safeParse(value).success, {
  message: "Enter a valid email address",
});

const optionalDate = text
  .refine((value) => value === "" || isISODate(value), { message: "Use the date picker (yyyy-mm-dd)" })
  .transform((value) => (value === "" ? null : value));

const requiredDate = (message: string) => optionalDate.refine((value) => value !== null, { message });

const money = (label: string) =>
  text
    .transform((value) => (value === "" ? null : Number(value.replace(/[, ]/g, ""))))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 10_000_000), {
      message: `${label} must be a positive amount`,
    });

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
  url: text.min(1, "Paste the link to the file").refine(isSafeUrl, { message: "Paste a full link starting with https://" }),
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

export interface ParsedExpatForm<T> {
  ok: boolean;
  values: T | null;
  errors: Record<string, string>;
}

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

function parse<T>(schema: z.ZodType<T>, input: unknown): ParsedExpatForm<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, values: result.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key] && issue.message) errors[key] = issue.message;
  }
  return { ok: false, values: null, errors };
}

const pick = (raw: Record<string, string>, keys: string[]) => Object.fromEntries(keys.map((key) => [key, raw[key] ?? ""]));

export function parseExpatForm(formData: FormData): ParsedExpatForm<ExpatInput> {
  const raw = formValues(formData);
  const parsed = parse(expatSchema, {
    ...pick(raw, Object.keys(expatSchema.shape)),
    company: raw.company || EXPAT_COMPANIES[0],
    employmentStatus: raw.employmentStatus || "Active",
  });
  if (!parsed.ok || !parsed.values) return { ...parsed, values: null };
  const { id, ...values } = parsed.values;
  return { ...parsed, values: { ...values, id: id.toUpperCase() || undefined } };
}

export const parseOffboardForm = (formData: FormData): ParsedExpatForm<OffboardingInput> =>
  parse(offboardSchema, pick(formValues(formData), Object.keys(offboardSchema.shape))) as ParsedExpatForm<OffboardingInput>;

export const parseDependantForm = (formData: FormData): ParsedExpatForm<DependantInput> =>
  parse(dependantSchema, pick(formValues(formData), Object.keys(dependantSchema.shape)));

export function parsePermitForm(formData: FormData): ParsedExpatForm<PermitInput> {
  const raw = formValues(formData);
  return parse(permitSchema, { ...pick(raw, Object.keys(permitSchema.shape)), status: raw.status || "Issued" });
}

export function parseLeaseForm(formData: FormData): ParsedExpatForm<LeaseInput> {
  const raw = formValues(formData);
  return parse(leaseSchema, { ...pick(raw, Object.keys(leaseSchema.shape)), status: raw.status || "Active" });
}

export function parseVehicleForm(formData: FormData): ParsedExpatForm<VehicleInput> {
  const raw = formValues(formData);
  return parse(vehicleSchema, {
    ...pick(raw, Object.keys(vehicleSchema.shape)),
    ownership: raw.ownership || VEHICLE_OWNERSHIP[0],
    status: raw.status || "In use",
  });
}

export function parseFollowUpForm(formData: FormData): ParsedExpatForm<FollowUpInput> {
  const raw = formValues(formData);
  return parse(actionSchema, { ...pick(raw, Object.keys(actionSchema.shape)), status: raw.status || "Open" });
}

export const parseDocumentLinkForm = (formData: FormData) =>
  parse(documentLinkSchema, pick(formValues(formData), Object.keys(documentLinkSchema.shape)));

export const parseUploadForm = (formData: FormData) =>
  parse(uploadSchema, pick(formValues(formData), Object.keys(uploadSchema.shape)));
