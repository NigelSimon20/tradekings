/**
 * Result shape shared by the License Tracker's forms. It lives outside the
 * `"use server"` actions file because that file may only export async
 * functions.
 */
export interface LicenseFormState {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
  /** Set after a new record is saved so the form can open it. */
  recordId?: string;
}

export const EMPTY_LICENSE_FORM_STATE: LicenseFormState = { status: "idle", message: "", errors: {} };
