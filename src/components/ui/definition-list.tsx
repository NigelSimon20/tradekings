import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export interface DefinitionItem {
  label: string;
  value: ReactNode;
}

/** Key/value grid used on the contract detail page. */
export function DefinitionList({
  items,
  columns = 3,
  className,
}: {
  items: DefinitionItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridColumns = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <dl className={cn("grid gap-x-6 gap-y-4", gridColumns, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm break-words text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
