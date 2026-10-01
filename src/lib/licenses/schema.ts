import { z } from "zod";

import { isSafeUrl } from "@/lib/billboards/schema";
import { isISODate } from "@/lib/date/dates";
import {
  COMPANIES,
  DOCUMENT_CATEGORIES,
  RENEWAL_FREQUENCIES,
  RENEWAL_STATUSES,
  type AssetInput,
  type LicenseInput,
} from "@/lib/licenses/types";

/**
 * Validation for the License Tracker's forms, shared by the pages and the
 * server actions. Links must be http(s), so a `javascript:` URL can never be
 * saved into the sheet and run when clicked.
 */

const text = z.string().trim();

const optionalEmail = text.refine((value) => value === "" || z.email().safeParse(value).success, {
  message: "Enter a valid email address",
});

const optionalDate = text
  .refine((value) => value === "" || isISODate(value), { message: "Use the date picker (yyyy-mm-dd)" })
  .transform((value) => (value === "" ? null : value));

function optionalNumber(label: string, min: number, max: number) {
  return text
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (Number.isFinite(value) && value >= min && value <= max), {
      message: `${label} must be between ${min} and ${max}`,
    });
}

const assetSchema = z
  .object({
    id: text,
    name: text.min(1, "Give the asset a name people will recognise"),
    type: text.min(1, "Choose what kind of asset this is"),
    company: z.enum(COMPANIES),
    department: text,
    address: text,
    city: text,
    latitude: optionalNumber("Latitude", -90, 90),
    longitude: optionalNumber("Longitude", -180, 180),
    registration: text,
    responsibleName: text,
    responsibleEmail: optionalEmail,
    notes: text,
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: "Enter both latitude and longitude, or neither",
    path: ["longitude"],
  });

const licenseSchema = z
  .object({
    id: text,
    name: text.min(1, "Give the license a name"),
    category: text.min(1, "Choose or type a category"),
    type: text.min(1, "Choose or type the license type"),
    number: text,
    assetId: text,
    issuingAuthority: text,
    issueDate: optionalDate,
    expiryDate: optionalDate,
    renewalFrequency: z.enum(RENEWAL_FREQUENCIES),
    renewalStatus: z.enum(RENEWAL_STATUSES),
    department: text,
    responsibleName: text,
    responsibleEmail: optionalEmail,
    contactName: text,
    contactPhone: text,
    contactEmail: optionalEmail,
    conditions: text,
    lastRenewalDate: optionalDate,
  })
  .refine((value) => !value.issueDate || !value.expiryDate || value.expiryDate >= value.issueDate, {
    message: "The expiry date must be on or after the issue date",
    path: ["expiryDate"],
  });

const renewalSchema = z
  .object({
    licenseId: text.min(1),
    renewedOn: optionalDate.refine((value) => value !== null, { message: "When was it renewed?" }),
    newIssueDate: optionalDate,
    newExpiry: optionalDate,
    newNumber: text,
    notes: text,
  })
  .refine((value) => !value.newIssueDate || !value.newExpiry || value.newExpiry >= value.newIssueDate, {
    message: "The new expiry must be on or after the new issue date",
    path: ["newExpiry"],
  });

const documentLinkSchema = z.object({
  licenseId: text,
  assetId: text,
  category: z.enum(DOCUMENT_CATEGORIES),
  title: text.min(1, "Give the document a title"),
  url: text.min(1, "Paste the link to the file").refine(isSafeUrl, { message: "Paste a full link starting with https://" }),
  documentDate: optionalDate,
});

const uploadSchema = z.object({
  licenseId: text,
  assetId: text,
  category: z.enum(DOCUMENT_CATEGORIES),
  title: text,
  documentDate: optionalDate,
});

export interface ParsedLicenseForm<T> {
  ok: boolean;
  values: T | null;
  errors: Record<string, string>;
}

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

function parse<T>(schema: z.ZodType<T>, input: unknown): ParsedLicenseForm<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, values: result.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key] && issue.message) errors[key] = issue.message;
  }
  return { ok: false, values: null, errors };
}

function pick(raw: Record<string, string>, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, raw[key] ?? ""]));
}

export function parseAssetForm(formData: FormData): ParsedLicenseForm<AssetInput> {
  const raw = formValues(formData);
  const parsed = parse(assetSchema, {
    ...pick(raw, Object.keys(assetSchema.shape)),
    company: raw.company || COMPANIES[0],
  });
  if (!parsed.ok || !parsed.values) return { ...parsed, values: null };
  const { id, ...values } = parsed.values;
  return { ...parsed, values: { ...values, id: id || undefined } };
}

export function parseLicenseForm(formData: FormData): ParsedLicenseForm<LicenseInput> {
  const raw = formValues(formData);
  const parsed = parse(licenseSchema, {
    ...pick(raw, Object.keys(licenseSchema.shape)),
    renewalFrequency: raw.renewalFrequency || "Annual",
    renewalStatus: raw.renewalStatus || "Not started",
  });
  if (!parsed.ok || !parsed.values) return { ...parsed, values: null };
  const { id, ...values } = parsed.values;
  return { ...parsed, values: { ...values, id: id || undefined } };
}

export function parseRenewalForm(formData: FormData) {
  return parse(renewalSchema, pick(formValues(formData), Object.keys(renewalSchema.shape)));
}

export function parseDocumentLinkForm(formData: FormData) {
  return parse(documentLinkSchema, pick(formValues(formData), Object.keys(documentLinkSchema.shape)));
}

export function parseLicenseUploadForm(formData: FormData) {
  return parse(uploadSchema, pick(formValues(formData), Object.keys(uploadSchema.shape)));
}
