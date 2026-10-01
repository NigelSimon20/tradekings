import "server-only";

import { cache } from "react";

import { getBillboardRepository } from "@/lib/billboards/data";
import { getPhotoStore } from "@/lib/files";
import { checkStorage, connectStorageAccount, disconnectStorageAccount } from "@/lib/services/storage";
import {
  MAX_UPLOAD_BYTES,
  cityFolderName,
  detectFileType,
  siteFolderName,
  storedFileName,
  titleFromFileName,
} from "@/lib/files/files";
import type { FileContent } from "@/lib/files/store";
import { BILLBOARDS_TABLE } from "@/lib/billboards/data/sheet-tables";
import { evaluateBillboards } from "@/lib/billboards/evaluate";
import type {
  ActivityEntry,
  Billboard,
  BillboardData,
  BillboardFile,
  BillboardInput,
  Campaign,
  EvaluatedBillboard,
  MaintenanceRecord,
  NewBillboardFile,
  NewCampaign,
  NewMaintenanceRecord,
} from "@/lib/billboards/types";
import { getConfig } from "@/lib/config/env";
import type { RepositoryHealth } from "@/lib/data/repository";
import { todayIn, type ISODate } from "@/lib/date/dates";

export interface BillboardSnapshot {
  /** Sites in use, with the billboard rules applied. Archived sites are left out. */
  billboards: EvaluatedBillboard[];
  archived: EvaluatedBillboard[];
  data: BillboardData;
  today: ISODate;
  source: { kind: string; label: string };
  /** Why the billboard data could not be read, if it could not be. */
  error: string | null;
}

const EMPTY: BillboardData = { billboards: [], campaigns: [], maintenance: [], files: [], activity: [] };

