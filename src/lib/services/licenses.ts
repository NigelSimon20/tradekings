import "server-only";

import { cache } from "react";

import { getConfig } from "@/lib/config/env";
import type { RepositoryHealth } from "@/lib/data/repository";
import { todayIn, type ISODate } from "@/lib/date/dates";
import { getPhotoStore } from "@/lib/files";
import {
  MAX_UPLOAD_BYTES,
  detectFileType,
  storedFileName,
  titleFromFileName,
} from "@/lib/files/files";
import type { FileContent, FileLocation } from "@/lib/files/store";
import { getLicenseRepository } from "@/lib/licenses/data";
import { ASSETS_TABLE, LICENSES_TABLE } from "@/lib/licenses/data/sheet-tables";
import { evaluateLicenses, summariseAssets } from "@/lib/licenses/evaluate";
import { assetGroupOf, LICENSE_STATUS_META } from "@/lib/licenses/meta";
import { DEFAULT_LICENSE_RULES, parseReminderDays, type LicenseRules } from "@/lib/licenses/rules";
import type {
  Asset,
  AssetInput,
  AssetSummary,
  DocumentCategory,
  EvaluatedLicense,
  License,
  LicenseActivity,
  LicenseData,
  LicenseDocument,
  LicenseInput,
  Renewal,
} from "@/lib/licenses/types";
import { escapeCell } from "@/lib/reports/csv";
import { checkStorage, connectStorageAccount, disconnectStorageAccount } from "@/lib/services/storage";

const REMINDER_SETTING = "reminders.days";

export interface LicenseSnapshot {
  /** Licenses in use, with the rules applied. Archived ones are left out. */
  licenses: EvaluatedLicense[];
  archivedLicenses: EvaluatedLicense[];
  assets: AssetSummary[];
  archivedAssets: Asset[];
  data: LicenseData;
  rules: LicenseRules;
  today: ISODate;
  source: { kind: string; label: string };
  /** Why the license data could not be read, if it could not be. */
  error: string | null;
}

const EMPTY: LicenseData = { assets: [], licenses: [], renewals: [], documents: [], activity: [] };

/** The reminder days in force: set on Setup & access, or 90, 60, 30 and 7. */
export async function getLicenseRules(): Promise<LicenseRules> {
  try {
    const stored = await getLicenseRepository().readSetting(REMINDER_SETTING);
    return stored ? { reminderDays: parseReminderDays(stored) } : DEFAULT_LICENSE_RULES;
  } catch {
    return DEFAULT_LICENSE_RULES;
  }
}

