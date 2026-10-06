import "server-only";

import { cache } from "react";

import { canExpats } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config/env";
import type { RepositoryHealth } from "@/lib/data/repository";
import { todayIn, type ISODate } from "@/lib/date/dates";
import { getMailer } from "@/lib/email/mailer";
import { getExpatRepository } from "@/lib/expats/data";
import {
  EMPTY_EXPAT_DATA,
  type ExpatRecord,
  type ExpatTable,
} from "@/lib/expats/data/repository";
import { tableFor } from "@/lib/expats/data/sheet-tables";
import { evaluateExpats, sortExpiries } from "@/lib/expats/evaluate";
import { EXPIRY_STATUS_META, PROFILE_STATUS_META } from "@/lib/expats/meta";
import { isSensitiveField, keepSensitive, redactExpatData, SENSITIVE_FIELDS } from "@/lib/expats/redact";
import { dueReminders, recipientsFor, renderReminderEmail, type DueReminder } from "@/lib/expats/reminders";
import { DEFAULT_EXPAT_RULES, parseRecipients, parseReminderDays, type ExpatRules } from "@/lib/expats/rules";
import type {
  DependantInput,
  DocumentLinkInput,
  FollowUpInput,
  LeaseInput,
  PermitInput,
  UploadInput,
  VehicleInput,
} from "@/lib/expats/schema";
import {
  OPEN_ACTION,
  type ActionStatus,
  type Dependant,
  type EvaluatedExpat,
  type EvaluatedPermit,
  type Expat,
  type ExpatActivity,
  type ExpatData,
  type ExpatDocument,
  type ExpatInput,
  type ExpiryItem,
  type FollowUp,
  type Lease,
  type OffboardingInput,
  type Permit,
  type RecordType,
  type ReminderLogEntry,
  type Vehicle,
} from "@/lib/expats/types";
import { getPhotoStore } from "@/lib/files";
import { MAX_UPLOAD_BYTES, detectFileType, storedFileName, titleFromFileName } from "@/lib/files/files";
import type { FileContent, FileLocation } from "@/lib/files/store";
import { buildXlsx, type XlsxSheet } from "@/lib/reports/xlsx";
import { checkStorage, connectStorageAccount, disconnectStorageAccount } from "@/lib/services/storage";

const DAYS_SETTING = "reminders.days";
const RECIPIENTS_SETTING = "reminders.recipients";

/** Whether this person sees sensitive details; everything they are shown is redacted otherwise. */
export const seesSensitive = (user: Pick<SessionUser, "expatPermissions"> | null) => canExpats(user, "viewSensitive");

/** The reminder days and recipients in force: set on Setup & access, or the brief's defaults. */
export async function getExpatRules(): Promise<ExpatRules> {
  const repository = getExpatRepository();
  try {
    const [days, recipients] = await Promise.all([
      repository.readSetting(DAYS_SETTING),
      repository.readSetting(RECIPIENTS_SETTING),
    ]);
    return {
      reminderDays: days ? parseReminderDays(days) : DEFAULT_EXPAT_RULES.reminderDays,
      recipients: parseRecipients(recipients),
    };
  } catch {
    return DEFAULT_EXPAT_RULES;
  }
}

export interface ExpatSnapshot {
  /** Expats on the books, with the rules applied. Offboarded ones are in `archived`. */
  people: EvaluatedExpat[];
  archived: EvaluatedExpat[];
  /** Every date to watch for the people on the books, most urgent first. */
  expiries: ExpiryItem[];
  /** Applications still moving through the pipeline. */
  applications: EvaluatedPermit[];
  /** Follow-ups for the people on the books. */
  actions: FollowUp[];
  activity: ExpatActivity[];
  rules: ExpatRules;
  today: ISODate;
  source: { kind: string; label: string };
  /** True when sensitive details have been blanked for this viewer. */
  restricted: boolean;
  /** Why the expat data could not be read, if it could not be. */
  error: string | null;
}

const readExpatData = cache(async (): Promise<{ data: ExpatData; error: string | null }> => {
  try {
    return { data: await getExpatRepository().readAll(), error: null };
  } catch (error) {
    console.error("Could not read the expat data:", error);
    return { data: EMPTY_EXPAT_DATA, error: error instanceof Error ? error.message : String(error) };
  }
});

