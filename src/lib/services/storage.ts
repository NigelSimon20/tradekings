import "server-only";

import { resetPhotoStore, resolvePhotoStore, storageFor, type StorageApp } from "@/lib/files";
import { getConfig } from "@/lib/config/env";
import { clearDriveConnection, readDriveConnection, saveDriveConnection, type DriveConnection } from "@/lib/files/connection";
import { connectedAccessToken, ensureConnectedRootFolder, inspectSharedFolder } from "@/lib/files/drive-store";

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
          /** Where uploads go, in words: the shared folder, or the app's own folder in My Drive. */
          location: connection.sharedFolder
            ? `the shared folder “${connection.sharedFolder.name}”${connection.sharedFolder.owner ? ` (${connection.sharedFolder.owner})` : ""}`
            : `My Drive / ${storageFor(app).root.name}`,
          sharedFolder: connection.sharedFolder
            ? {
                name: connection.sharedFolder.name,
                owner: connection.sharedFolder.owner,
                chosenAt: connection.sharedFolder.chosenAt,
                chosenBy: connection.sharedFolder.chosenBy,
              }
            : null,
        }
      : null,
    /** Whether "Use a shared folder" can be offered. */
    pickerReady: Boolean(getConfig().auth.pickerApiKey),
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

async function connectedAccount(app: StorageApp): Promise<{ connection: DriveConnection; credentials: Parameters<typeof inspectSharedFolder>[0] }> {
  const { auth } = getConfig();
  const storage = storageFor(app);
  const connection = await readDriveConnection(storage.settings(), storage.purpose);
  if (!connection || !auth.google) throw new Error("Connect a Google account first — the shared folder must be shared with it.");
  return {
    connection,
    credentials: {
      type: "connected-account",
      clientId: auth.google.clientId,
      clientSecret: auth.google.clientSecret,
      refreshToken: connection.refreshToken,
      email: connection.email,
    },
  };
}

/**
 * What Google's folder picker needs in an administrator's browser: a
 * short-lived token for the connected account (never the refresh token), the
 * picker's browser key and the Google Cloud project number.
 */
export async function folderPickerSession(app: StorageApp) {
  const { auth } = getConfig();
  if (!auth.pickerApiKey) throw new Error("The folder picker is not set up yet (GOOGLE_PICKER_API_KEY).");
  const { connection, credentials } = await connectedAccount(app);
  return {
    token: await connectedAccessToken(credentials),
    apiKey: auth.pickerApiKey,
    // The project number is the first part of the OAuth client id.
    appId: credentials.clientId.split("-")[0],
    email: connection.email,
  };
}

/** Files the app's uploads into a folder picked in Google's picker, after checking it can take them. */
export async function chooseSharedFolder(app: StorageApp, folderId: string, actor: string) {
  const storage = storageFor(app);
  const { connection, credentials } = await connectedAccount(app);
  const folder = await inspectSharedFolder(credentials, folderId);
  await saveDriveConnection(storage.settings(), storage.purpose, {
    ...connection,
    sharedFolder: { ...folder, chosenAt: new Date().toISOString(), chosenBy: actor },
  });
  resetPhotoStore(app);
  return folder;
}

/** Back to the app's own folder in the connected account's Drive. Files already in the shared folder stay there. */
export async function stopUsingSharedFolder(app: StorageApp): Promise<void> {
  const storage = storageFor(app);
  const { connection } = await connectedAccount(app);
  await saveDriveConnection(storage.settings(), storage.purpose, { ...connection, sharedFolder: null });
  resetPhotoStore(app);
}
