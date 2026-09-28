import type { ReactNode } from "react";

import { BillboardsUnavailable } from "@/components/billboards/billboards-unavailable";
import { AppShell } from "@/components/layout/app-shell";
import { canBillboards } from "@/lib/auth/roles";
import { getBillboardRepository } from "@/lib/billboards/data";
import { requireBillboardViewer } from "@/lib/services/auth";
import { loadBillboards } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

/**
 * Every billboard-tracker page: the shared shell with the billboard
 * navigation. Only people with billboard access get past this, and the
 * contract database is never read here.
 */
export default async function BillboardsLayout({ children }: { children: ReactNode }) {
  const user = await requireBillboardViewer("viewBillboards");
  const { error } = await loadBillboards();
  const canSetUp =
    getBillboardRepository().kind === "google-sheets" &&
    canBillboards(user, "manageBillboards");

  return (
    <AppShell project="billboards">
      {error ? <BillboardsUnavailable reason={error} canSetUp={canSetUp} /> : children}
    </AppShell>
  );
}
