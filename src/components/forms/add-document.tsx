import type { ReactNode } from "react";

import { PlusIcon } from "@/components/ui/icons";

/** A collapsible "add a record" panel. Native `<details>`, so it needs no state. */
export function AddPanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl ring-1 ring-slate-200 open:bg-slate-50/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <PlusIcon className="size-4 transition-transform group-open:rotate-45" />
        {label}
      </summary>
      <div className="border-t border-slate-200 px-4 py-4">{children}</div>
    </details>
  );
}

/**
 * Adding documents to a record: an upload panel when Drive storage is set up
 * (otherwise a note saying how to set it up), and a panel to paste a link.
 */
export function AddDocumentPanels({
  uploadsOn,
  upload,
  link,
  uploadLabel = "Upload documents or photos",
}: {
  uploadsOn: boolean;
  upload: ReactNode;
  link: ReactNode;
  uploadLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {uploadsOn ? (
        <AddPanel label={uploadLabel}>{upload}</AddPanel>
      ) : (
        <p className="text-sm text-slate-500">
          Uploading is not set up yet, so documents are added as links. An administrator can connect Google Drive from
          Setup &amp; access.
        </p>
      )}
      <AddPanel label={uploadsOn ? "Add a link instead" : "Add a document link"}>{link}</AddPanel>
    </div>
  );
}
