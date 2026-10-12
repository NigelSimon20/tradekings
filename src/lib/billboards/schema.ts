import { z } from "zod";

import {
  BILLBOARD_STATUSES,
  FILE_CATEGORIES,
  SITE_CONDITIONS,
  type BillboardInput,
  type NewBillboardFile,
  type NewCampaign,
  type NewMaintenanceRecord,
} from "@/lib/billboards/types";
import {
  formValues,
  optionalDate,
  optionalEmail,
  optionalNumber,
  optionalUrl,
  parseForm,
  parseWith,
  requiredUrl,
  text,
  withOptionalId,
  type Parsed,
} from "@/lib/forms/fields";

/**
 * Validation for the billboard forms, shared by the pages and the server
 * actions. Every value that becomes a link must be http(s): a `javascript:`
 * URL saved into the sheet would otherwise run when someone clicks it.
 */

const billboardSchema = z
  .object({
    id: text,
    name: text.min(1, "Give the site a name people will recognise"),
    address: text,
    city: text.min(1, "City or town is required"),
    area: text,
    road: text,
    latitude: optionalNumber("Latitude", -90, 90),
    longitude: optionalNumber("Longitude", -180, 180),
    type: text,
    dimensions: text,
    faces: optionalNumber("Faces", 1, 20, true),
    status: z.enum(BILLBOARD_STATUSES),
    owner: text,
    leaseStart: optionalDate,
    leaseExpiry: optionalDate,
    leaseCost: text,
    noticePeriodDays: optionalNumber("Notice period", 0, 3650, true),
    renewalNotes: text,
    leaseDocumentUrl: optionalUrl,
    landlordName: text,
    landlordPhone: text,
    landlordEmail: optionalEmail,
    councilName: text,
    councilPhone: text,
    councilEmail: optionalEmail,
    contractorName: text,
    contractorPhone: text,
    contractorEmail: optionalEmail,
    responsibleName: text,
    responsibleEmail: optionalEmail,
    siteCondition: z.enum([...SITE_CONDITIONS, ""]),
    lastInspection: optionalDate,
    nextInspection: optionalDate,
    maintenanceIssues: text,
    maintenanceNotes: text,
    followUp: z.boolean(),
    followUpNote: text,
    notes: text,
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: "Enter both latitude and longitude, or neither",
    path: ["longitude"],
  })
  .refine((value) => !value.leaseStart || !value.leaseExpiry || value.leaseExpiry >= value.leaseStart, {
    message: "The lease must expire after it starts",
    path: ["leaseExpiry"],
  });

const campaignSchema = z
  .object({
    billboardId: text.min(1),
    brand: text.min(1, "Which brand or product is on the board?"),
    campaign: text,
    startDate: optionalDate.refine((value) => value !== null, { message: "When did it go up?" }),
    endDate: optionalDate,
    installedOn: optionalDate,
    removedOn: optionalDate,
    artworkUrl: optionalUrl,
    notes: text,
  })
  .refine((value) => !value.endDate || !value.startDate || value.endDate >= value.startDate, {
    message: "The campaign must end after it starts",
    path: ["endDate"],
  });

const maintenanceSchema = z.object({
  billboardId: text.min(1),
  date: optionalDate.refine((value) => value !== null, { message: "When did this happen?" }),
  kind: text.min(1, "Choose what kind of visit this was"),
  condition: z.enum([...SITE_CONDITIONS, ""]),
  description: text.min(1, "Describe what was found or done"),
  photoUrl: optionalUrl,
  nextInspection: optionalDate,
});

const fileSchema = z.object({
  billboardId: text.min(1),
  category: z.enum(FILE_CATEGORIES),
  title: text.min(1, "Give the file a title"),
  url: requiredUrl(),
  documentDate: optionalDate,
});

const uploadSchema = z.object({
  billboardId: text.min(1),
  category: z.enum(FILE_CATEGORIES),
  title: text,
  documentDate: optionalDate,
});

/** Keys the billboard form submits, each read as text (blank when absent). */
const BILLBOARD_TEXT_FIELDS = Object.keys(billboardSchema.shape).filter((key) => key !== "followUp");

export function parseBillboardForm(formData: FormData): Parsed<BillboardInput> {
  const raw = formValues(formData);
  const input: Record<string, unknown> = { followUp: raw.followUp === "on" };
  for (const key of BILLBOARD_TEXT_FIELDS) input[key] = raw[key] ?? "";
  if (!input.status) input.status = BILLBOARD_STATUSES[0];
  return withOptionalId(parseWith(billboardSchema, input));
}

export const parseCampaignForm = (formData: FormData): Parsed<NewCampaign> => parseForm(campaignSchema, formData);

export const parseMaintenanceForm = (formData: FormData): Parsed<NewMaintenanceRecord> =>
  parseForm(maintenanceSchema, formData) as Parsed<NewMaintenanceRecord>;

/** The fields sent with an uploaded file; the file itself is checked by the service. */
export function parseUploadForm(formData: FormData): Parsed<NewBillboardFile> {
  const parsed = parseForm(uploadSchema, formData);
  return parsed.ok && parsed.values ? { ...parsed, values: { ...parsed.values, url: "" } } : { ...parsed, values: null };
}

export const parseFileForm = (formData: FormData): Parsed<NewBillboardFile> => parseForm(fileSchema, formData);
