import Image from "next/image";

import { ExternalLink } from "@/components/billboards/external-link";
import { FileUpload } from "@/components/billboards/file-upload";
import { AddPanel } from "@/components/billboards/record-forms";
import { DocumentLinkForm, DocumentTargetFields, HistoricalToggle, RemoveDocumentButton } from "@/components/expats/controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ContractsIcon } from "@/components/ui/icons";
import type { SelectOption } from "@/components/ui/field";
import { describeDays, daysBetween, formatDate, formatTimestamp } from "@/lib/date/dates";
import { isHistoricalDocument } from "@/lib/expats/evaluate";
import { DOCUMENT_CATEGORIES, type EvaluatedExpat, type ExpatDocument } from "@/lib/expats/types";

const previewUrl = (document: ExpatDocument) => `/api/expats/files/${encodeURIComponent(document.id)}`;

/** Everything a document can be filed against on this profile. */
export function documentTargets(row: EvaluatedExpat): { people: SelectOption[]; records: SelectOption[] } {
  const nameOf = (dependantId: string) =>
    dependantId ? (row.dependants.find((dependant) => dependant.id === dependantId)?.fullName ?? dependantId) : row.expat.fullName;
  return {
    people: [
      { value: "", label: `${row.expat.fullName} (the expat)` },
      ...row.dependants
        .filter((dependant) => !dependant.archived)
        .map((dependant) => ({ value: dependant.id, label: `${dependant.fullName} (${dependant.relationship})` })),
    ],
    records: [
      ...row.permits
        .filter((permit) => !permit.historical)
        .map((permit) => ({ value: permit.id, label: `${permit.type} — ${nameOf(permit.dependantId)}${permit.inProgress ? " (application)" : ""}` })),
      ...row.leases.filter((lease) => lease.status !== "Ended").map((lease) => ({ value: lease.id, label: `Lease ${lease.id}` })),
      ...row.vehicles
        .filter((vehicle) => vehicle.status === "In use")
        .map((vehicle) => ({ value: vehicle.id, label: `${vehicle.description} ${vehicle.registration}`.trim() })),
    ],
  };
}

/**
 * The profile's documents: the current copies, and history kept underneath —
 * never overwritten. Uploaded files open through the tracker (nothing is
 * shared in Drive), and only for people who may see sensitive details.
 */
export function DocumentList({
  row,
  timezone,
  today,
  restricted,
  mayAdd,
  mayRemove,
  uploadsOn,
}: {
  row: EvaluatedExpat;
  timezone: string;
  today: string;
  restricted: boolean;
  mayAdd: boolean;
  mayRemove: boolean;
  uploadsOn: boolean;
}) {
  const documents = [...row.documents].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const current = documents.filter((document) => !isHistoricalDocument(row, document));
  const history = documents.filter((document) => isHistoricalDocument(row, document));
  const targets = documentTargets(row);
  const whose = (document: ExpatDocument) =>
    document.dependantId ? row.dependants.find((dependant) => dependant.id === document.dependantId)?.fullName : "";
  const linked = (document: ExpatDocument) => {
    if (!document.recordId) return "";
    const permit = row.permits.find((record) => record.id === document.recordId);
    if (permit) return permit.type;
    if (row.leases.some((record) => record.id === document.recordId)) return "Lease";
    const vehicle = row.vehicles.find((record) => record.id === document.recordId);
    return vehicle ? vehicle.description : document.recordId;
  };

  const list = (items: ExpatDocument[], historical: boolean) => (
    <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/70">
      {items.map((document) => {
        const isImage = document.storedFileId && document.mimeType.startsWith("image/");
        const days = document.expiryDate ? daysBetween(today, document.expiryDate) : null;
        return (
          <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              {isImage && !restricted ? (
                <a href={previewUrl(document)} target="_blank" rel="noopener" className="relative block size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                  <Image src={previewUrl(document)} alt={document.title} fill unoptimized sizes="3rem" className="object-cover" />
                </a>
              ) : null}
              <div className="min-w-0">
                {restricted ? (
                  <p className="font-medium text-slate-800">{document.category}</p>
                ) : document.storedFileId ? (
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
                  {[document.category, whose(document), linked(document) ? `for ${linked(document)}` : ""].filter(Boolean).join(" · ")}
                  {" · uploaded "}
                  {formatTimestamp(document.addedAt, timezone)}
                  {document.addedBy ? ` by ${document.addedBy}` : ""}
                </p>
                {document.expiryDate ? (
                  <p className="text-xs text-slate-500">
                    Expires {formatDate(document.expiryDate)} ({describeDays(days)})
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={historical ? "neutral" : "success"}>{historical ? "Historical" : "Current"}</Badge>
              {mayAdd && (document.historical || !historical) ? <HistoricalToggle documentId={document.id} historical={document.historical} /> : null}
              {mayRemove ? <RemoveDocumentButton documentId={document.id} title={document.title || document.category} /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Card id="documents" className="scroll-mt-24">
      <CardHeader
        icon={<ContractsIcon className="size-4" />}
        title="Documents"
        description={
          restricted
            ? "Titles only — your role cannot open documents."
            : "Passports, permits, contracts, CVs, leases, vehicle and insurance papers. Older copies are kept as history."
        }
        action={<Badge tone="neutral">{current.length} current</Badge>}
      />
      <CardBody className="space-y-4">
        {current.length ? list(current, false) : <p className="text-sm text-slate-400">No current documents on file.</p>}
        {history.length ? (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
              History — {history.length} earlier or replaced document{history.length === 1 ? "" : "s"}
            </summary>
            <div className="mt-3">{list(history, true)}</div>
          </details>
        ) : null}

        {mayAdd ? (
          <div className="space-y-2">
            {uploadsOn ? (
              <AddPanel label="Upload documents">
                <FileUpload
                  endpoint="/api/expats/files"
                  fields={{ expatId: row.expat.id }}
                  categories={DOCUMENT_CATEGORIES}
                  defaultCategory="Passport"
                  titlePlaceholder="e.g. Passport bio page"
                  dateField={{ name: "expiryDate", label: "Expiry date", hint: "If the document itself expires." }}
                  extraFields={<DocumentTargetFields people={targets.people} records={targets.records} idPrefix="upload" />}
                />
              </AddPanel>
            ) : (
              <p className="text-sm text-slate-500">
                Uploading is not set up yet, so documents are added as links. An administrator can connect Google Drive
                from Setup &amp; access.
              </p>
            )}
            <AddPanel label={uploadsOn ? "Add a link instead" : "Add a document link"}>
              <DocumentLinkForm expatId={row.expat.id} people={targets.people} records={targets.records} />
            </AddPanel>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
