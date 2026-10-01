import "server-only";

import { resetPhotoStore, resolvePhotoStore, storageFor, type StorageApp } from "@/lib/files";
import { clearDriveConnection, saveDriveConnection } from "@/lib/files/connection";
import { ensureConnectedRootFolder } from "@/lib/files/drive-store";

/**
 * Photo and document storage for any app: how it is set up, and connecting or
 * disconnecting the Google account that holds its files.
 */

/** How uploads are set up, for Setup & access. Never includes the stored token. */
export async function checkStorage(app: StorageApp) {
  const { store, connection } = await resolvePhotoStore(app);
  return {
    kind: store.kind,
    label: store.label,
    ...(await store.healthCheck()),
    connectedAccount: connection
      ? {
          email: connection.email,
          connectedAt: connection.connectedAt,
          connectedBy: connection.connectedBy,
          folderName: storageFor(app).root.name,
        }
      : null,
  };
}

/** Makes (or finds) the app's folder in the account's Drive and keeps the sealed token. */
export async function connectStorageAccount(
  app: StorageApp,
  grant: { email: string; refreshToken: string },
  clientId: string,
  clientSecret: string,
  actor: string,
): Promise<void> {
  const storage = storageFor(app);
  const folderId = await ensureConnectedRootFolder(
    { type: "connected-account", clientId, clientSecret, ...grant },
    storage.root,
  );
  await saveDriveConnection(storage.settings(), storage.purpose, {
    email: grant.email,
    refreshToken: grant.refreshToken,
    folderId,
    connectedAt: new Date().toISOString(),
    connectedBy: actor,
  });
  resetPhotoStore(app);
}

export async function disconnectStorageAccount(app: StorageApp): Promise<void> {
  const storage = storageFor(app);
  await clearDriveConnection(storage.settings(), storage.purpose);
  resetPhotoStore(app);
}
