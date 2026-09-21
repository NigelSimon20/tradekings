import type { ReactNode } from "react";

import type { Tone } from "@/lib/domain/meta";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

export function Badge({
  tone = "neutral",
  children,
  title,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone].badge,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  return <span className={cn("size-1.5 rounded-full", TONE_CLASSES[tone].dot)} aria-hidden />;
}
