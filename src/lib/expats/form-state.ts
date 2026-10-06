/**
 * Result shape shared by the Expat Tracker's forms. It lives outside the
 * `"use server"` actions file because that file may only export async
 * functions.
 */
export interface ExpatFormState {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
  /** Where to go once a record is saved, if anywhere. */
  redirectTo?: string;
}

export const EMPTY_EXPAT_FORM_STATE: ExpatFormState = { status: "idle", message: "", errors: {} };