const snapshotFor = cache(async (restricted: boolean): Promise<ExpatSnapshot> => {
  const repository = getExpatRepository();
  const today = todayIn(getConfig().timezone);
  const [{ data: raw, error }, rules] = await Promise.all([readExpatData(), getExpatRules()]);
  const data = restricted ? redactExpatData(raw) : raw;
  const evaluated = evaluateExpats(data, { today, rules });
  const people = evaluated.filter((row) => !row.expat.archived).sort((a, b) => a.expat.fullName.localeCompare(b.expat.fullName));
  const live = new Set(people.map((row) => row.expat.id));
  return {
    people,
    archived: evaluated.filter((row) => row.expat.archived),
    expiries: sortExpiries(people.flatMap((row) => row.expiries)),
    applications: people.flatMap((row) => row.permits.filter((permit) => permit.inProgress)),
    actions: data.actions.filter((action) => live.has(action.expatId)),
    activity: [...data.activity].sort((a, b) => b.at.localeCompare(a.at)),
    rules,
    today,
    source: { kind: repository.kind, label: repository.label },
    restricted,
    error,
  };
});

/** The expat data for one viewer, redacted unless they may see sensitive details. Never throws. */
export function loadExpats(user: Pick<SessionUser, "expatPermissions"> | null): Promise<ExpatSnapshot> {
  return snapshotFor(!seesSensitive(user));
}

export async function getExpatProfile(user: Pick<SessionUser, "expatPermissions"> | null, id: string) {
  const snapshot = await loadExpats(user);
  const row = [...snapshot.people, ...snapshot.archived].find((entry) => entry.expat.id === id);
  if (!row) return null;
  return {
    row,
    snapshot,
    activity: snapshot.activity.filter((entry) => entry.expatId === id),
  };
}

export async function checkExpatSource(): Promise<RepositoryHealth & { kind: string; label: string }> {
  const repository = getExpatRepository();
  return { kind: repository.kind, label: repository.label, ...(await repository.healthCheck()) };
}

export function setUpExpatStorage() {
  return getExpatRepository().setUpStorage();
}

// ---------------------------------------------------------------------------
// Changes. Each is stamped with who and when, and leaves an Activity Log entry
// on the expat's profile with what changed — the brief's activity history.
// Sensitive values are never written into the log, only that they changed.
// ---------------------------------------------------------------------------

const stamp = () => new Date().toISOString();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function logEntry(expatId: string, recordType: RecordType, recordId: string, by: string, action: string, details = ""): ExpatActivity {
  return { id: newId("LOG"), at: stamp(), by, expatId, recordType, recordId, action, details };
}

