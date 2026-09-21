import type { ReactNode } from "react";

import type { Tone } from "@/lib/domain/meta";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

export function Alert({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const classes = TONE_CLASSES[tone];
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm",
        classes.surface,
        classes.border,
        className,
      )}
    >
      {icon ? <span className={cn("mt-0.5 shrink-0", classes.text)}>{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className={cn("font-semibold", classes.text)}>{title}</p> : null}
        {children ? <div className={cn(title ? "mt-1" : "", "text-slate-700")}>{children}</div> : null}
      </div>
    </div>
  );
}
