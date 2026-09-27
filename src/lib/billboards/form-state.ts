/**
 * Result shape shared by the billboard forms. It lives outside the
 * `"use server"` actions file because that file may only export async
 * functions.
 */
export interface BillboardFormState {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
  /** Set after a new billboard is saved so the form can open its profile. */
  billboardId?: string;
}

export const EMPTY_BILLBOARD_FORM_STATE: BillboardFormState = {
  status: "idle",
  message: "",
  errors: {},
};
