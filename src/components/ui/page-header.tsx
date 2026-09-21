import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  /** Small label above the title, e.g. the company scope. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
