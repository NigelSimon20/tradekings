"use server";

import { revalidatePath } from "next/cache";

import { done, existingIdOf, failed, invalid, refused } from "@/lib/forms/action-results";
import { canBillboards, type BillboardPermission } from "@/lib/auth/roles";
import type { RecordFormState } from "@/lib/domain/form-state";
import {
  parseBillboardForm,
  parseCampaignForm,
  parseFileForm,
  parseMaintenanceForm,
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

function refresh(): void {
  revalidatePath("/billboards", "layout");
}

export async function saveBillboardAction(
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("change billboards");

  const parsed = parseBillboardForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);

  const existingId = existingIdOf(formData);
  try {
    const saved = await saveBillboard(parsed.values, actor, existingId);
    refresh();
    return done(existingId ? "Billboard updated." : `Billboard ${saved.id} added.`, { recordId: saved.id });
  } catch (error) {
    return failed(error);
  }
}

export async function addCampaignAction(
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("record campaigns");

  const parsed = parseCampaignForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addCampaign(parsed.values, actor);
    refresh();
    return done("Campaign recorded.");
  } catch (error) {
    return failed(error);
  }
}

export async function addMaintenanceAction(
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("record maintenance");

  const parsed = parseMaintenanceForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addMaintenance(parsed.values, actor);
    refresh();
    return done("Maintenance recorded.");
  } catch (error) {
    return failed(error);
  }
}

export async function addFileAction(
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const actor = await actorWith("editBillboards");
  if (!actor) return refused("add documents");

  const parsed = parseFileForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addFile(parsed.values, actor);
    refresh();
    return done("Document added.");
  } catch (error) {
    return failed(error);
  }
}

export async function removeFileAction(
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const actor = await actorWith("removeDocuments");
  if (!actor) return refused("remove documents");
  try {
    await removeFile(String(formData.get("fileId") ?? ""), actor);
    refresh();
    return done("Document removed. The record is kept in the sheet.");
  } catch (error) {
    return failed(error);
  }
}

export async function archiveBillboardAction(
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const actor = await actorWith("archiveBillboards");
  if (!actor) return refused("archive billboards");

  const id = String(formData.get("billboardId") ?? "");
  const archive = formData.get("archive") === "1";
  try {
    await setBillboardArchived(id, archive, actor);
    refresh();
    return done(archive ? "Billboard archived. Its history is kept." : "Billboard restored.");
  } catch (error) {
    return failed(error);
  }
}

export async function disconnectDriveAction(): Promise<RecordFormState> {
  const actor = await actorWith("manageBillboards");
  if (!actor) return refused("disconnect Google Drive");
  try {
    await disconnectDriveAccount(actor);
    refresh();
    return done("Disconnected. Files already uploaded stay in Drive.");
  } catch (error) {
    return failed(error);
  }
}

export async function setUpBillboardSheetAction(): Promise<RecordFormState> {
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