/** Reads the billboard data once per request and applies the rules. Never throws. */
export const loadBillboards = cache(async (): Promise<BillboardSnapshot> => {
  const repository = getBillboardRepository();
  const today = todayIn(getConfig().timezone);
  const source = { kind: repository.kind, label: repository.label };

  let data: BillboardData;
  try {
    data = await repository.readAll();
  } catch (error) {
    console.error("Could not read the billboard data:", error);
    return {
      billboards: [],
      archived: [],
      data: EMPTY,
      today,
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const evaluated = evaluateBillboards(data, { today });
  return {
    billboards: evaluated.filter((billboard) => !billboard.archived),
    archived: evaluated.filter((billboard) => billboard.archived),
    data,
    today,
    source,
    error: null,
  };
});

export interface BillboardProfile {
  billboard: EvaluatedBillboard;
  campaigns: Campaign[];
  maintenance: MaintenanceRecord[];
  files: BillboardFile[];
  activity: ActivityEntry[];
}

const newestFirst = <T,>(key: (item: T) => string) => (a: T, b: T) => key(b).localeCompare(key(a));

/** Everything recorded against one site, newest first. Archived sites stay readable. */
export async function getBillboardProfile(id: string): Promise<BillboardProfile | null> {
  const { billboards, archived, data } = await loadBillboards();
  const billboard = [...billboards, ...archived].find((site) => site.id === id);
  if (!billboard) return null;

  return {
    billboard,
    campaigns: data.campaigns
      .filter((campaign) => campaign.billboardId === id)
      .sort(newestFirst((campaign) => campaign.startDate ?? "")),
    maintenance: data.maintenance
      .filter((record) => record.billboardId === id)
      .sort(newestFirst((record) => `${record.date ?? ""}${record.recordedAt}`)),
    files: data.files
      .filter((file) => file.billboardId === id && !file.removed)
      .sort(newestFirst((file) => file.addedAt)),
    activity: data.activity
      .filter((entry) => entry.billboardId === id)
      .sort(newestFirst((entry) => entry.at)),
  };
}

export async function recentBillboardActivity(limit: number): Promise<ActivityEntry[]> {
  const { data } = await loadBillboards();
  return [...data.activity].sort(newestFirst((entry) => entry.at)).slice(0, limit);
}

export async function checkBillboardSource(): Promise<RepositoryHealth & { kind: string; label: string }> {
  const repository = getBillboardRepository();
  return { kind: repository.kind, label: repository.label, ...(await repository.healthCheck()) };
}

export async function setUpBillboardStorage() {
  return getBillboardRepository().setUpStorage();
}

// ---------------------------------------------------------------------------
// Changes. Each one is stamped with who and when, and leaves an activity entry
// so the history of a site survives edits.
// ---------------------------------------------------------------------------

function stamp(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function activity(billboardId: string, by: string, action: string, details = ""): ActivityEntry {
  return { id: newId("ACT"), at: stamp(), by, billboardId, action, details };
}

/** `BB-023` after `BB-022`, so IDs stay short and readable. */
function nextBillboardId(existing: Billboard[]): string {
  const highest = existing.reduce((max, billboard) => {
    const match = /^BB-(\d+)$/i.exec(billboard.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `BB-${String(highest + 1).padStart(3, "0")}`;
}

const COLUMN_LABELS = new Map(BILLBOARDS_TABLE.columns.map((column) => [column.key, column.header]));
const IGNORED_IN_DIFF = new Set(["lastUpdated", "lastUpdatedBy", "rowNumber"]);

/** "Status: Active → Under Maintenance; Lease Expiry: 2026-01-31 → 2027-01-31" */
export function describeChanges(before: Billboard, after: Billboard): string {
  const show = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "(blank)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };
  return (Object.keys(after) as (keyof Billboard)[])
    .filter((key) => !IGNORED_IN_DIFF.has(key) && show(before[key]) !== show(after[key]))
    .map((key) => `${COLUMN_LABELS.get(key) ?? key}: ${show(before[key])} → ${show(after[key])}`)
    .join("; ");
}

export async function saveBillboard(
  input: BillboardInput,
  actor: string,
  existingId?: string,
): Promise<Billboard> {
  const repository = getBillboardRepository();
  const { billboards } = await repository.readAll(true);

  if (existingId) {
    const before = billboards.find((billboard) => billboard.id === existingId);
    if (!before) throw new Error(`Billboard ${existingId} was not found.`);
    const after: Billboard = {
      ...before,
      ...input,
      id: before.id,
      archived: before.archived,
      lastUpdated: stamp(),
      lastUpdatedBy: actor,
    };
    const changes = describeChanges(before, after);
    if (!changes) return before;
    await repository.saveBillboard(after);
    await repository.appendActivity([activity(after.id, actor, "Updated", changes)]);
    return after;
  }

  const requested = input.id?.trim().toUpperCase();
  if (requested && billboards.some((billboard) => billboard.id.toUpperCase() === requested)) {
    throw new Error(`There is already a billboard with the ID ${requested}.`);
  }
  const created: Billboard = {
    ...input,
    id: requested || nextBillboardId(billboards),
    archived: false,
    lastUpdated: stamp(),
    lastUpdatedBy: actor,
  };
  await repository.saveBillboard(created);
  await repository.appendActivity([activity(created.id, actor, "Added", `${created.name}, ${created.city}`)]);
  return created;
}

async function requireBillboard(id: string): Promise<Billboard> {
  const { billboards } = await getBillboardRepository().readAll(true);
  const billboard = billboards.find((site) => site.id === id);
  if (!billboard) throw new Error(`Billboard ${id} was not found.`);
  return billboard;
}

export async function setBillboardArchived(id: string, archived: boolean, actor: string): Promise<void> {
  const repository = getBillboardRepository();
  const billboard = await requireBillboard(id);
  if (billboard.archived === archived) return;
  await repository.saveBillboard({ ...billboard, archived, lastUpdated: stamp(), lastUpdatedBy: actor });
  await repository.appendActivity([
    activity(id, actor, archived ? "Archived" : "Restored", archived ? "Hidden from the map and dashboard; history kept." : ""),
  ]);
}

export async function addCampaign(input: NewCampaign, actor: string): Promise<void> {
  const repository = getBillboardRepository();
  await requireBillboard(input.billboardId);
  const campaign: Campaign = { ...input, id: newId(`${input.billboardId}-C`), recordedAt: stamp(), recordedBy: actor };
  await repository.addCampaign(campaign);
  await repository.appendActivity([
    activity(
      input.billboardId,
      actor,
      "Campaign recorded",
      `${campaign.brand}${campaign.campaign ? ` — ${campaign.campaign}` : ""}, from ${campaign.startDate}${
        campaign.endDate ? ` to ${campaign.endDate}` : ""
      }`,
    ),
  ]);
}

/**
 * Records a maintenance visit and carries what it found onto the site: the
 * condition, the inspection dates. The visit itself is kept as history.
 */
export async function addMaintenance(input: NewMaintenanceRecord, actor: string): Promise<void> {
  const repository = getBillboardRepository();
  const before = await requireBillboard(input.billboardId);
  const record: MaintenanceRecord = {
    ...input,
    id: newId(`${input.billboardId}-M`),
    recordedAt: stamp(),
    recordedBy: actor,
  };
  await repository.addMaintenance(record);

  const isInspection = input.kind === "Inspection";
  const after: Billboard = {
    ...before,
    siteCondition: input.condition || before.siteCondition,
    lastInspection:
      isInspection && input.date && (!before.lastInspection || input.date > before.lastInspection)
        ? input.date
        : before.lastInspection,
    nextInspection: input.nextInspection ?? before.nextInspection,
  };
  const changes = describeChanges(before, after);
  if (changes) {
    await repository.saveBillboard({ ...after, lastUpdated: stamp(), lastUpdatedBy: actor });
  }
  await repository.appendActivity([
    activity(
      input.billboardId,
      actor,
      `${input.kind} recorded`,
      [input.description, changes].filter(Boolean).join(" — "),
    ),
  ]);
}

export async function addFile(input: NewBillboardFile, actor: string): Promise<void> {
  const repository = getBillboardRepository();
  await requireBillboard(input.billboardId);
  const file: BillboardFile = {
    ...input,
    id: newId(`${input.billboardId}-F`),
    addedAt: stamp(),
    addedBy: actor,
    removed: false,
    storedFileId: "",
    mimeType: "",
  };
  await repository.saveFile(file);
  await repository.appendActivity([activity(input.billboardId, actor, "Document added", `${file.category}: ${file.title}`)]);
}

/** How uploads are set up, for Setup & access. Never includes the stored token. */
export async function checkPhotoStore() {
  return checkStorage("billboards");
}

/**
 * Finishes connecting a Google account for uploads: makes (or finds) the
 * tracker's folder in its Drive and keeps the sealed token.
 */
export async function connectDriveAccount(
  grant: { email: string; refreshToken: string },
  clientId: string,
  clientSecret: string,
  actor: string,
): Promise<void> {
  await connectStorageAccount("billboards", grant, clientId, clientSecret, actor);
  await getBillboardRepository().appendActivity([
    activity("", actor, "Uploads connected", `Photos will be stored in the Google Drive of ${grant.email}.`),
  ]);
}

export async function disconnectDriveAccount(actor: string): Promise<void> {
  await disconnectStorageAccount("billboards");
  await getBillboardRepository().appendActivity([
    activity("", actor, "Uploads disconnected", "Files already uploaded stay in Drive."),
  ]);
}

/** Billboard files go in City / BB-001 – Site name, the site folder tagged by its id. */
function billboardFileLocation(billboard: Billboard) {
  return {
    folders: [cityFolderName(billboard.city), siteFolderName(billboard)],
    key: { name: "billboardId", value: billboard.id },
  };
}

/** `2026-09-27 1405` in the app's timezone, for ordering uploaded files by name. */
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

/**
 * Stores an uploaded photo or document in the site's folder (City / Site) and
 * records it against the billboard. The file's type comes from its contents,
 * never from its name.
 */
export async function uploadBillboardFile(
  input: NewBillboardFile,
  upload: { name: string; bytes: Uint8Array },
  actor: string,
): Promise<BillboardFile> {
  if (upload.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("That file is larger than 4 MB. Photos are shrunk automatically; for a PDF, scan it at a lower resolution.");
  }
  const type = detectFileType(upload.bytes);
  if (!type) throw new Error("Only photos (JPG, PNG, WebP) and PDF documents can be uploaded.");

  const billboard = await requireBillboard(input.billboardId);
  const title = input.title.trim() || titleFromFileName(upload.name) || input.category;
  const stored = await (await getPhotoStore("billboards")).save(billboardFileLocation(billboard), {
    name: storedFileName(fileStamp(), input.category, title, type.extension),
    mimeType: type.mimeType,
    bytes: upload.bytes,
  });

  const file: BillboardFile = {
    ...input,
    title,
    url: stored.url,
    id: newId(`${input.billboardId}-F`),
    addedAt: stamp(),
    addedBy: actor,
    removed: false,
    storedFileId: stored.id,
    mimeType: type.mimeType,
  };
  const repository = getBillboardRepository();
  await repository.saveFile(file);
  await repository.appendActivity([
    activity(input.billboardId, actor, type.isImage ? "Photo uploaded" : "Document uploaded", `${file.category}: ${title}`),
  ]);
  return file;
}

/**
 * The content of an uploaded file, for previews. Only files recorded against
 * a billboard can be read this way — the tracker's Drive access is never a way
 * to open anything else.
 */
export async function readBillboardFile(recordId: string): Promise<(FileContent & { name: string }) | null> {
  const { data } = await loadBillboards();
  const file = data.files.find((entry) => entry.id === recordId);
  if (!file || file.removed || !file.storedFileId) return null;

  const content = await (await getPhotoStore("billboards")).read(file.storedFileId);
  // Serve what the file really is, whatever the store says.
  const type = detectFileType(content.bytes);
  if (!type) return null;
  return { ...content, mimeType: type.mimeType, name: `${file.title}.${type.extension}` };
}

export async function removeFile(fileId: string, actor: string): Promise<string> {
  const repository = getBillboardRepository();
  const { files } = await repository.readAll(true);
  const file = files.find((entry) => entry.id === fileId);
  if (!file) throw new Error("That document was not found.");
  if (!file.removed) {
    await repository.saveFile({ ...file, removed: true });
    await repository.appendActivity([
      activity(file.billboardId, actor, "Document removed", `${file.category}: ${file.title} (the record is kept)`),
    ]);
  }
  return file.billboardId;
}
