"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/** Sidebar navigation item with an active indicator. */
export function NavLink({
  href,
  label,
  description,
  icon,
  exact = false,
}: {
  href: string;
  label: string;
  description?: string;
  /** Rendered by the server component — elements cross the boundary, functions do not. */
  icon: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
      )}
    >
      {active ? (
        <span className="absolute top-2.5 bottom-2.5 -left-3 w-1 rounded-r-full bg-accent-500" aria-hidden />
      ) : null}
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          active ? "bg-accent-500/25 text-white" : "bg-white/5 text-white/70 group-hover:text-white",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {description ? (
          <span className="block truncate text-xs text-white/45">{description}</span>
        ) : null}
      </span>
    </Link>
  );
}
