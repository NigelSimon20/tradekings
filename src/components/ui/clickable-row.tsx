"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/** See `LinkRow` in `table.tsx` for why this is a row-level convenience only. */
export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLTableRowElement>) => {
    // Let anything genuinely interactive inside the row handle its own click.
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
    // Someone selecting text in a row is reading it, not navigating.
    if ((window.getSelection()?.toString().length ?? 0) > 0) return;

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
      window.open(href, "_blank", "noopener");
      return;
    }

    router.push(href);
  };

  return (
    <tr
      onClick={onClick}
      onAuxClick={(event) => {
        if (event.button === 1) window.open(href, "_blank", "noopener");
      }}
      className={cn("cursor-pointer transition-colors hover:bg-brand-50/40", className)}
    >
      {children}
    </tr>
  );
}