/** `EXP-013` after `EXP-012`, so references stay short and readable. */
function nextId(prefix: string, existing: { id: string }[]): string {
  const pattern = new RegExp(`^${prefix.replace(/[-]/g, "\\-")}-?(\\d+)$`, "i");
  const highest = existing.reduce((max, item) => {
    const match = pattern.exec(item.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

const IGNORED = new Set(["lastUpdated", "lastUpdatedBy", "createdAt", "createdBy", "completedAt"]);
const SENSITIVE_TABLE: Partial<Record<ExpatTable, keyof typeof SENSITIVE_FIELDS>> = {
  expats: "expats",
  dependants: "dependants",
  permits: "permits",
  leases: "leases",
  vehicles: "vehicles",
  documents: "documents",
};

/** "Expiry Date: 2026-01-31 → 2027-01-31; Number: changed" */
function describeChanges<K extends ExpatTable>(table: K, before: ExpatRecord<K>, after: ExpatRecord<K>): string {
  const labels = new Map(tableFor(table).columns.map((column) => [column.key as string, column.header]));
  const sensitive = SENSITIVE_TABLE[table];
  const show = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "(blank)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };
  const was: Record<string, unknown> = { ...before };
  const now: Record<string, unknown> = { ...after };
  return Object.keys(now)
    .filter((key) => !IGNORED.has(key) && show(was[key]) !== show(now[key]))
    .map((key) =>
      sensitive && isSensitiveField(sensitive, key)
        ? `${labels.get(key) ?? key}: changed`
        : `${labels.get(key) ?? key}: ${show(was[key])} → ${show(now[key])}`,
    )
    .join("; ");
}

interface SaveOptions {
  actor: string;
  /** The editor cannot see sensitive details, so their blanks must not overwrite stored values. */
  restricted: boolean;
  existingId?: string;
}

const RECORD_TYPE: Record<ExpatTable, RecordType> = {
  expats: "Expat",
  dependants: "Dependant",
  permits: "Permit",
  leases: "Lease",
  vehicles: "Vehicle",
  actions: "Action",
  documents: "Document",
  activity: "System",
  reminders: "System",
};

/**
 * Adds or updates one record and logs it: reads fresh, keeps hidden values
 * for a restricted editor, records only real changes.
 */
async function saveTracked<K extends ExpatTable>(
  table: K,
  options: SaveOptions & {
    build: (before: ExpatRecord<K> | null, data: ExpatData) => ExpatRecord<K>;
    expatIdOf: (record: ExpatRecord<K>) => string;
    added: (record: ExpatRecord<K>) => string;
  },
): Promise<ExpatRecord<K>> {
  const repository = getExpatRepository();
  const data = await repository.readAll(true);
  const rows = data[table] as ExpatRecord<K>[];
  const before = options.existingId
    ? (rows.find((row) => (row as { id: string }).id === options.existingId) ?? null)
    : null;
  if (options.existingId && !before) throw new Error(`${options.existingId} was not found. It may have been removed.`);

  let after = options.build(before, data);
  const sensitive = SENSITIVE_TABLE[table];
  if (before && options.restricted && sensitive) after = keepSensitive(sensitive, before, after);
  const id = (after as { id: string }).id;

  if (before) {
    const changes = describeChanges(table, before, after);
    if (!changes) return before;
    await repository.save(table, after);
    await repository.append("activity", [logEntry(options.expatIdOf(after), RECORD_TYPE[table], id, options.actor, "Updated", changes)]);
  } else {
    await repository.save(table, after);
    await repository.append("activity", [logEntry(options.expatIdOf(after), RECORD_TYPE[table], id, options.actor, "Added", options.added(after))]);
  }
  return after;
}

function requireExpat(data: ExpatData, expatId: string): Expat {
  const expat = data.expats.find((record) => record.id === expatId);
  if (!expat) throw new Error("That expat was not found.");
  return expat;
}

function requireDependant(data: ExpatData, expatId: string, dependantId: string): Dependant | null {
  if (!dependantId) return null;
  const dependant = data.dependants.find((record) => record.id === dependantId && record.expatId === expatId);
  if (!dependant) throw new Error("That dependant is not part of this expat's household.");
  return dependant;
}

const touched = (actor: string) => ({ lastUpdated: stamp(), lastUpdatedBy: actor });

export function saveExpat(input: ExpatInput, options: SaveOptions): Promise<Expat> {
  return saveTracked("expats", {
    ...options,
    expatIdOf: (record) => record.id,
    added: (record) => `${record.position} — ${record.company}`,
    build: (before, data) => {
      const { id: requested, ...fields } = input;
      if (before) return { ...before, ...fields, ...touched(options.actor) };
      if (requested && data.expats.some((expat) => expat.id.toUpperCase() === requested)) {
        throw new Error(`There is already an expat with the ID ${requested}.`);
      }
      return {
        ...fields,
        id: requested || nextId("EXP", data.expats),
        archived: false,
        departureDate: null,
        departureReason: "",
        permitClosure: "",
        propertyHandover: "",
        vehicleReturn: "",
        outstandingActions: "",
        offboardingNotes: "",
        ...touched(options.actor),
      };
    },
  });
}

export function saveDependant(input: DependantInput, options: SaveOptions): Promise<Dependant> {
  return saveTracked("dependants", {
    ...options,
    expatIdOf: (record) => record.expatId,
    added: (record) => `${record.relationship}: ${record.fullName}`,
    build: (before, data) => {
      const expat = requireExpat(data, before?.expatId ?? input.expatId);
      if (before) return { ...before, ...input, expatId: before.expatId, ...touched(options.actor) };
      const own = data.dependants.filter((dependant) => dependant.expatId === expat.id);
      const number = own.reduce((max, dependant) => Math.max(max, Number(/-D(\d+)$/.exec(dependant.id)?.[1] ?? 0)), 0) + 1;
      return { ...input, id: `${expat.id}-D${number}`, archived: false, ...touched(options.actor) };
    },
  });
}

export async function setDependantArchived(id: string, archived: boolean, actor: string): Promise<void> {
  const repository = getExpatRepository();
  const dependant = (await repository.readAll(true)).dependants.find((record) => record.id === id);
  if (!dependant) throw new Error("That dependant was not found.");
  if (dependant.archived === archived) return;
  await repository.save("dependants", { ...dependant, archived, ...touched(actor) });
  await repository.append("activity", [
    logEntry(
      dependant.expatId,
      "Dependant",
      id,
      actor,
      archived ? "Left the household" : "Back in the household",
      archived ? `${dependant.fullName} — their records are kept as history.` : dependant.fullName,
    ),
  ]);
}

export async function savePermit(input: PermitInput, options: SaveOptions): Promise<Permit> {
  const saved = await saveTracked("permits", {
    ...options,
    expatIdOf: (record) => record.expatId,
    added: (record) => `${record.type}${record.replacesId ? ` (renews ${record.replacesId})` : ""} — ${record.status}`,
    build: (before, data) => {
      const expatId = before?.expatId ?? input.expatId;
      requireExpat(data, expatId);
      requireDependant(data, expatId, input.dependantId);
      if (input.replacesId) {
        const replaced = data.permits.find((permit) => permit.id === input.replacesId);
        if (!replaced || replaced.expatId !== expatId || replaced.dependantId !== input.dependantId) {
          throw new Error("A renewal can only replace a record held by the same person.");
        }
        if (replaced.id === before?.id) throw new Error("A record cannot renew itself.");
      }
      if (before) return { ...before, ...input, expatId, ...touched(options.actor) };
      return { ...input, id: nextId("PER", data.permits), ...touched(options.actor) };
    },
  });
  return saved;
}

export function saveLease(input: LeaseInput, options: SaveOptions): Promise<Lease> {
  return saveTracked("leases", {
    ...options,
    expatIdOf: (record) => record.expatId,
    added: (record) => `${record.status} lease`,
    build: (before, data) => {
      const expatId = before?.expatId ?? input.expatId;
      requireExpat(data, expatId);
      if (before) return { ...before, ...input, expatId, ...touched(options.actor) };
      return { ...input, id: nextId("LSE", data.leases), ...touched(options.actor) };
    },
  });
}

export function saveVehicle(input: VehicleInput, options: SaveOptions): Promise<Vehicle> {
  return saveTracked("vehicles", {
    ...options,
    expatIdOf: (record) => record.expatId,
    added: (record) => [record.description, record.registration, record.ownership].filter(Boolean).join(" · "),
    build: (before, data) => {
      const expatId = before?.expatId ?? input.expatId;
      requireExpat(data, expatId);
      if (before) return { ...before, ...input, expatId, ...touched(options.actor) };
      return { ...input, id: nextId("VEH", data.vehicles), ...touched(options.actor) };
    },
  });
}

const completedAtFor = (status: ActionStatus, previous: FollowUp | null) =>
  OPEN_ACTION.includes(status) ? "" : previous && !OPEN_ACTION.includes(previous.status) ? previous.completedAt : stamp();

export function saveFollowUp(input: FollowUpInput, options: SaveOptions): Promise<FollowUp> {
  return saveTracked("actions", {
    ...options,
    expatIdOf: (record) => record.expatId,
    added: (record) => `${record.title}${record.responsibleName ? ` — ${record.responsibleName}` : ""}`,
    build: (before, data) => {
      const expatId = before?.expatId ?? input.expatId;
      requireExpat(data, expatId);
      if (before) {
        return { ...before, ...input, expatId, completedAt: completedAtFor(input.status, before), ...touched(options.actor) };
      }
      return {
        ...input,
        id: nextId("FUP", data.actions),
        createdAt: stamp(),
        createdBy: options.actor,
        completedAt: completedAtFor(input.status, null),
        ...touched(options.actor),
      };
    },
  });
}

export async function setFollowUpStatus(id: string, status: ActionStatus, actor: string): Promise<FollowUp> {
  const repository = getExpatRepository();
  const action = (await repository.readAll(true)).actions.find((record) => record.id === id);
  if (!action) throw new Error("That follow-up was not found.");
  const { id: _id, createdAt, createdBy, completedAt, lastUpdated, lastUpdatedBy, ...input } = action;
  void [_id, createdAt, createdBy, completedAt, lastUpdated, lastUpdatedBy];
  return saveFollowUp({ ...input, status }, { actor, restricted: false, existingId: id });
}

/**
 * Offboarding: the profile is archived, never deleted. The departure, permit
 * closure, property handover, vehicle return, outstanding actions and final
 * notes are kept on it; its records stay as history.
 */
export async function offboardExpat(id: string, input: OffboardingInput, actor: string): Promise<Expat> {
  const repository = getExpatRepository();
  const before = (await repository.readAll(true)).expats.find((record) => record.id === id);
  if (!before) throw new Error("That expat was not found.");
  const after: Expat = { ...before, ...input, archived: true, employmentStatus: "Inactive", ...touched(actor) };
  await repository.save("expats", after);
  await repository.append("activity", [
    logEntry(id, "Expat", id, actor, "Offboarded", `${input.departureReason} — left ${input.departureDate ?? "(no date)"}`),
  ]);
  return after;
}

export async function restoreExpat(id: string, actor: string): Promise<void> {
  const repository = getExpatRepository();
  const before = (await repository.readAll(true)).expats.find((record) => record.id === id);
  if (!before) throw new Error("That expat was not found.");
  if (!before.archived) return;
  await repository.save("expats", { ...before, archived: false, employmentStatus: "Active", ...touched(actor) });
  await repository.append("activity", [
    logEntry(id, "Expat", id, actor, "Restored", "Back on the books; the offboarding record is kept on the profile."),
  ]);
}

// ---------------------------------------------------------------------------
// Documents. Uploads are filed as Trade Kings Expats / EXP-001 – Name
// (/ dependant), named by the date they were added; nothing is overwritten.
// ---------------------------------------------------------------------------

/** `2026-10-06 140512` in the app's timezone, so a folder lists in the order files were added. */
function fileStamp(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: getConfig().timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}${part("minute")}${part("second")}`;
}

const folderSafe = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

function documentLocation(expat: Expat, dependant: Dependant | null): FileLocation {
  const folder = folderSafe(`${expat.id} – ${expat.fullName}`);
  return dependant
    ? { folders: [folder, folderSafe(`${dependant.fullName} (${dependant.relationship})`)], key: { name: "expatDependantId", value: dependant.id } }
    : { folders: [folder], key: { name: "expatId", value: expat.id } };
}

function resolveDocumentTarget(data: ExpatData, target: { expatId: string; dependantId: string; recordId: string }) {
  const expat = requireExpat(data, target.expatId);
  const dependant = requireDependant(data, expat.id, target.dependantId);
  if (target.recordId) {
    const owned = [...data.permits, ...data.leases, ...data.vehicles].some(
      (record) => record.id === target.recordId && record.expatId === expat.id,
    );
    if (!owned) throw new Error("Link the document to one of this expat's own records.");
  }
  return { expat, dependant };
}

async function recordDocument(document: ExpatDocument, actor: string, action: string): Promise<void> {
  const repository = getExpatRepository();
  await repository.save("documents", document);
  await repository.append("activity", [
    logEntry(document.expatId, "Document", document.id, actor, action, document.category),
  ]);
}

export async function addExpatDocumentLink(input: DocumentLinkInput, actor: string): Promise<ExpatDocument> {
  const data = await getExpatRepository().readAll(true);
  const { expat, dependant } = resolveDocumentTarget(data, input);
  const document: ExpatDocument = {
    id: newId("DOC"),
    expatId: expat.id,
    dependantId: dependant?.id ?? "",
    recordId: input.recordId,
    category: input.category,
    title: input.title,
    url: input.url,
    storedFileId: "",
    mimeType: "",
    expiryDate: input.expiryDate,
    historical: false,
    addedAt: stamp(),
    addedBy: actor,
    removed: false,
  };
  await recordDocument(document, actor, "Document linked");
  return document;
}

/** Stores an uploaded file in the expat's folder and records it. The type comes from its contents. */
export async function uploadExpatDocument(
  input: UploadInput,
  upload: { name: string; bytes: Uint8Array },
  actor: string,
): Promise<ExpatDocument> {
  if (upload.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("That file is larger than 4 MB. Photos are shrunk automatically; for a PDF, scan it at a lower resolution.");
  }
  const type = detectFileType(upload.bytes);
  if (!type) throw new Error("Only PDF documents and photos (JPG, PNG, WebP) can be uploaded.");

  const data = await getExpatRepository().readAll(true);
  const { expat, dependant } = resolveDocumentTarget(data, input);
  const title = input.title.trim() || titleFromFileName(upload.name) || input.category;
  const whose = dependant?.fullName ?? expat.fullName;
  const stored = await (await getPhotoStore("expats")).save(documentLocation(expat, dependant), {
    name: storedFileName(fileStamp(), input.category, `${whose} – ${title}`, type.extension),
    mimeType: type.mimeType,
    bytes: upload.bytes,
  });

  const document: ExpatDocument = {
    id: newId("DOC"),
    expatId: expat.id,
    dependantId: dependant?.id ?? "",
    recordId: input.recordId,
    category: input.category,
    title,
    url: stored.url,
    storedFileId: stored.id,
    mimeType: type.mimeType,
    expiryDate: input.expiryDate,
    historical: false,
    addedAt: stamp(),
    addedBy: actor,
    removed: false,
  };
  await recordDocument(document, actor, type.isImage ? "Photo uploaded" : "Document uploaded");
  return document;
}

/** A stored file, for previews — only files recorded in the Documents tab, never any other Drive id. */
export async function readExpatDocument(id: string): Promise<(FileContent & { name: string }) | null> {
  const { data } = await readExpatData();
  const document = data.documents.find((entry) => entry.id === id);
  if (!document || document.removed || !document.storedFileId) return null;
  const content = await (await getPhotoStore("expats")).read(document.storedFileId);
  const type = detectFileType(content.bytes);
  if (!type) return null;
  return { ...content, mimeType: type.mimeType, name: `${document.title}.${type.extension}` };
}

async function updateDocument(id: string, actor: string, change: (document: ExpatDocument) => ExpatDocument | null, action: string) {
  const repository = getExpatRepository();
  const document = (await repository.readAll(true)).documents.find((entry) => entry.id === id);
  if (!document) throw new Error("That document was not found.");
  const after = change(document);
  if (!after) return document;
  await repository.save("documents", after);
  await repository.append("activity", [logEntry(document.expatId, "Document", id, actor, action, document.category)]);
  return after;
}

export function removeExpatDocument(id: string, actor: string) {
  return updateDocument(id, actor, (document) => (document.removed ? null : { ...document, removed: true }), "Document removed (record kept)");
}

export function setDocumentHistorical(id: string, historical: boolean, actor: string) {
  return updateDocument(
    id,
    actor,
    (document) => (document.historical === historical ? null : { ...document, historical }),
    historical ? "Document marked as history" : "Document marked as current",
  );
}

// ---------------------------------------------------------------------------
// Settings and storage.
// ---------------------------------------------------------------------------

export async function saveReminderSettings(daysText: string, recipientsText: string, actor: string): Promise<ExpatRules> {
  const reminderDays = parseReminderDays(daysText);
  const recipients = parseRecipients(recipientsText);
  const invalid = recipientsText
    .split(/[\s,;]+/)
    .filter(Boolean)
    .filter((part) => !recipients.includes(part.trim().toLowerCase()));
  if (invalid.length) throw new Error(`Not an email address: ${invalid.join(", ")}`);

  const repository = getExpatRepository();
  await repository.saveSetting(DAYS_SETTING, reminderDays.join(", "));
  await repository.saveSetting(RECIPIENTS_SETTING, recipients.join(", ") || null);
  await repository.append("activity", [
    logEntry("", "System", "", actor, "Reminder settings changed", `Days: ${reminderDays.join(", ")}. Recipients: ${recipients.join(", ") || "managers only"}.`),
  ]);
  return { reminderDays, recipients };
}

export function checkExpatStorage() {
  return checkStorage("expats");
}

export async function connectExpatStorage(
  grant: { email: string; refreshToken: string },
  clientId: string,
  clientSecret: string,
  actor: string,
): Promise<void> {
  await connectStorageAccount("expats", grant, clientId, clientSecret, actor);
  await getExpatRepository().append("activity", [
    logEntry("", "System", "", actor, "Uploads connected", `Documents will be stored in the Google Drive of ${grant.email}.`),
  ]);
}

export async function disconnectExpatStorage(actor: string): Promise<void> {
  await disconnectStorageAccount("expats");
  await getExpatRepository().append("activity", [
    logEntry("", "System", "", actor, "Uploads disconnected", "Files already uploaded stay in Drive."),
  ]);
}

// ---------------------------------------------------------------------------
// Reminder emails.
// ---------------------------------------------------------------------------

export interface ReminderRun {
  due: number;
  sent: number;
  recipients: string[];
  failures: string[];
  /** What would go out, when previewing. */
  preview: { recipient: string; items: { kind: string; person: string; when: string; status: string }[] }[];
}

/**
 * Sends the expiry reminders that are due, one email per recipient, and
 * remembers each item and window so it is never sent twice. Runs daily from
 * the scheduler and from "Send reminders now"; `dryRun` only reports.
 */
export async function runExpatReminders(options: {
  appUrl: string;
  actor: string;
  dryRun?: boolean;
  /** Tests only: send even on the sample register. */
  allowSample?: boolean;
}): Promise<ReminderRun> {
  const repository = getExpatRepository();
  const today = todayIn(getConfig().timezone);
  const [data, rules] = await Promise.all([repository.readAll(true), getExpatRules()]);
  const people = evaluateExpats(data, { today, rules }).filter((row) => !row.expat.archived);
  const due = dueReminders(people.flatMap((row) => row.expiries), data.reminders);
  const byRecipient = recipientsFor(due, rules.recipients);

  const describe = (reminder: DueReminder) => ({
    kind: reminder.item.kind,
    person: reminder.item.dependantId ? `${reminder.item.personName} (${reminder.item.expatName})` : reminder.item.expatName,
    when: reminder.item.expiryDate,
    status: EXPIRY_STATUS_META[reminder.item.status].label,
  });
  const preview = [...byRecipient].map(([recipient, reminders]) => ({ recipient, items: reminders.map(describe) }));
  if (options.dryRun) return { due: due.length, sent: 0, recipients: [...byRecipient.keys()], failures: [], preview };
  // The sample register's people are made up; never email them.
  if (repository.kind === "local" && !options.allowSample) {
    return {
      due: due.length,
      sent: 0,
      recipients: [],
      failures: ["The tracker is on sample data — reminders are only emailed from the live expat sheet."],
      preview,
    };
  }

  const mailer = getMailer();
  const delivered = new Map<DueReminder, string[]>();
  const failures: string[] = [];
  for (const [recipient, reminders] of byRecipient) {
    const email = renderReminderEmail({ reminders, appUrl: options.appUrl, today });
    try {
      await mailer.send({ to: recipient, subject: email.subject, html: email.html, text: email.text });
      for (const reminder of reminders) delivered.set(reminder, [...(delivered.get(reminder) ?? []), recipient]);
    } catch (error) {
      failures.push(`${recipient}: ${(error as Error).message}`);
    }
  }

  const log: ReminderLogEntry[] = [...delivered].map(([reminder, sentTo]) => ({
    id: newId("REM"),
    key: reminder.logKey,
    window: reminder.window,
    sentAt: stamp(),
    sentTo: sentTo.join(", "),
  }));
  await repository.append("reminders", log);
  if (log.length || failures.length) {
    await repository.append("activity", [
      logEntry(
        "",
        "System",
        "",
        options.actor,
        "Reminders sent",
        `${log.length} item(s) to ${new Set([...delivered.values()].flat()).size} recipient(s)${failures.length ? `; ${failures.length} failed` : ""}.`,
      ),
    ]);
  }
  return { due: due.length, sent: log.length, recipients: [...byRecipient.keys()], failures, preview };
}

// ---------------------------------------------------------------------------
// Excel exports — whatever list is on screen, already redacted for the viewer.
// ---------------------------------------------------------------------------

const d = (date: ISODate | null) => ({ date });

export function peopleWorkbook(rows: EvaluatedExpat[]): Uint8Array {
  const people: XlsxSheet = {
    name: "Expats",
    columns: [
      { header: "Expat ID", width: 10 },
      { header: "Full name", width: 24 },
      { header: "Employee number", width: 14 },
      { header: "Nationality", width: 14 },
      { header: "Date of birth", width: 13 },
      { header: "Company", width: 13 },
      { header: "Department", width: 16 },
      { header: "Position", width: 26 },
      { header: "Responsible manager", width: 20 },
      { header: "Employment status", width: 14 },
      { header: "Employment start", width: 13 },
      { header: "Contract end", width: 13 },
      { header: "Phone", width: 18 },
      { header: "Email", width: 28 },
      { header: "Profile status", width: 18 },
      { header: "Issues", width: 60 },
      { header: "Dependants", width: 10 },
      { header: "Next expiry", width: 26 },
      { header: "Next expiry date", width: 13 },
      { header: "Lease status", width: 16 },
      { header: "Applications in progress", width: 12 },
      { header: "Open follow-ups", width: 10 },
      { header: "Overdue follow-ups", width: 10 },
    ],
    rows: rows.map((row) => [
      row.expat.id,
      row.expat.fullName,
      row.expat.employeeNumber,
      row.expat.nationality,
      d(row.expat.dateOfBirth),
      row.expat.company,
      row.expat.department,
      row.expat.position,
      row.expat.managerName,
      row.expat.employmentStatus,
      d(row.expat.employmentStart),
      d(row.expat.contractEnd),
      row.expat.phone,
      row.expat.email,
      PROFILE_STATUS_META[row.status].label,
      row.issues.map((issue) => issue.text).join("; "),
      row.dependants.filter((dependant) => !dependant.archived).length,
      row.nextExpiry ? `${row.nextExpiry.kind} — ${row.nextExpiry.personName}` : "",
      d(row.nextExpiry?.expiryDate ?? null),
      row.currentLease?.status ?? "No lease",
      row.applicationsInProgress,
      row.openActions,
      row.overdueActions,
    ]),
  };
  const dependants: XlsxSheet = {
    name: "Dependants",
    columns: [
      { header: "Expat", width: 24 },
      { header: "Dependant", width: 24 },
      { header: "Relationship", width: 12 },
      { header: "Date of birth", width: 13 },
      { header: "Nationality", width: 14 },
      { header: "Passport expiry", width: 13 },
      { header: "Permit expiry", width: 13 },
    ],
    rows: rows.flatMap((row) =>
      row.dependants
        .filter((dependant) => !dependant.archived)
        .map((dependant) => {
          const own = (types: string[]) =>
            row.permits.find((permit) => permit.dependantId === dependant.id && permit.current && types.includes(permit.type))?.expiryDate ?? null;
          return [
            row.expat.fullName,
            dependant.fullName,
            dependant.relationship,
            d(dependant.dateOfBirth),
            dependant.nationality,
            d(own(["Passport"])),
            d(own(["Visa", "Residence permit", "Work permit", "Temporary employment permit"])),
          ];
        }),
    ),
  };
  return buildXlsx([people, dependants]);
}

export function expiriesWorkbook(items: ExpiryItem[]): Uint8Array {
  return buildXlsx([
    {
      name: "Expiry dates",
      columns: [
        { header: "Expat", width: 24 },
        { header: "Person", width: 24 },
        { header: "Document / item", width: 26 },
        { header: "Group", width: 22 },
        { header: "Reference", width: 24 },
        { header: "Expiry date", width: 13 },
        { header: "Days remaining", width: 10 },
        { header: "Status", width: 14 },
        { header: "Renewal under way", width: 10 },
        { header: "Needs action", width: 10 },
        { header: "Responsible person", width: 20 },
        { header: "Responsible email", width: 28 },
      ],
      rows: items.map((item) => [
        item.expatName,
        item.personName,
        item.kind,
        item.group,
        item.reference,
        d(item.expiryDate),
        item.daysRemaining,
        EXPIRY_STATUS_META[item.status].label,
        item.renewalInProgress ? "Yes" : "No",
        item.needsAction ? "Yes" : "No",
        item.responsibleName,
        item.responsibleEmail,
      ]),
    },
  ]);
}

export function actionsWorkbook(actions: FollowUp[], nameOf: (expatId: string) => string): Uint8Array {
  return buildXlsx([
    {
      name: "Follow-ups",
      columns: [
        { header: "Action ID", width: 10 },
        { header: "Expat", width: 24 },
        { header: "Action", width: 48 },
        { header: "Responsible person", width: 20 },
        { header: "Responsible email", width: 28 },
        { header: "Due date", width: 13 },
        { header: "Status", width: 12 },
        { header: "Notes", width: 40 },
        { header: "Created by", width: 18 },
      ],
      rows: actions.map((action) => [
        action.id,
        nameOf(action.expatId),
        action.title,
        action.responsibleName,
        action.responsibleEmail,
        d(action.dueDate),
        action.status,
        action.notes,
        action.createdBy,
      ]),
    },
  ]);
}