/** Reads the license data once per request and applies the rules. Never throws. */
export const loadLicenses = cache(async (): Promise<LicenseSnapshot> => {
  const repository = getLicenseRepository();
  const today = todayIn(getConfig().timezone);
  const source = { kind: repository.kind, label: repository.label };

  let data: LicenseData;
  try {
    data = await repository.readAll();
  } catch (error) {
    console.error("Could not read the license data:", error);
    return {
      licenses: [],
      archivedLicenses: [],
      assets: [],
      archivedAssets: [],
      data: EMPTY,
      rules: DEFAULT_LICENSE_RULES,
      today,
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const rules = await getLicenseRules();
  const evaluated = evaluateLicenses(data, { today, rules });
  const liveAssets = data.assets.filter((asset) => !asset.archived);
  const liveLicenses = evaluated.filter((license) => !license.archived);
  return {
    licenses: liveLicenses,
    archivedLicenses: evaluated.filter((license) => license.archived),
    assets: summariseAssets(liveAssets, liveLicenses),
    archivedAssets: data.assets.filter((asset) => asset.archived),
    data,
    rules,
    today,
    source,
    error: null,
  };
});

const newestFirst = <T,>(key: (item: T) => string) => (a: T, b: T) => key(b).localeCompare(key(a));

export async function getLicenseProfile(id: string) {
  const { licenses, archivedLicenses, data } = await loadLicenses();
  const license = [...licenses, ...archivedLicenses].find((item) => item.id === id);
  if (!license) return null;
  return {
    license,
    renewals: data.renewals
      .filter((renewal) => renewal.licenseId === id)
      .sort(newestFirst((renewal) => `${renewal.renewedOn ?? ""}${renewal.recordedAt}`)),
    documents: data.documents
      .filter((document) => document.licenseId === id && !document.removed)
      .sort(newestFirst((document) => document.addedAt)),
    activity: data.activity
      .filter((entry) => entry.recordType === "License" && entry.recordId === id)
      .sort(newestFirst((entry) => entry.at)),
  };
}

export async function getAssetProfile(id: string) {
  const { assets, archivedAssets, licenses, archivedLicenses, data } = await loadLicenses();
  const summary =
    assets.find((item) => item.asset.id === id) ??
    (() => {
      const archived = archivedAssets.find((asset) => asset.id === id);
      return archived ? summariseAssets([archived], licenses)[0] : undefined;
    })();
  if (!summary) return null;
  return {
    ...summary,
    archivedLicenses: archivedLicenses.filter((license) => license.assetId === id),
    documents: data.documents
      .filter((document) => document.assetId === id && !document.licenseId && !document.removed)
      .sort(newestFirst((document) => document.addedAt)),
    activity: data.activity
      .filter((entry) => entry.recordType === "Asset" && entry.recordId === id)
      .sort(newestFirst((entry) => entry.at)),
  };
}

export async function recentLicenseActivity(limit: number): Promise<LicenseActivity[]> {
  const { data } = await loadLicenses();
  return [...data.activity].sort(newestFirst((entry) => entry.at)).slice(0, limit);
}

export async function checkLicenseSource(): Promise<RepositoryHealth & { kind: string; label: string }> {
  const repository = getLicenseRepository();
  return { kind: repository.kind, label: repository.label, ...(await repository.healthCheck()) };
}

export async function setUpLicenseStorage() {
  return getLicenseRepository().setUpStorage();
}

// ---------------------------------------------------------------------------
// Changes. Each is stamped with who and when, and leaves an Activity Log entry
// with the old and new values — the audit trail the brief asks for.
// ---------------------------------------------------------------------------

function stamp(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function activity(
  recordType: LicenseActivity["recordType"],
  recordId: string,
  by: string,
  action: string,
  details = "",
): LicenseActivity {
  return { id: newId("ACT"), at: stamp(), by, recordType, recordId, action, details };
}

/** `LIC-036` after `LIC-035`, so references stay short and readable. */
function nextId(prefix: string, existing: { id: string }[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const highest = existing.reduce((max, item) => {
    const match = pattern.exec(item.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

const IGNORED = new Set(["lastUpdated", "lastUpdatedBy"]);

/** "Expiry Date: 2026-01-31 → 2027-01-31; Renewal Status: In progress → Renewed" */
function describeChanges<T extends object>(
  labels: Map<string, string>,
  before: T,
  after: T,
): string {
  const show = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "(blank)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };
  return (Object.keys(after) as (keyof T & string)[])
    .filter((key) => !IGNORED.has(key) && show(before[key]) !== show(after[key]))
    .map((key) => `${labels.get(key) ?? key}: ${show(before[key])} → ${show(after[key])}`)
    .join("; ");
}

const ASSET_LABELS = new Map(ASSETS_TABLE.columns.map((column) => [column.key as string, column.header]));
const LICENSE_LABELS = new Map(LICENSES_TABLE.columns.map((column) => [column.key as string, column.header]));

export async function saveAsset(input: AssetInput, actor: string, existingId?: string): Promise<Asset> {
  const repository = getLicenseRepository();
  const { assets } = await repository.readAll(true);

  if (existingId) {
    const before = assets.find((asset) => asset.id === existingId);
    if (!before) throw new Error(`Asset ${existingId} was not found.`);
    const after: Asset = { ...before, ...input, id: before.id, archived: before.archived, lastUpdated: stamp(), lastUpdatedBy: actor };
    const changes = describeChanges(ASSET_LABELS, before, after);
    if (!changes) return before;
    await repository.saveAsset(after);
    await repository.appendActivity([activity("Asset", after.id, actor, "Updated", changes)]);
    return after;
  }

  const requested = input.id?.trim().toUpperCase();
  if (requested && assets.some((asset) => asset.id.toUpperCase() === requested)) {
    throw new Error(`There is already an asset with the ID ${requested}.`);
  }
  const created: Asset = {
    ...input,
    id: requested || nextId("AS", assets),
    archived: false,
    lastUpdated: stamp(),
    lastUpdatedBy: actor,
  };
  await repository.saveAsset(created);
  await repository.appendActivity([activity("Asset", created.id, actor, "Added", `${created.type}: ${created.name}`)]);
  return created;
}

export async function saveLicense(input: LicenseInput, actor: string, existingId?: string): Promise<License> {
  const repository = getLicenseRepository();
  const { licenses, assets } = await repository.readAll(true);
  if (input.assetId && !assets.some((asset) => asset.id === input.assetId)) {
    throw new Error("Choose an asset from the list, or leave it blank for a company-wide license.");
  }

  if (existingId) {
    const before = licenses.find((license) => license.id === existingId);
    if (!before) throw new Error(`License ${existingId} was not found.`);
    const after: License = { ...before, ...input, id: before.id, archived: before.archived, lastUpdated: stamp(), lastUpdatedBy: actor };
    const changes = describeChanges(LICENSE_LABELS, before, after);
    if (!changes) return before;
    await repository.saveLicense(after);
    await repository.appendActivity([activity("License", after.id, actor, "Updated", changes)]);
    return after;
  }

  const requested = input.id?.trim().toUpperCase();
  if (requested && licenses.some((license) => license.id.toUpperCase() === requested)) {
    throw new Error(`There is already a license with the ID ${requested}.`);
  }
  const created: License = {
    ...input,
    id: requested || nextId("LIC", licenses),
    archived: false,
    lastUpdated: stamp(),
    lastUpdatedBy: actor,
  };
  await repository.saveLicense(created);
  await repository.appendActivity([activity("License", created.id, actor, "Added", `${created.type}: ${created.name}`)]);
  return created;
}

export async function setLicenseArchived(id: string, archived: boolean, actor: string): Promise<void> {
  const repository = getLicenseRepository();
  const license = (await repository.readAll(true)).licenses.find((item) => item.id === id);
  if (!license) throw new Error(`License ${id} was not found.`);
  if (license.archived === archived) return;
  await repository.saveLicense({ ...license, archived, lastUpdated: stamp(), lastUpdatedBy: actor });
  await repository.appendActivity([
    activity("License", id, actor, archived ? "Archived" : "Restored", archived ? "Taken off the register; history kept." : ""),
  ]);
}

export async function setAssetArchived(id: string, archived: boolean, actor: string): Promise<void> {
  const repository = getLicenseRepository();
  const asset = (await repository.readAll(true)).assets.find((item) => item.id === id);
  if (!asset) throw new Error(`Asset ${id} was not found.`);
  if (asset.archived === archived) return;
  await repository.saveAsset({ ...asset, archived, lastUpdated: stamp(), lastUpdatedBy: actor });
  await repository.appendActivity([
    activity("Asset", id, actor, archived ? "Archived" : "Restored", archived ? "Hidden from the map and lists; history kept." : ""),
  ]);
}

// ---------------------------------------------------------------------------
// Documents and renewals.
// ---------------------------------------------------------------------------

/** `2026-10-01 140512` in the app's timezone, so a folder lists in the order files were added. */
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

const folderSafe = (value: string) => value.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

/**
 * License files go in Trade Kings Licenses / <asset group> / AS-001 – Msasa Warehouse,
 * tagged by asset id; a license with no asset is filed under Company-wide by its own id.
 */
function documentLocation(asset: Asset | null, license: License | null): FileLocation {
  if (asset) {
    return {
      folders: [assetGroupOf(asset.type) ?? "Other assets", folderSafe(`${asset.id} – ${asset.name}`)],
      key: { name: "licenseAssetId", value: asset.id },
    };
  }
  return {
    folders: ["Company & Operational", folderSafe(`${license?.id ?? "General"} – ${license?.name ?? "Documents"}`)],
    key: { name: "licenseId", value: license?.id ?? "general" },
  };
}

interface DocumentTarget {
  licenseId: string;
  assetId: string;
  category: DocumentCategory;
  title: string;
  documentDate: ISODate | null;
}

async function resolveTarget(target: { licenseId: string; assetId: string }) {
  const { licenses, assets } = await getLicenseRepository().readAll(true);
  const license = target.licenseId ? (licenses.find((item) => item.id === target.licenseId) ?? null) : null;
  if (target.licenseId && !license) throw new Error("That license was not found.");
  const assetId = license?.assetId || target.assetId;
  const asset = assetId ? (assets.find((item) => item.id === assetId) ?? null) : null;
  if (target.assetId && !asset && !license) throw new Error("That asset was not found.");
  if (!license && !asset) throw new Error("Choose the license or asset this document belongs to.");
  return { license, asset };
}

/** Records the document against its license/asset and in the right audit trail. */
async function recordDocument(document: LicenseDocument, actor: string, action: string): Promise<void> {
  const repository = getLicenseRepository();
  await repository.saveDocument(document);
  await repository.appendActivity([
    document.licenseId
      ? activity("License", document.licenseId, actor, action, `${document.category}: ${document.title}`)
      : activity("Asset", document.assetId, actor, action, `${document.category}: ${document.title}`),
  ]);
}

export async function addDocumentLink(input: DocumentTarget & { url: string }, actor: string): Promise<LicenseDocument> {
  const { license, asset } = await resolveTarget(input);
  const document: LicenseDocument = {
    id: newId("DOC"),
    licenseId: license?.id ?? "",
    assetId: asset?.id ?? "",
    category: input.category,
    title: input.title,
    url: input.url,
    storedFileId: "",
    mimeType: "",
    documentDate: input.documentDate,
    addedAt: stamp(),
    addedBy: actor,
    removed: false,
  };
  await recordDocument(document, actor, "Document linked");
  return document;
}

/** Stores an uploaded file in the asset's folder and records it. The type comes from its contents. */
export async function uploadLicenseDocument(
  input: DocumentTarget,
  upload: { name: string; bytes: Uint8Array },
  actor: string,
): Promise<LicenseDocument> {
  if (upload.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("That file is larger than 4 MB. Photos are shrunk automatically; for a PDF, scan it at a lower resolution.");
  }
  const type = detectFileType(upload.bytes);
  if (!type) throw new Error("Only PDF documents and photos (JPG, PNG, WebP) can be uploaded.");

  const { license, asset } = await resolveTarget(input);
  const title = input.title.trim() || titleFromFileName(upload.name) || input.category;
  const label = license ? `${license.name}${license.number ? ` ${license.number}` : ""} – ${title}` : title;
  const stored = await (await getPhotoStore("licenses")).save(documentLocation(asset, license), {
    name: storedFileName(fileStamp(), input.category, label, type.extension),
    mimeType: type.mimeType,
    bytes: upload.bytes,
  });

  const document: LicenseDocument = {
    id: newId("DOC"),
    licenseId: license?.id ?? "",
    assetId: asset?.id ?? "",
    category: input.category,
    title,
    url: stored.url,
    storedFileId: stored.id,
    mimeType: type.mimeType,
    documentDate: input.documentDate,
    addedAt: stamp(),
    addedBy: actor,
    removed: false,
  };
  await recordDocument(document, actor, type.isImage ? "Photo uploaded" : "Document uploaded");
  return document;
}

/** A stored file, for previews — only files recorded in the Documents tab, never any other Drive id. */
export async function readLicenseDocument(id: string): Promise<(FileContent & { name: string }) | null> {
  const { data } = await loadLicenses();
  const document = data.documents.find((entry) => entry.id === id);
  if (!document || document.removed || !document.storedFileId) return null;
  const content = await (await getPhotoStore("licenses")).read(document.storedFileId);
  const type = detectFileType(content.bytes);
  if (!type) return null;
  return { ...content, mimeType: type.mimeType, name: `${document.title}.${type.extension}` };
}

export async function removeLicenseDocument(id: string, actor: string): Promise<LicenseDocument> {
  const repository = getLicenseRepository();
  const document = (await repository.readAll(true)).documents.find((entry) => entry.id === id);
  if (!document) throw new Error("That document was not found.");
  if (!document.removed) {
    await repository.saveDocument({ ...document, removed: true });
    await repository.appendActivity([
      document.licenseId
        ? activity("License", document.licenseId, actor, "Document removed", `${document.title} (the record is kept)`)
        : activity("Asset", document.assetId, actor, "Document removed", `${document.title} (the record is kept)`),
    ]);
  }
  return document;
}

export interface RenewalInput {
  licenseId: string;
  renewedOn: ISODate | null;
  newIssueDate: ISODate | null;
  newExpiry: ISODate | null;
  newNumber: string;
  notes: string;
}

/**
 * Records a renewal: the previous dates go into the Renewals tab as history,
 * the license takes the new dates and number, and the renewed certificate (if
 * uploaded) is filed with it.
 */
export async function recordRenewal(
  input: RenewalInput,
  certificate: { name: string; bytes: Uint8Array } | null,
  actor: string,
): Promise<void> {
  const repository = getLicenseRepository();
  const before = (await repository.readAll(true)).licenses.find((license) => license.id === input.licenseId);
  if (!before) throw new Error("That license was not found.");

  const document = certificate
    ? await uploadLicenseDocument(
        {
          licenseId: before.id,
          assetId: before.assetId,
          category: "License / certificate",
          // Uploaded before the license takes its new number, so the number goes in the title.
          title: ["Renewed certificate", input.newNumber, input.newIssueDate ?? input.renewedOn].filter(Boolean).join(" "),
          documentDate: input.newIssueDate ?? input.renewedOn,
        },
        certificate,
        actor,
      )
    : null;

  const renewal: Renewal = {
    id: newId(`${before.id}-R`),
    licenseId: before.id,
    renewedOn: input.renewedOn,
    previousExpiry: before.expiryDate,
    newIssueDate: input.newIssueDate,
    newExpiry: input.newExpiry,
    newNumber: input.newNumber,
    documentId: document?.id ?? "",
    notes: input.notes,
    recordedAt: stamp(),
    recordedBy: actor,
  };
  await repository.addRenewal(renewal);

  const after: License = {
    ...before,
    issueDate: input.newIssueDate ?? before.issueDate,
    expiryDate: input.newExpiry ?? before.expiryDate,
    number: input.newNumber || before.number,
    lastRenewalDate: input.renewedOn ?? before.lastRenewalDate,
    renewalStatus: "Renewed",
    lastUpdated: stamp(),
    lastUpdatedBy: actor,
  };
  await repository.saveLicense(after);
  await repository.appendActivity([
    activity("License", before.id, actor, "Renewal recorded", describeChanges(LICENSE_LABELS, before, after)),
  ]);
}

// ---------------------------------------------------------------------------
// Settings, storage and export.
// ---------------------------------------------------------------------------

export async function saveReminderDays(text: string, actor: string): Promise<number[]> {
  const days = parseReminderDays(text);
  const repository = getLicenseRepository();
  await repository.saveSetting(REMINDER_SETTING, days.join(", "));
  await repository.appendActivity([activity("System", "", actor, "Reminder days changed", days.join(", "))]);
  return days;
}

export function checkLicenseStorage() {
  return checkStorage("licenses");
}

export async function connectLicenseStorage(
  grant: { email: string; refreshToken: string },
  clientId: string,
  clientSecret: string,
  actor: string,
): Promise<void> {
  await connectStorageAccount("licenses", grant, clientId, clientSecret, actor);
  await getLicenseRepository().appendActivity([
    activity("System", "", actor, "Uploads connected", `Documents will be stored in the Google Drive of ${grant.email}.`),
  ]);
}

export async function disconnectLicenseStorage(actor: string): Promise<void> {
  await disconnectStorageAccount("licenses");
  await getLicenseRepository().appendActivity([
    activity("System", "", actor, "Uploads disconnected", "Files already uploaded stay in Drive."),
  ]);
}

/** The register as CSV for reporting — what is on screen, plus the calculated status. */
export function licensesToCsv(licenses: EvaluatedLicense[]): string {
  const columns: [string, (license: EvaluatedLicense) => string | number][] = [
    ["License ID", (license) => license.id],
    ["License / Permit Name", (license) => license.name],
    ["Category", (license) => license.category],
    ["License Type", (license) => license.type],
    ["License / Certificate Number", (license) => license.number],
    ["Asset", (license) => license.computed.asset?.name ?? ""],
    ["Asset Type", (license) => license.computed.asset?.type ?? ""],
    ["Vehicle Registration / Fleet No", (license) => license.computed.asset?.registration ?? ""],
    ["Location", (license) => license.computed.asset?.city ?? ""],
    ["Issuing Authority", (license) => license.issuingAuthority],
    ["Issue Date", (license) => license.issueDate ?? ""],
    ["Expiry Date", (license) => license.expiryDate ?? ""],
    ["Days Remaining", (license) => license.computed.daysRemaining ?? ""],
    ["Status", (license) => LICENSE_STATUS_META[license.computed.status].label],
    ["Renewal Frequency", (license) => license.renewalFrequency],
    ["Renewal Status", (license) => license.renewalStatus],
    ["Next Renewal", (license) => license.computed.nextRenewalDate ?? ""],
    ["Department", (license) => license.department],
    ["Responsible Person", (license) => license.responsibleName],
    ["Responsible Email", (license) => license.responsibleEmail],
    ["Needs Action", (license) => (license.computed.needsAction ? "Yes" : "No")],
  ];
  const header = columns.map(([label]) => escapeCell(label)).join(",");
  const rows = licenses.map((license) => columns.map(([, value]) => escapeCell(value(license))).join(","));
  return [header, ...rows].join("\n");
}
