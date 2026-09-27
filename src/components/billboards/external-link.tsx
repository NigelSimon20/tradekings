import type { ReactNode } from "react";

import { LinkIcon } from "@/components/ui/icons";
import { isSafeUrl } from "@/lib/billboards/schema";

/**
 * A link to a stored file or document. Links typed straight into the sheet
 * skip the form's validation, so anything that is not http(s) — such as a
 * `javascript:` URL — is shown as text rather than made clickable.
 */
export function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  if (!href.trim()) return <span className="text-slate-400">—</span>;
  if (!isSafeUrl(href)) {
    return <span className="text-slate-500" title={href}>Link not recognised — fix it in the sheet</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium break-all text-brand-700 hover:underline"
    >
      <LinkIcon className="size-3.5 shrink-0" />
      {children ?? "Open"}
    </a>
  );
}
