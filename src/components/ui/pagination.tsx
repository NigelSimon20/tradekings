import Link from "next/link";

import { cn } from "@/lib/ui/cn";

export function Pagination({
  page,
  pageCount,
  total,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  /** Returns the URL for a page number, preserving the current filters. */
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return (
      <p className="text-xs text-slate-500">
        {total} contract{total === 1 ? "" : "s"}
      </p>
    );
  }

  const link =
    "rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset ring-slate-200 transition bg-white";

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        Page <span className="numeric font-medium text-slate-700">{page}</span> of {pageCount} ·{" "}
        {total} contracts
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={buildHref(Math.max(1, page - 1))}
          aria-disabled={page === 1}
          className={cn(
            link,
            page === 1 ? "pointer-events-none text-slate-300" : "text-slate-700 hover:bg-slate-50",
          )}
        >
          Previous
        </Link>
        <Link
          href={buildHref(Math.min(pageCount, page + 1))}
          aria-disabled={page === pageCount}
          className={cn(
            link,
            page === pageCount ? "pointer-events-none text-slate-300" : "text-slate-700 hover:bg-slate-50",
          )}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
