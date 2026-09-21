import Link from "next/link";
import type { ReactNode } from "react";

import type { Tone } from "@/lib/domain/meta";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

/**
 * A dashboard tile. Every tile links to the contracts list filtered by the same
 * saved view, so the number and the list can never disagree.
 */
export function StatCard({
  label,
  value,
  description,
  tone = "neutral",
  href,
  total,
  icon,
}: {
  label: string;
  value: number;
  description?: string;
  tone?: Tone;
  href?: string;
  /** When given, a thin bar shows this tile's share of the database. */
  total?: number;
  icon?: ReactNode;
}) {
  const classes = TONE_CLASSES[tone];
  const share = total && total > 0 ? Math.min(100, Math.round((value / total) * 100)) : null;
  const muted = value === 0;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-tight font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
            muted ? "bg-slate-100 text-slate-400" : cn(classes.surface, classes.text),
          )}
          aria-hidden
        >
          {icon ?? <span className={cn("size-2 rounded-full", muted ? "bg-slate-300" : classes.dot)} />}
        </span>
      </div>

      <p
        className={cn(
          "numeric font-display mt-3 text-3xl font-semibold tracking-tight",
          muted ? "text-slate-300" : classes.text,
        )}
      >
        {value}
      </p>

      {share !== null ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full", muted ? "bg-slate-200" : classes.bar)}
            style={{ width: `${share}%` }}
          />
        </div>
      ) : null}

      {description ? <p className="mt-2 text-xs leading-snug text-slate-500">{description}</p> : null}
    </>
  );

  const shell = "block rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70 transition-all";

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(shell, "hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand-200")}
    >
      {body}
    </Link>
  );
}
