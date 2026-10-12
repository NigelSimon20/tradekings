/**
 * Shared state shape for the contract form.
 *
 * It lives outside the `"use server"` module on purpose: every export of a
 * server-action file is turned into a server reference, so constants must be
 * declared somewhere the client can import them directly.
 */
export interface ContractFormState {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
  /** Set after a successful create so the form can open the new contract. */
  contractId?: string;
}

export const EMPTY_FORM_STATE: ContractFormState = { status: "idle", message: "", errors: {} };

/** Result of adding or changing a person on the Users tab from the app. */
export interface UserAccessState {
  status: "idle" | "success" | "error";
  message: string;
}

export const EMPTY_USER_ACCESS_STATE: UserAccessState = { status: "idle", message: "" };

/** Result of any record form or action button in the billboard, license and expat trackers. */
export interface RecordFormState {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
  /** Set after a new record is saved, so the form can open it. */
  recordId?: string;
  /** Where to go once saved, if anywhere. */
  redirectTo?: string;
}

export const EMPTY_RECORD_FORM_STATE: RecordFormState = { status: "idle", message: "", errors: {} };

/** A server action a record form or button runs. */
export type RecordAction = (previous: RecordFormState, formData: FormData) => Promise<RecordFormState>;
