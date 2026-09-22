import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { ClickableRow } from "@/components/ui/clickable-row";
import { cn } from "@/lib/ui/cn";

/** Scrollable wrapper — wide contract tables stay usable on small screens. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto scroll-slim", className)}>{children}</div>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>;
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50/80 text-left backdrop-blur-sm">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("transition-colors hover:bg-brand-50/40", className)}>{children}</tr>;
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cn(
        "border-b border-slate-200/80 px-4 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} className={cn("px-4 py-3 align-top text-slate-700", className)}>
      {children}
    </td>
  );
}

/**
 * A table row that opens a page when clicked anywhere.
 *
 * The row is a convenience for mouse users; the real link stays on the primary
 * cell so keyboard and screen-reader users get one proper, focusable link
 * rather than a row that only responds to a mouse. Clicks that land on a link
 * or button inside the row, and clicks that finish a text selection, are left
 * alone, and ctrl/cmd-click still opens a new tab.
 */
export function LinkRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ClickableRow href={href} className={className}>
      {children}
    </ClickableRow>
  );
}
