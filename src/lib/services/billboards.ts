import "server-only";

import { cache } from "react";

import { getBillboardRepository } from "@/lib/billboards/data";
import { emptyData } from "@/lib/data/record-store";
import { describeChanges, newId, newestFirst, nextId, timestamp } from "@/lib/data/records";
import { getPhotoStore } from "@/lib/files";
import { checkStorage, connectStorageAccount, disconnectStorageAccount } from "@/lib/services/storage";
import {
  MAX_UPLOAD_BYTES,
  cityFolderName,
  detectFileType,
  fileStamp,
  siteFolderName,
  storedFileName,
  titleFromFileName,
} from "@/lib/files/files";
import type { FileContent } from "@/lib/files/store";
import { BILLBOARDS_TABLE, BILLBOARD_STORE } from "@/lib/billboards/data/sheet-tables";
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

const EMPTY: BillboardData = emptyData(BILLBOARD_STORE);

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

function activity(billboardId: string, by: string, action: string, details = ""): ActivityEntry {
  return { id: newId("ACT"), at: timestamp(), by, billboardId, action, details };
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
      lastUpdated: timestamp(),
      lastUpdatedBy: actor,
    };
    const changes = describeChanges(BILLBOARDS_TABLE, before, after);
    if (!changes) return before;
    await repository.save("billboards", after);
    await repository.append("activity", [activity(after.id, actor, "Updated", changes)]);
    return after;
  }

  const requested = input.id?.trim().toUpperCase();
  if (requested && billboards.some((billboard) => billboard.id.toUpperCase() === requested)) {
    throw new Error(`There is already a billboard with the ID ${requested}.`);
  }
  const created: Billboard = {
    ...input,
    id: requested || nextId("BB", billboards),
    archived: false,
    lastUpdated: timestamp(),
    lastUpdatedBy: actor,
  };
  await repository.save("billboards", created);
  await repository.append("activity", [activity(created.id, actor, "Added", `${created.name}, ${created.city}`)]);
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
  await repository.save("billboards", { ...billboard, archived, lastUpdated: timestamp(), lastUpdatedBy: actor });
  await repository.append("activity", [
    activity(id, actor, archived ? "Archived" : "Restored", archived ? "Hidden from the map and dashboard; history kept." : ""),
  ]);
}

export async function addCampaign(input: NewCampaign, actor: string): Promise<void> {
  const repository = getBillboardRepository();
  await requireBillboard(input.billboardId);
  const campaign: Campaign = { ...input, id: newId(`${input.billboardId}-C`), recordedAt: timestamp(), recordedBy: actor };
  await repository.append("campaigns", [campaign]);
  await repository.append("activity", [
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
    recordedAt: timestamp(),
    recordedBy: actor,
  };
  await repository.append("maintenance", [record]);

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
  const changes = describeChanges(BILLBOARDS_TABLE, before, after);
  if (changes) {
    await repository.save("billboards", { ...after, lastUpdated: timestamp(), lastUpdatedBy: actor });
  }
  await repository.append("activity", [
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
    addedAt: timestamp(),
    addedBy: actor,
    removed: false,
    storedFileId: "",
    mimeType: "",
  };
  await repository.save("files", file);
  await repository.append("activity", [activity(input.billboardId, actor, "Document added", `${file.category}: ${file.title}`)]);
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
  await getBillboardRepository().append("activity", [
    activity("", actor, "Uploads connected", `Photos will be stored in the Google Drive of ${grant.email}.`),
  ]);
}

export async function disconnectDriveAccount(actor: string): Promise<void> {
  await disconnectStorageAccount("billboards");
  await getBillboardRepository().append("activity", [
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
    name: storedFileName(fileStamp(getConfig().timezone), input.category, title, type.extension),
    mimeType: type.mimeType,
    bytes: upload.bytes,
  });

  const file: BillboardFile = {
    ...input,
    title,
    url: stored.url,
    id: newId(`${input.billboardId}-F`),
    addedAt: timestamp(),
    addedBy: actor,
    removed: false,
    storedFileId: stored.id,
    mimeType: type.mimeType,
  };
  const repository = getBillboardRepository();
  await repository.save("files", file);
  await repository.append("activity", [
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
    await repository.save("files", { ...file, removed: true });
    await repository.append("activity", [
      activity(file.billboardId, actor, "Document removed", `${file.category}: ${file.title} (the record is kept)`),
    ]);
  }
  return file.billboardId;
}
