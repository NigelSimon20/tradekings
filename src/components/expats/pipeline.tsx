import { PIPELINE, type ApplicationStatus } from "@/lib/expats/types";
import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES } from "@/lib/ui/tones";

/**
 * Where an application is: Documents Required → Ready for Submission →
 * Submitted → In Progress → Approved → Issued, as a row of steps.
 */
export function Pipeline({ status, compact = false }: { status: ApplicationStatus; compact?: boolean }) {
  const at = PIPELINE.indexOf(status);
  if (at === -1) return <span className="text-xs text-slate-500">{status}</span>;
  return (
    <ol className="flex items-center gap-1" aria-label={`Application: ${status}`}>
      {PIPELINE.map((step, index) => (
        <li key={step} className="flex items-center gap-1" title={step}>
          <span
            className={cn(
              "block h-1.5 rounded-full",
              compact ? "w-4" : "w-6 sm:w-8",
              index < at ? TONE_CLASSES.success.dot : index === at ? TONE_CLASSES.info.dot : "bg-slate-200",
            )}
          />
        </li>
      ))}
      {compact ? null : <span className="ml-1.5 text-xs font-medium text-slate-700">{status}</span>}
    </ol>
  );
}
