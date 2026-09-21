import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { DatabaseUnavailable } from "@/components/layout/database-unavailable";
import { loadSnapshot } from "@/lib/services/contracts";

export const dynamic = "force-dynamic";

/**
 * Every signed-in page shares the navigation shell. The database is read once
 * per request (the read is request-cached), so checking here for a connection
 * problem costs nothing and keeps the answer in one place.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { error } = await loadSnapshot();

  return <AppShell>{error ? <DatabaseUnavailable reason={error} /> : children}</AppShell>;
}
