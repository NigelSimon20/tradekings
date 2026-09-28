import "server-only";

import { readDriveConnection, type DriveConnection } from "@/lib/billboards/photos/connection";
import { DrivePhotoStore } from "@/lib/billboards/photos/drive-store";
import { LocalPhotoStore } from "@/lib/billboards/photos/local-store";
import { NoPhotoStore, type PhotoStore } from "@/lib/billboards/photos/store";
import { getConfig } from "@/lib/config/env";

/** The choice is re-read now and then, so a connect or disconnect reaches every server. */
const REFRESH_MS = 60 * 1000;
let cached: { at: number; store: PhotoStore; connection: DriveConnection | null } | null = null;

/**
 * Where uploads go, in order of preference:
 *   1. a Google account an administrator connected on Setup & access;
 *   2. the Shared drive in GOOGLE_BILLBOARDS_PHOTOS_FOLDER_ID (the tracker's service account);
 *   3. a local folder, while the billboard tracker runs on sample data;
 *   4. nowhere — uploads off — when the live sheet has neither, so files never
 *      land on a server disk that hosting would wipe.
 */
export async function getPhotoStore(): Promise<PhotoStore> {
  return (await resolvePhotoStore()).store;
}

/** The store, plus the connected account (if that is what is in use). */
export async function resolvePhotoStore(): Promise<{ store: PhotoStore; connection: DriveConnection | null }> {
  if (cached && Date.now() - cached.at < REFRESH_MS) return cached;

  const { billboards, auth } = getConfig();
  // A sheet that cannot be read must not take uploads' settings down with it.
  const connection = await readDriveConnection().catch(() => null);

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
  } else if (billboards.google && billboards.photosFolderId) {
    store = new DrivePhotoStore({
      rootFolderId: billboards.photosFolderId,
      credentials: {
        type: "service-account",
        clientEmail: billboards.google.clientEmail,
        privateKey: billboards.google.privateKey,
      },
    });
  } else if (!billboards.google) {
    store = new LocalPhotoStore(billboards.localUploadsDir);
  } else {
    store = new NoPhotoStore();
  }

  cached = { at: Date.now(), store, connection };
  return cached;
}

/** Called after connecting or disconnecting, so this server switches at once. */
export function resetPhotoStore(): void {
  cached = null;
}
