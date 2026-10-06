"use server";

import { revalidatePath } from "next/cache";

import { canExpats, type ExpatPermission } from "@/lib/auth/roles";
import type { ExpatFormState } from "@/lib/expats/form-state";
import { profileHref } from "@/lib/expats/meta";
import {
  parseDependantForm,
  parseDocumentLinkForm,
  parseExpatForm,
  parseFollowUpForm,
  parseLeaseForm,
  parseOffboardForm,
  parsePermitForm,
  parseVehicleForm,
  type ParsedExpatForm,
} from "@/lib/expats/schema";
import { ACTION_STATUSES, type ActionStatus, type ProfileSection } from "@/lib/expats/types";
import { getCurrentUser } from "@/lib/services/auth";
import {
  addExpatDocumentLink,
  disconnectExpatStorage,
  offboardExpat,
  removeExpatDocument,
  restoreExpat,
  saveDependant,
  saveExpat,
  saveFollowUp,
  saveLease,
  savePermit,
  saveReminderSettings,
  saveVehicle,
  seesSensitive,
  setDependantArchived,
  setDocumentHistorical,
  setFollowUpStatus,
  setUpExpatStorage,
} from "@/lib/services/expats";

/**
 * Every change to the Expat Tracker made from a form. Each action checks the
 * person's Expat Tracker permission itself — a hidden button is never the
 * only protection — and records who made the change. Someone who cannot see
 * sensitive details can still edit a record; the hidden values are kept.
 */

async function editor(permission: ExpatPermission) {
  const user = await getCurrentUser();
  if (!user || !canExpats(user, permission)) return null;
  return { actor: user.email || user.name, restricted: !seesSensitive(user) };
}

const refused = (what: string): ExpatFormState => ({
  status: "error",
  message: `Your account does not have permission to ${what}.`,
  errors: {},
});

const invalid = <T,>(parsed: ParsedExpatForm<T>): ExpatFormState => ({
  status: "error",
  message: "Check the highlighted fields and try again.",
  errors: parsed.errors,
});

const failed = (error: unknown): ExpatFormState => ({ status: "error", message: (error as Error).message, errors: {} });

const done = (message: string, redirectTo?: string): ExpatFormState => ({ status: "success", message, errors: {}, redirectTo });

function refresh(): void {
  revalidatePath("/expats", "layout");
}

const existingIdOf = (formData: FormData) => String(formData.get("existingId") ?? "").trim() || undefined;

/** A page the form asked to go back to, if it is one of ours. */
function returnTo(formData: FormData, fallback: string): string {
  const requested = String(formData.get("returnTo") ?? "");
  return requested.startsWith("/expats") && !requested.startsWith("//") ? requested : fallback;
}

/** The shape every "save one record" action shares. */
async function saveRecord<T extends { expatId: string }, R extends { id: string; expatId: string }>(
  formData: FormData,
  options: {
    permission: ExpatPermission;
    what: string;
    parse: (formData: FormData) => ParsedExpatForm<T>;
    save: (values: T, options: { actor: string; restricted: boolean; existingId?: string }) => Promise<R>;
    noun: string;
    section: ProfileSection;
  },
): Promise<ExpatFormState> {
  const who = await editor(options.permission);
  if (!who) return refused(options.what);
  const parsed = options.parse(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  const existingId = existingIdOf(formData);
  try {
    const saved = await options.save(parsed.values, { ...who, existingId });
    refresh();
    return done(
      existingId ? `${options.noun} updated.` : `${options.noun} added.`,
      returnTo(formData, profileHref(saved.expatId, options.section)),
    );
  } catch (error) {
    return failed(error);
  }
}

export async function saveExpatAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("editExpats");
  if (!who) return refused("add or change expat profiles");
  const parsed = parseExpatForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  const existingId = existingIdOf(formData);
  try {
    const saved = await saveExpat(parsed.values, { ...who, existingId });
    refresh();
    return done(existingId ? "Profile updated." : `${saved.fullName} added as ${saved.id}.`, profileHref(saved.id));
  } catch (error) {
    return failed(error);
  }
}

export async function saveDependantAction(_previous: ExpatFormState, formData: FormData) {
  return saveRecord(formData, {
    permission: "editExpats",
    what: "change dependants",
    parse: parseDependantForm,
    save: saveDependant,
    noun: "Dependant",
    section: "household",
  });
}

export async function savePermitAction(_previous: ExpatFormState, formData: FormData) {
  return saveRecord(formData, {
    permission: "editExpats",
    what: "change passports, permits or applications",
    parse: parsePermitForm,
    save: savePermit,
    noun: "Record",
    section: String(formData.get("dependantId") ?? "") ? "household" : "immigration",
  });
}

