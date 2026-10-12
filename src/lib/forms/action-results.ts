import type { RecordFormState } from "@/lib/domain/form-state";
import type { Parsed } from "@/lib/forms/fields";

/**
 * What a record form's server action answers with — shared by every tracker,
 * so the same situation reads the same way everywhere.
 */

export const refused = (what: string): RecordFormState => ({
  status: "error",
  message: `Your account does not have permission to ${what}.`,
  errors: {},
});

export const invalid = <T,>(parsed: Parsed<T>): RecordFormState => ({
  status: "error",
  message: "Check the highlighted fields and try again.",
  errors: parsed.errors,
});

export const failed = (error: unknown): RecordFormState => ({
  status: "error",
  message: error instanceof Error ? error.message : String(error),
  errors: {},
});

export const done = (message: string, extra: Pick<RecordFormState, "recordId" | "redirectTo"> = {}): RecordFormState => ({
  status: "success",
  message,
  errors: {},
  ...extra,
});

/** The record a form edits; undefined when it adds a new one. */
export const existingIdOf = (formData: FormData): string | undefined =>
  String(formData.get("existingId") ?? "").trim() || undefined;
