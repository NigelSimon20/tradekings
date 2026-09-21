import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

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
