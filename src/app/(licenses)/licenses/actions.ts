"use server";

import { revalidatePath } from "next/cache";

import { done, existingIdOf, failed, invalid, refused } from "@/lib/forms/action-results";
import { canLicenses, type LicensePermission } from "@/lib/auth/roles";
import type { RecordFormState } from "@/lib/domain/form-state";
import {
  parseAssetForm,
  parseDocumentLinkForm,
  parseLicenseForm,
} from "@/lib/licenses/schema";
import { getCurrentUser } from "@/lib/services/auth";
import {
  addDocumentLink,
  disconnectLicenseStorage,
  removeLicenseDocument,
  saveAsset,
  saveLicense,
  saveReminderDays,
  setAssetArchived,
  setLicenseArchived,
  setUpLicenseStorage,
} from "@/lib/services/licenses";

/**
 * Every change to the License Tracker made from a form. Each action checks the
 * person's License Tracker permission itself — a hidden button is never the
 * only protection — and records who made the change.
 */

async function actorWith(permission: LicensePermission): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !canLicenses(user, permission)) return null;
  return user.email || user.name;
}

function refresh(): void {
  revalidatePath("/licenses", "layout");
}

export async function saveLicenseAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const actor = await actorWith("editLicenses");
  if (!actor) return refused("change licenses");
  const parsed = parseLicenseForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  const existingId = existingIdOf(formData);
  try {
    const saved = await saveLicense(parsed.values, actor, existingId);
    refresh();
    return done(existingId ? "License updated." : `License ${saved.id} added.`, { recordId: saved.id });
  } catch (error) {
    return failed(error);
  }
}

export async function saveAssetAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const actor = await actorWith("manageAssets");
  if (!actor) return refused("change assets and locations");
  const parsed = parseAssetForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  const existingId = existingIdOf(formData);
  try {
    const saved = await saveAsset(parsed.values, actor, existingId);
    refresh();
    return done(existingId ? "Asset updated." : `Asset ${saved.id} added.`, { recordId: saved.id });
  } catch (error) {
    return failed(error);
  }
}

export async function addDocumentLinkAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const actor = await actorWith("editLicenses");
  if (!actor) return refused("add documents");
  const parsed = parseDocumentLinkForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addDocumentLink(parsed.values, actor);
    refresh();
    return done("Document linked.");
  } catch (error) {
    return failed(error);
  }
}

export async function removeLicenseDocumentAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const actor = await actorWith("removeLicenseDocuments");
  if (!actor) return refused("remove documents");
  try {
    await removeLicenseDocument(String(formData.get("documentId") ?? ""), actor);
    refresh();
    return done("Document removed. The record is kept in the sheet.");
  } catch (error) {
    return failed(error);
  }
}

export async function archiveLicenseAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const actor = await actorWith("editLicenses");
  if (!actor) return refused("archive licenses");
  const archive = formData.get("archive") === "1";
  try {
    await setLicenseArchived(String(formData.get("recordId") ?? ""), archive, actor);
    refresh();
    return done(archive ? "License archived. Its history is kept." : "License restored.");
  } catch (error) {
    return failed(error);
  }
}

export async function archiveAssetAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const actor = await actorWith("manageAssets");
  if (!actor) return refused("archive assets");
  const archive = formData.get("archive") === "1";
  try {
    await setAssetArchived(String(formData.get("recordId") ?? ""), archive, actor);
    refresh();
    return done(archive ? "Asset archived. Its history is kept." : "Asset restored.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveReminderDaysAction(_previous: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const actor = await actorWith("manageLicenses");
  if (!actor) return refused("change reminder days");
  try {
    const days = await saveReminderDays(String(formData.get("reminderDays") ?? ""), actor);
    refresh();
    return done(`Reminders now at ${days.join(", ")} days before expiry.`);
  } catch (error) {
    return failed(error);
  }
}

export async function setUpLicenseSheetAction(): Promise<RecordFormState> {
  const actor = await actorWith("manageLicenses");
  if (!actor) return refused("set up the license sheet");
  try {
    const result = await setUpLicenseStorage();
    refresh();
    return { status: result.ok ? "success" : "error", message: result.messages.join(" "), errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function disconnectLicenseDriveAction(): Promise<RecordFormState> {
  const actor = await actorWith("manageLicenses");
  if (!actor) return refused("disconnect Google Drive");
  try {
    await disconnectLicenseStorage(actor);
    refresh();
    return done("Disconnected. Files already uploaded stay in Drive.");
  } catch (error) {
    return failed(error);
  }
}
