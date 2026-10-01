import "server-only";

import { seal, unseal } from "@/lib/auth/secret-box";
import { getConfig } from "@/lib/config/env";

/**
 * The Google account an administrator connected for an app's uploads. Kept in
 * that app's sheet (its hidden settings tab), sealed with AUTH_SECRET, so the
 * refresh token is never readable by people who can open the sheet.
 */
export interface DriveConnection {
  email: string;
  refreshToken: string;
  /** The app's own top folder in that account's Drive. */
  folderId: string;
  connectedAt: string;
  connectedBy: string;
}

/** Where an app keeps small pieces of system state. */
export interface SettingsStore {
  readSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string | null): Promise<void>;
}

const SETTING = "drive.connection";

export async function readDriveConnection(settings: SettingsStore, purpose: string): Promise<DriveConnection | null> {
  const sealed = await settings.readSetting(SETTING);
  if (!sealed) return null;
  const json = await unseal(sealed, getConfig().auth.secret, purpose);
  if (!json) return null;
  try {
    return JSON.parse(json) as DriveConnection;
  } catch {
    return null;
  }
}

export async function saveDriveConnection(
  settings: SettingsStore,
  purpose: string,
  connection: DriveConnection,
): Promise<void> {
  await settings.saveSetting(SETTING, await seal(JSON.stringify(connection), getConfig().auth.secret, purpose));
}

/** Forgets the account and asks Google to cancel the tracker's access to it. */
export async function clearDriveConnection(settings: SettingsStore, purpose: string): Promise<void> {
  const connection = await readDriveConnection(settings, purpose).catch(() => null);
  await settings.saveSetting(SETTING, null);
  if (connection) {
    // Best effort: the connection is forgotten here whatever Google says.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.refreshToken)}`, {
      method: "POST",
    }).catch(() => undefined);
  }
}
