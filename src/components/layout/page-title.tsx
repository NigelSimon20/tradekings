"use client";

import { usePathname } from "next/navigation";

import { titleForPath } from "@/components/layout/nav-items";

/** Shows which part of the tracker is open, next to the logo in the top bar. */
export function PageTitle() {
  return <span className="font-display text-sm font-semibold text-slate-900">{titleForPath(usePathname())}</span>;
}
