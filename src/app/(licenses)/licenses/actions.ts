"use server";

import { revalidatePath } from "next/cache";

import { canLicenses, type LicensePermission } from "@/lib/auth/roles";
import type { LicenseFormState } from "@/lib/licenses/form-state";
import {
  parseAssetForm,
  parseDocumentLinkForm,
  parseLicenseForm,
  type ParsedLicenseForm,
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

const refused = (what: string): LicenseFormState => ({
  status: "error",
  message: `Your account does not have permission to ${what}.`,
  errors: {},
});

const invalid = <T,>(parsed: ParsedLicenseForm<T>): LicenseFormState => ({
  status: "error",
  message: "Check the highlighted fields and try again.",
  errors: parsed.errors,
});

const failed = (error: unknown): LicenseFormState => ({ status: "error", message: (error as Error).message, errors: {} });

function refresh(): void {
  revalidatePath("/licenses", "layout");
}

export async function saveLicenseAction(_previous: LicenseFormState, formData: FormData): Promise<LicenseFormState> {
  const actor = await actorWith("editLicenses");
  if (!actor) return refused("change licenses");
  const parsed = parseLicenseForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  const existingId = String(formData.get("existingId") ?? "").trim() || undefined;
  try {
    const saved = await saveLicense(parsed.values, actor, existingId);
    refresh();
    return {
      status: "success",
      message: existingId ? "License updated." : `License ${saved.id} added.`,
      errors: {},
      recordId: saved.id,
    };
  } catch (error) {
    return failed(error);
  }
}

export async function saveAssetAction(_previous: LicenseFormState, formData: FormData): Promise<LicenseFormState> {
  const actor = await actorWith("manageAssets");
  if (!actor) return refused("change assets and locations");
  const parsed = parseAssetForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  const existingId = String(formData.get("existingId") ?? "").trim() || undefined;
  try {
    const saved = await saveAsset(parsed.values, actor, existingId);
    refresh();
    return {
      status: "success",
      message: existingId ? "Asset updated." : `Asset ${saved.id} added.`,
      errors: {},
      recordId: saved.id,
    };
  } catch (error) {
    return failed(error);
  }
}

export async function addDocumentLinkAction(_previous: LicenseFormState, formData: FormData): Promise<LicenseFormState> {
  const actor = await actorWith("editLicenses");
  if (!actor) return refused("add documents");
  const parsed = parseDocumentLinkForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addDocumentLink(parsed.values, actor);
    refresh();
    return { status: "success", message: "Document linked.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function removeLicenseDocumentAction(_previous: LicenseFormState, formData: FormData): Promise<LicenseFormState> {
  const actor = await actorWith("removeLicenseDocuments");
  if (!actor) return refused("remove documents");
  try {
    await removeLicenseDocument(String(formData.get("documentId") ?? ""), actor);
    refresh();
    return { status: "success", message: "Document removed. The record is kept in the sheet.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function archiveLicenseAction(_previous: LicenseFormState, formData: FormData): Promise<LicenseFormState> {
  const actor = await actorWith("editLicenses");
  if (!actor) return refused("archive licenses");
  const archive = formData.get("archive") === "1";
  try {
    await setLicenseArchived(String(formData.get("recordId") ?? ""), archive, actor);
    refresh();
    return { status: "success", message: archive ? "License archived. Its history is kept." : "License restored.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function archiveAssetAction(_previous: LicenseFormState, formData: FormData): Promise<LicenseFormState> {
  const actor = await actorWith("manageAssets");
  if (!actor) return refused("archive assets");
  const archive = formData.get("archive") === "1";
  try {
    await setAssetArchived(String(formData.get("recordId") ?? ""), archive, actor);
    refresh();
    return { status: "success", message: archive ? "Asset archived. Its history is kept." : "Asset restored.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function saveReminderDaysAction(_previous: LicenseFormState, formData: FormData): Promise<LicenseFormState> {
  const actor = await actorWith("manageLicenses");
  if (!actor) return refused("change reminder days");
  try {
    const days = await saveReminderDays(String(formData.get("reminderDays") ?? ""), actor);
    refresh();
    return { status: "success", message: `Reminders now at ${days.join(", ")} days before expiry.`, errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function setUpLicenseSheetAction(): Promise<LicenseFormState> {
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

export async function disconnectLicenseDriveAction(): Promise<LicenseFormState> {
  const actor = await actorWith("manageLicenses");
  if (!actor) return refused("disconnect Google Drive");
  try {
    await disconnectLicenseStorage(actor);
    refresh();
    return { status: "success", message: "Disconnected. Files already uploaded stay in Drive.", errors: {} };
  } catch (error) {
    return failed(error);
  }
}
