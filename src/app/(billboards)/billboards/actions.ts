"use server";

import { revalidatePath } from "next/cache";

import { canBillboards, type BillboardPermission } from "@/lib/auth/roles";
import type { BillboardFormState } from "@/lib/billboards/form-state";
import {
  parseBillboardForm,
  parseCampaignForm,
  parseFileForm,
  parseMaintenanceForm,
  type ParsedBillboardForm,
} from "@/lib/billboards/schema";
import { getCurrentUser } from "@/lib/services/auth";
import {
  addCampaign,
  addFile,
  addMaintenance,
  disconnectDriveAccount,
  removeFile,
  saveBillboard,
  setBillboardArchived,
  setUpBillboardStorage,
} from "@/lib/services/billboards";

/**
 * Every change to the billboard tracker. Each action checks the person's
 * billboard access itself — a hidden button is never the only protection —
 * and records who made the change.
 */

async function actorWith(permission: BillboardPermission): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !canBillboards(user, permission)) return null;
  return user.email || user.name;
}

const refused = (what: string): BillboardFormState => ({
  status: "error",
  message: `Your account does not have permission to ${what}.`,
  errors: {},
});

const invalid = <T,>(parsed: ParsedBillboardForm<T>): BillboardFormState => ({
  status: "error",
  message: "Check the highlighted fields and try again.",
  errors: parsed.errors,
});

const failed = (error: unknown): BillboardFormState => ({
  status: "error",
  message: (error as Error).message,
  errors: {},
});

function refresh(): void {
  revalidatePath("/billboards", "layout");
}

export async function saveBillboardAction(
  _previous: BillboardFormState,
  formData: FormData,
): Promise<BillboardFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("change billboards");

  const parsed = parseBillboardForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);

  const existingId = String(formData.get("existingId") ?? "").trim() || undefined;
  try {
    const saved = await saveBillboard(parsed.values, actor, existingId);
    refresh();
    return {
      status: "success",
      message: existingId ? "Billboard updated." : `Billboard ${saved.id} added.`,
      errors: {},
      billboardId: saved.id,
    };
  } catch (error) {
    return failed(error);
  }
}

export async function addCampaignAction(
  _previous: BillboardFormState,
  formData: FormData,
): Promise<BillboardFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("record campaigns");

  const parsed = parseCampaignForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addCampaign(parsed.values, actor);
    refresh();
    return { status: "success", message: "Campaign recorded.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function addMaintenanceAction(
  _previous: BillboardFormState,
  formData: FormData,
): Promise<BillboardFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("record maintenance");

  const parsed = parseMaintenanceForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addMaintenance(parsed.values, actor);
    refresh();
    return { status: "success", message: "Maintenance recorded.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function addFileAction(
  _previous: BillboardFormState,
  formData: FormData,
): Promise<BillboardFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("add documents");

  const parsed = parseFileForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addFile(parsed.values, actor);
    refresh();
    return { status: "success", message: "Document added.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function removeFileAction(
  _previous: BillboardFormState,
  formData: FormData,
): Promise<BillboardFormState> {
  const actor = await actorWith("removeDocuments");
  if (!actor) return refused("remove documents");
  try {
    await removeFile(String(formData.get("fileId") ?? ""), actor);
    refresh();
    return { status: "success", message: "Document removed. The record is kept in the sheet.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function archiveBillboardAction(
  _previous: BillboardFormState,
  formData: FormData,
): Promise<BillboardFormState> {
  const actor = await actorWith("archiveBillboards");
  if (!actor) return refused("archive billboards");

  const id = String(formData.get("billboardId") ?? "");
  const archive = formData.get("archive") === "1";
  try {
    await setBillboardArchived(id, archive, actor);
    refresh();
    return {
      status: "success",
      message: archive ? "Billboard archived. Its history is kept." : "Billboard restored.",
      errors: {},
    };
  } catch (error) {
    return failed(error);
  }
}

export async function disconnectDriveAction(): Promise<BillboardFormState> {
  const actor = await actorWith("manageBillboards");
  if (!actor) return refused("disconnect Google Drive");
  try {
    await disconnectDriveAccount(actor);
    refresh();
    return { status: "success", message: "Disconnected. Files already uploaded stay in Drive.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function setUpBillboardSheetAction(): Promise<BillboardFormState> {
  const actor = await actorWith("manageBillboards");
  if (!actor) return refused("set up the billboard sheet");
  try {
    const result = await setUpBillboardStorage();
    refresh();
    return { status: result.ok ? "success" : "error", message: result.messages.join(" "), errors: {} };
  } catch (error) {
    return failed(error);
  }
}