export async function saveLeaseAction(_previous: ExpatFormState, formData: FormData) {
  return saveRecord(formData, {
    permission: "editExpats",
    what: "change accommodation",
    parse: parseLeaseForm,
    save: saveLease,
    noun: "Lease",
    section: "accommodation",
  });
}

export async function saveVehicleAction(_previous: ExpatFormState, formData: FormData) {
  return saveRecord(formData, {
    permission: "editExpats",
    what: "change vehicles",
    parse: parseVehicleForm,
    save: saveVehicle,
    noun: "Vehicle",
    section: "vehicles",
  });
}

export async function saveFollowUpAction(_previous: ExpatFormState, formData: FormData) {
  return saveRecord(formData, {
    permission: "manageActions",
    what: "create or change follow-ups",
    parse: parseFollowUpForm,
    save: saveFollowUp,
    noun: "Follow-up",
    section: "actions",
  });
}

export async function setFollowUpStatusAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("manageActions");
  if (!who) return refused("update follow-ups");
  const status = String(formData.get("status") ?? "") as ActionStatus;
  if (!ACTION_STATUSES.includes(status)) return failed(new Error("Choose a status."));
  try {
    await setFollowUpStatus(String(formData.get("actionId") ?? ""), status, who.actor);
    refresh();
    return done(`Marked ${status.toLowerCase()}.`);
  } catch (error) {
    return failed(error);
  }
}

export async function archiveDependantAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("editExpats");
  if (!who) return refused("change dependants");
  try {
    const archive = formData.get("archive") === "1";
    await setDependantArchived(String(formData.get("dependantId") ?? ""), archive, who.actor);
    refresh();
    return done(archive ? "Moved to former household members." : "Back in the household.");
  } catch (error) {
    return failed(error);
  }
}

export async function offboardExpatAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("offboardExpats");
  if (!who) return refused("offboard expats");
  const parsed = parseOffboardForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  const id = String(formData.get("expatId") ?? "");
  try {
    await offboardExpat(id, parsed.values, who.actor);
    refresh();
    return done("Offboarded. The profile is archived with its history.", profileHref(id));
  } catch (error) {
    return failed(error);
  }
}

export async function restoreExpatAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("offboardExpats");
  if (!who) return refused("restore expats");
  try {
    await restoreExpat(String(formData.get("expatId") ?? ""), who.actor);
    refresh();
    return done("Restored to the active list.");
  } catch (error) {
    return failed(error);
  }
}

export async function addDocumentLinkAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("editExpats");
  if (!who) return refused("add documents");
  const parsed = parseDocumentLinkForm(formData);
  if (!parsed.ok || !parsed.values) return invalid(parsed);
  try {
    await addExpatDocumentLink(parsed.values, who.actor);
    refresh();
    return done("Document linked.");
  } catch (error) {
    return failed(error);
  }
}

export async function removeDocumentAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("removeExpatDocuments");
  if (!who) return refused("remove documents");
  try {
    await removeExpatDocument(String(formData.get("documentId") ?? ""), who.actor);
    refresh();
    return done("Removed. The record is kept in the sheet.");
  } catch (error) {
    return failed(error);
  }
}

export async function setDocumentHistoricalAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("editExpats");
  if (!who) return refused("change documents");
  try {
    const historical = formData.get("historical") === "1";
    await setDocumentHistorical(String(formData.get("documentId") ?? ""), historical, who.actor);
    refresh();
    return done(historical ? "Moved to history." : "Marked as current.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveReminderSettingsAction(_previous: ExpatFormState, formData: FormData): Promise<ExpatFormState> {
  const who = await editor("manageExpats");
  if (!who) return refused("change reminder settings");
  try {
    const rules = await saveReminderSettings(
      String(formData.get("reminderDays") ?? ""),
      String(formData.get("recipients") ?? ""),
      who.actor,
    );
    refresh();
    return done(
      `Reminders at ${rules.reminderDays.join(", ")} days, to ${rules.recipients.length ? rules.recipients.join(", ") : "each expat's manager only"}.`,
    );
  } catch (error) {
    return failed(error);
  }
}

export async function setUpExpatSheetAction(): Promise<ExpatFormState> {
  const who = await editor("manageExpats");
  if (!who) return refused("prepare the expat sheet");
  try {
    const result = await setUpExpatStorage();
    refresh();
    return { status: result.ok ? "success" : "error", message: result.messages.join(" "), errors: {} };
  } catch (error) {
    return failed(error);
  }
}

export async function disconnectExpatDriveAction(): Promise<ExpatFormState> {
  const who = await editor("manageExpats");
  if (!who) return refused("change document storage");
  try {
    await disconnectExpatStorage(who.actor);
    refresh();
    return done("Disconnected. New uploads are off until Drive is connected again.");
  } catch (error) {
    return failed(error);
  }
}
