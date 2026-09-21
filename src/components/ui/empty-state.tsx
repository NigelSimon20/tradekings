import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon ?? <span className="size-2.5 rounded-full bg-slate-300" aria-hidden />}
      </span>
      <p className="font-display mt-1 text-sm font-semibold text-slate-900">{title}</p>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
