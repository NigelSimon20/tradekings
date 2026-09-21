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
