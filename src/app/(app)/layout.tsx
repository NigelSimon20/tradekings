import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DatabaseUnavailable } from "@/components/layout/database-unavailable";
import { getCurrentUser } from "@/lib/services/auth";
import { loadSnapshot } from "@/lib/services/contracts";

export const dynamic = "force-dynamic";

/**
 * Every contract-tracker page shares the navigation shell. The database is
 * read once per request (the read is request-cached), so checking here for a
 * connection problem costs nothing and keeps the answer in one place.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Someone with billboard access only lands here after signing in; send them
  // to their tracker before the contract database is even read.
  const user = await getCurrentUser();
  if (user && !user.role) redirect(user.billboardRole ? "/billboards" : "/login");

  const { error } = await loadSnapshot();

  return (
    <AppShell project="contracts">
      {error ? <DatabaseUnavailable reason={error} /> : children}
    </AppShell>
  );
}
