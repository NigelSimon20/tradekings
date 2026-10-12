import { z } from "zod";

import { isISODate } from "@/lib/date/dates";

/**
 * The field rules and form plumbing every tracker's forms share. Each app's
 * schema module keeps only its own fields. Any value that becomes a link must
 * be http(s): a `javascript:` URL saved into a sheet would otherwise run when
 * someone clicks it.
 */

export const text = z.string().trim();

export const optionalEmail = text.refine((value) => value === "" || z.email().safeParse(value).success, {
  message: "Enter a valid email address",
});

export const optionalDate = text
  .refine((value) => value === "" || isISODate(value), { message: "Use the date picker (yyyy-mm-dd)" })
  .transform((value) => (value === "" ? null : value));

export const requiredDate = (message: string) => optionalDate.refine((value) => value !== null, { message });

export function optionalNumber(label: string, min: number, max: number, integer = false) {
  return text
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (Number.isFinite(value) && value >= min && value <= max), {
      message: `${label} must be between ${min} and ${max}`,
    })
    .refine((value) => !integer || value === null || Number.isInteger(value), {
      message: `${label} must be a whole number`,
    });
}

/** An amount of money: commas and spaces allowed, never negative. */
export const money = (label: string) =>
  text
    .transform((value) => (value === "" ? null : Number(value.replace(/[, ]/g, ""))))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 10_000_000), {
      message: `${label} must be a positive amount`,
    });

export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const LINK_MESSAGE = "Paste a full link starting with https://";

export const optionalUrl = text.refine((value) => value === "" || isSafeUrl(value), { message: LINK_MESSAGE });

export const requiredUrl = (missing = "Paste the link to the file") =>
  text.min(1, missing).refine(isSafeUrl, { message: LINK_MESSAGE });

/** A validated form: the values, or one message per field that failed. */
export interface Parsed<T> {
  ok: boolean;
  values: T | null;
  errors: Record<string, string>;
}

/** Every text field in a submitted form (files are left out). */
export function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

export function parseWith<T>(schema: z.ZodType<T>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, values: result.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key] && issue.message) errors[key] = issue.message;
  }
  return { ok: false, values: null, errors };
}

/**
 * Reads exactly the schema's fields from a form (blank when absent), with
 * `defaults` for fields left empty — a dropdown nobody touched, say.
 */
export function parseForm<S extends z.ZodObject>(
  schema: S,
  formData: FormData,
  defaults: Record<string, string> = {},
): Parsed<z.output<S>> {
  const raw = formValues(formData);
  const input = Object.fromEntries(Object.keys(schema.shape).map((key) => [key, raw[key] || defaults[key] || ""]));
  return parseWith(schema as unknown as z.ZodType<z.output<S>>, input);
}

/** "AS-012" or blank → the requested id, or undefined for "the next number". */
export function withOptionalId<T extends { id: string }>(parsed: Parsed<T>): Parsed<Omit<T, "id"> & { id?: string }> {
  if (!parsed.ok || !parsed.values) return { ...parsed, values: null };
  const { id, ...values } = parsed.values;
  return { ...parsed, values: { ...values, id: id.trim().toUpperCase() || undefined } };
}
