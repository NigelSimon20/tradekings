import type { ReactNode } from "react";

/**
 * Technical detail, folded away.
 *
 * When something is misconfigured the person looking at the screen usually
 * cannot fix it, but the administrator they call needs the specifics. This
 * keeps those out of everyone else's way without losing them.
 */
export function AdminDetails({ children }: { children: ReactNode }) {
  return (
    <details className="text-xs text-slate-500">
      <summary className="cursor-pointer select-none hover:text-slate-700">
        Details for the system administrator
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
