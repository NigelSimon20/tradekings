import Image from "next/image";

import { FileUpload } from "@/components/billboards/file-upload";
import { ExternalLink } from "@/components/billboards/external-link";
import { AddPanel } from "@/components/billboards/record-forms";
import { DocumentLinkForm, RemoveDocumentButton } from "@/components/licenses/license-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ContractsIcon } from "@/components/ui/icons";
import { isSafeUrl } from "@/lib/billboards/schema";
import { formatDate } from "@/lib/date/dates";
import { DOCUMENT_CATEGORIES, type LicenseDocument } from "@/lib/licenses/types";

const previewUrl = (document: LicenseDocument) => `/api/licenses/files/${encodeURIComponent(document.id)}`;

/**
 * Supporting documents for a license or an asset. Uploaded files open through
 * the tracker (nothing is shared publicly in Drive); pasted links are checked
 * before they are made clickable.
 */
export function DocumentList({
  documents,
  target,
  mayAdd,
  mayRemove,
  uploadsOn,
  defaultCategory = "License / certificate",
}: {
  documents: LicenseDocument[];
  target: { licenseId: string; assetId: string };
  mayAdd: boolean;
  mayRemove: boolean;
  uploadsOn: boolean;
  defaultCategory?: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Documents"
        description="Licenses, certificates, applications and correspondence. Removing one hides it here; the record is kept."
        action={<Badge tone="neutral">{documents.length}</Badge>}
      />
      <CardBody className="space-y-4">
        {documents.length ? (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/70">
            {documents.map((document) => {
              const isImage = document.storedFileId && document.mimeType.startsWith("image/");
              return (
                <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {isImage ? (
                      <a href={previewUrl(document)} target="_blank" rel="noopener" className="relative block size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                        <Image src={previewUrl(document)} alt={document.title} fill unoptimized sizes="3rem" className="object-cover" />
                      </a>
                    ) : null}
                    <div className="min-w-0">
                      {document.storedFileId ? (
                        <a
                          href={previewUrl(document)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 font-medium break-all text-brand-700 hover:underline"
                        >
                          <ContractsIcon className="size-3.5 shrink-0" />
                          {document.title}
                        </a>
                      ) : (
                        <ExternalLink href={document.url}>{document.title}</ExternalLink>
                      )}
                      <p className="text-xs text-slate-500">
                        {document.category}
                        {document.documentDate ? ` · ${formatDate(document.documentDate)}` : ""} · added by {document.addedBy || "—"}
                        {document.storedFileId && isSafeUrl(document.url) ? (
                          <>
                            {" · "}
                            <a href={document.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                              Drive
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {mayRemove ? <RemoveDocumentButton documentId={document.id} title={document.title} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No documents yet.</p>
        )}

        {mayAdd ? (
          <div className="space-y-2">
            {uploadsOn ? (
              <AddPanel label="Upload documents or photos">
                <FileUpload
                  endpoint="/api/licenses/files"
                  fields={target}
                  categories={DOCUMENT_CATEGORIES}
                  defaultCategory={defaultCategory}
                />
              </AddPanel>
            ) : (
              <p className="text-sm text-slate-500">
                Uploading is not set up yet, so documents are added as links. An administrator can connect Google
                Drive from Setup &amp; access.
              </p>
            )}
            <AddPanel label={uploadsOn ? "Add a link instead" : "Add a document link"}>
              <DocumentLinkForm licenseId={target.licenseId} assetId={target.assetId} />
            </AddPanel>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
