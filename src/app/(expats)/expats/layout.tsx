import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ExpatsUnavailable } from "@/components/expats/expats-unavailable";
import { AppShell } from "@/components/layout/app-shell";
import { canExpats } from "@/lib/auth/roles";
import { getExpatRepository } from "@/lib/expats/data";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Expat Tracker · Trade Kings & ZimKings",
  description: "Expatriate employees, their dependants, permits, homes, vehicles and documents.",
};

/**
 * Every Expat Tracker page: the shared shell with the expat navigation, for
 * people with expat access only. No other tracker's data is read here.
 */
export default async function ExpatsLayout({ children }: { children: ReactNode }) {
  const user = await requireExpatViewer("viewExpats");
  const { error } = await loadExpats(user);
  const canSetUp = getExpatRepository().kind === "google-sheets" && canExpats(user, "manageExpats");

  return <AppShell project="expats">{error ? <ExpatsUnavailable reason={error} canSetUp={canSetUp} /> : children}</AppShell>;
}
