import { z } from "zod";

import {
  optionalDate,
  optionalEmail,
  optionalNumber,
  parseForm,
  requiredUrl,
  text,
  withOptionalId,
  type Parsed,
} from "@/lib/forms/fields";
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
  url: requiredUrl(),
  documentDate: optionalDate,
});

const uploadSchema = z.object({
  licenseId: text,
  assetId: text,
  category: z.enum(DOCUMENT_CATEGORIES),
  title: text,
  documentDate: optionalDate,
});

export const parseAssetForm = (formData: FormData): Parsed<AssetInput> =>
  withOptionalId(parseForm(assetSchema, formData, { company: COMPANIES[0] }));

export const parseLicenseForm = (formData: FormData): Parsed<LicenseInput> =>
  withOptionalId(parseForm(licenseSchema, formData, { renewalFrequency: "Annual", renewalStatus: "Not started" }));

export const parseRenewalForm = (formData: FormData) => parseForm(renewalSchema, formData);

export const parseDocumentLinkForm = (formData: FormData) => parseForm(documentLinkSchema, formData);

export const parseLicenseUploadForm = (formData: FormData) => parseForm(uploadSchema, formData);
