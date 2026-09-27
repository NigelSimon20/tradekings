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
import { isISODate } from "@/lib/date/dates";

/**
 * Validation for the billboard forms, shared by the pages and the server
 * actions. Every value that becomes a link must be http(s): a `javascript:`
 * URL saved into the sheet would otherwise run when someone clicks it.
 */

const text = z.string().trim();

const optionalEmail = text.refine((value) => value === "" || z.email().safeParse(value).success, {
  message: "Enter a valid email address",
});

const optionalDate = text
  .refine((value) => value === "" || isISODate(value), { message: "Use the date picker (yyyy-mm-dd)" })
  .transform((value) => (value === "" ? null : value));

export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const optionalUrl = text.refine((value) => value === "" || isSafeUrl(value), {
  message: "Paste a full link starting with https://",
});

const requiredUrl = text
  .min(1, "Paste the link to the file")
  .refine(isSafeUrl, { message: "Paste a full link starting with https://" });

function optionalNumber(label: string, min: number, max: number, integer = false) {
  return text
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (Number.isFinite(value) && value >= min && value <= max), {
      message: `${label} must be between ${min} and ${max}`,
    })
    .refine((value) => !integer || value === null || Number.isInteger(value), {
      message: `${label} must be a whole number`,
    });
}

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
  url: requiredUrl,
  documentDate: optionalDate,
});

export interface ParsedBillboardForm<T> {
  ok: boolean;
  values: T | null;
  errors: Record<string, string>;
}

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

function parse<T>(schema: z.ZodType<T>, input: unknown): ParsedBillboardForm<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, values: result.data, errors: {} };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, values: null, errors };
}

/** Keys the billboard form submits, each read as text (blank when absent). */
const BILLBOARD_TEXT_FIELDS = Object.keys(billboardSchema.shape).filter((key) => key !== "followUp");

export function parseBillboardForm(formData: FormData): ParsedBillboardForm<BillboardInput> {
  const raw = formValues(formData);
  const input: Record<string, unknown> = { followUp: raw.followUp === "on" };
  for (const key of BILLBOARD_TEXT_FIELDS) input[key] = raw[key] ?? "";
  if (!input.status) input.status = BILLBOARD_STATUSES[0];

  const parsed = parse(billboardSchema, input);
  if (!parsed.ok || !parsed.values) return { ...parsed, values: null };
  const { id, ...values } = parsed.values;
  return { ...parsed, values: { ...values, id: id || undefined } };
}

export function parseCampaignForm(formData: FormData): ParsedBillboardForm<NewCampaign> {
  const raw = formValues(formData);
  return parse(campaignSchema, {
    billboardId: raw.billboardId ?? "",
    brand: raw.brand ?? "",
    campaign: raw.campaign ?? "",
    startDate: raw.startDate ?? "",
    endDate: raw.endDate ?? "",
    installedOn: raw.installedOn ?? "",
    removedOn: raw.removedOn ?? "",
    artworkUrl: raw.artworkUrl ?? "",
    notes: raw.notes ?? "",
  }) as ParsedBillboardForm<NewCampaign>;
}

export function parseMaintenanceForm(formData: FormData): ParsedBillboardForm<NewMaintenanceRecord> {
  const raw = formValues(formData);
  return parse(maintenanceSchema, {
    billboardId: raw.billboardId ?? "",
    date: raw.date ?? "",
    kind: raw.kind ?? "",
    condition: raw.condition ?? "",
    description: raw.description ?? "",
    photoUrl: raw.photoUrl ?? "",
    nextInspection: raw.nextInspection ?? "",
  }) as ParsedBillboardForm<NewMaintenanceRecord>;
}

export function parseFileForm(formData: FormData): ParsedBillboardForm<NewBillboardFile> {
  const raw = formValues(formData);
  return parse(fileSchema, {
    billboardId: raw.billboardId ?? "",
    category: raw.category ?? "",
    title: raw.title ?? "",
    url: raw.url ?? "",
    documentDate: raw.documentDate ?? "",
  });
}
