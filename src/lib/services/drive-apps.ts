import "server-only";

import { canBillboards, canLicenses } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { StorageApp } from "@/lib/files";
import { connectDriveAccount } from "@/lib/services/billboards";
import { connectLicenseStorage } from "@/lib/services/licenses";

/**
 * The apps a Google account can be connected to for document storage: where
 * each one's Setup & access page is, who may connect it, and what to call.
 */
export const DRIVE_APPS: Record<
  StorageApp,
  {
    settingsPath: string;
    allowed: (user: SessionUser) => boolean;
    who: string;
    connect: (
      grant: { email: string; refreshToken: string },
      clientId: string,
      clientSecret: string,
      actor: string,
    ) => Promise<void>;
  }
> = {
  billboards: {
    settingsPath: "/billboards/settings",
    allowed: (user) => canBillboards(user, "manageBillboards"),
    who: "a Billboard Tracker administrator",
    connect: connectDriveAccount,
  },
  licenses: {
    settingsPath: "/licenses/settings",
    allowed: (user) => canLicenses(user, "manageLicenses"),
    who: "a License Tracker administrator",
    connect: connectLicenseStorage,
  },
};

export function driveAppFor(value: string | null): StorageApp | null {
  return value === "billboards" || value === "licenses" ? value : null;
}

/** Which app a Setup & access path belongs to (where the Google trip returns to). */
export function driveAppForPath(path: string): StorageApp | null {
  return (Object.keys(DRIVE_APPS) as StorageApp[]).find((app) => DRIVE_APPS[app].settingsPath === path) ?? null;
}
