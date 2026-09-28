import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DatabaseUnavailable } from "@/components/layout/database-unavailable";
import { canOpenProject } from "@/lib/domain/projects";
import { getCurrentUser } from "@/lib/services/auth";
import { loadSnapshot } from "@/lib/services/contracts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contract Tracker · Trade Kings & Zimkings",
  description:
    "Automated contract tracking, contract-limit monitoring and weekly reporting for blue collar and casual employees.",
};

/**
 * Every contract-tracker page shares the navigation shell. The database is
 * read once per request (the read is request-cached), so checking here for a
 * connection problem costs nothing and keeps the answer in one place.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // A signed cookie is not enough: access is re-checked against the Users tab
  // on every request, so someone removed there is sent to sign in again here,
  // before the contract database is even read.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Someone with billboard access only lands here after signing in.
  if (!canOpenProject(user, "contracts")) redirect(canOpenProject(user, "billboards") ? "/billboards" : "/login");

  const { error } = await loadSnapshot();

  return (
    <AppShell project="contracts">
      {error ? <DatabaseUnavailable reason={error} /> : children}
    </AppShell>
  );
}
