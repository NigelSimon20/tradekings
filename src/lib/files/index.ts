import "server-only";

import { getBillboardRepository } from "@/lib/billboards/data";
import { getConfig } from "@/lib/config/env";
import { getLicenseRepository } from "@/lib/licenses/data";
import { readDriveConnection, type DriveConnection, type SettingsStore } from "@/lib/files/connection";
import { DrivePhotoStore, type RootFolder } from "@/lib/files/drive-store";
import { LocalPhotoStore } from "@/lib/files/local-store";
import { NoPhotoStore, type PhotoStore } from "@/lib/files/store";

/** The apps that store uploaded files. */
export type StorageApp = "billboards" | "licenses";

export interface AppStorage {
  /** The app's sheet, which also holds its sealed Drive connection. */
  settings: () => SettingsStore;
  /** Encryption purpose for the sealed connection — one per app. */
  purpose: string;
  root: RootFolder;
  /** A Shared drive folder for the service account, from the environment. */
  sharedFolderId: string;
  serviceAccount: { clientEmail: string; privateKey: string } | null;
  /** Sample-data mode: no live sheet, so uploads go to a local folder. */
  localDir: string | null;
}

/** Each app's storage settings. */
export function storageFor(app: StorageApp): AppStorage {
  const { billboards, licenses } = getConfig();
  switch (app) {
    case "billboards":
      return {
        settings: () => getBillboardRepository(),
        purpose: "billboard-drive-connection",
        root: { name: "Trade Kings Billboard Photos", marker: "billboard-photos" },
        sharedFolderId: billboards.photosFolderId,
        serviceAccount: billboards.google,
        localDir: billboards.google ? null : billboards.localUploadsDir,
      };
    case "licenses":
      return {
        settings: () => getLicenseRepository(),
        purpose: "license-drive-connection",
        root: { name: "Trade Kings Licenses", marker: "license-documents" },
        sharedFolderId: licenses.documentsFolderId,
        serviceAccount: licenses.google,
        localDir: licenses.google ? null : licenses.localUploadsDir,
      };
  }
}

/** The choice is re-read now and then, so a connect or disconnect reaches every server. */
const REFRESH_MS = 60 * 1000;
const cached = new Map<StorageApp, { at: number; store: PhotoStore; connection: DriveConnection | null }>();

/**
 * Where an app's uploads go, in order of preference:
 *   1. a Google account an administrator connected on Setup & access;
 *   2. a Shared drive folder from the environment (the tracker's service account);
 *   3. a local folder, while the app runs on sample data;
 *   4. nowhere — uploads off — when the live sheet has neither, so files never
 *      land on a server disk that hosting would wipe.
 */
export async function getPhotoStore(app: StorageApp): Promise<PhotoStore> {
  return (await resolvePhotoStore(app)).store;
}

/** The store, plus the connected account (if that is what is in use). */
export async function resolvePhotoStore(
  app: StorageApp,
): Promise<{ store: PhotoStore; connection: DriveConnection | null }> {
  const hit = cached.get(app);
  if (hit && Date.now() - hit.at < REFRESH_MS) return hit;

  const { auth } = getConfig();
  const storage = storageFor(app);
  // A sheet that cannot be read must not take uploads' settings down with it.
  const connection = await readDriveConnection(storage.settings(), storage.purpose).catch(() => null);

  let store: PhotoStore;
  if (connection && auth.google) {
    store = new DrivePhotoStore({
      rootFolderId: connection.folderId,
      credentials: {
        type: "connected-account",
        clientId: auth.google.clientId,
        clientSecret: auth.google.clientSecret,
        refreshToken: connection.refreshToken,
        email: connection.email,
      },
    });
  } else if (storage.serviceAccount && storage.sharedFolderId) {
    store = new DrivePhotoStore({
      rootFolderId: storage.sharedFolderId,
      credentials: { type: "service-account", ...storage.serviceAccount },
    });
  } else if (storage.localDir) {
    store = new LocalPhotoStore(storage.localDir);
  } else {
    store = new NoPhotoStore();
  }

  const entry = { at: Date.now(), store, connection };
  cached.set(app, entry);
  return entry;
}

/** Called after connecting or disconnecting, so this server switches at once. */
export function resetPhotoStore(app: StorageApp): void {
  cached.delete(app);
}
