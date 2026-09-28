import "server-only";

import { seal, unseal } from "@/lib/auth/secret-box";
import { getBillboardRepository } from "@/lib/billboards/data";
import { getConfig } from "@/lib/config/env";

/**
 * The Google account an administrator connected for uploads. Kept in the
 * billboard sheet's hidden settings tab, sealed with AUTH_SECRET, so the
 * refresh token is never readable by people who can open the sheet.
 */
export interface DriveConnection {
  email: string;
  refreshToken: string;
  /** The tracker's own top folder in that account's Drive. */
  folderId: string;
  connectedAt: string;
  connectedBy: string;
}

const SETTING = "drive.connection";
const PURPOSE = "billboard-drive-connection";

export async function readDriveConnection(): Promise<DriveConnection | null> {
  const sealed = await getBillboardRepository().readSetting(SETTING);
  if (!sealed) return null;
  const json = await unseal(sealed, getConfig().auth.secret, PURPOSE);
  if (!json) return null;
  try {
    return JSON.parse(json) as DriveConnection;
  } catch {
    return null;
  }
}

export async function saveDriveConnection(connection: DriveConnection): Promise<void> {
  await getBillboardRepository().saveSetting(
    SETTING,
    await seal(JSON.stringify(connection), getConfig().auth.secret, PURPOSE),
  );
}

/** Forgets the account and asks Google to cancel the tracker's access to it. */
export async function clearDriveConnection(): Promise<void> {
  const connection = await readDriveConnection().catch(() => null);
  await getBillboardRepository().saveSetting(SETTING, null);
  if (connection) {
    // Best effort: the connection is forgotten here whatever Google says.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.refreshToken)}`, {
      method: "POST",
    }).catch(() => undefined);
  }
}
