import type { Metadata } from "next";
import type { ReactNode } from "react";

import { setUpLicenseSheetAction } from "@/app/(licenses)/licenses/actions";
import { AppShell } from "@/components/layout/app-shell";
import { TrackerUnavailable } from "@/components/settings/setup-cards";
import { canLicenses } from "@/lib/auth/roles";
import { getLicenseRepository } from "@/lib/licenses/data";
import { LICENSE_STORE } from "@/lib/licenses/data/sheet-tables";
import { requireLicenseViewer } from "@/lib/services/auth";
import { loadLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "License Tracker · Trade Kings & ZimKings",
  description: "Company licenses, permits and compliance documents in one register.",
};

/**
 * Every License Tracker page: the shared shell with the license navigation,
 * for people with license access only. The contract and billboard databases
 * are never read here.
 */
export default async function LicensesLayout({ children }: { children: ReactNode }) {
  const user = await requireLicenseViewer("viewLicenses");
  const { error } = await loadLicenses();
  const canSetUp = getLicenseRepository().kind === "google-sheets" && canLicenses(user, "manageLicenses");

  return (
    <AppShell project="licenses">
      {error ? (
        <TrackerUnavailable store={LICENSE_STORE} reason={error} setUp={canSetUp ? setUpLicenseSheetAction : undefined} />
      ) : (
        children
      )}
    </AppShell>
  );
}
