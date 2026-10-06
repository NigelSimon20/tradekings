import Link from "next/link";

import { ApplicationBadge, ExpiryCell, Hidden } from "@/components/expats/badges";
import { Pipeline } from "@/components/expats/pipeline";
import { Badge } from "@/components/ui/badge";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/date/dates";
import type { EvaluatedPermit } from "@/lib/expats/types";

const addHref = (expatId: string, query: Record<string, string>) =>
  `/expats/${encodeURIComponent(expatId)}/add/permit?${new URLSearchParams(query).toString()}`;

/**
 * Passports, visas, permits, licences and cover — the current ones with their
 * dates, applications with where they are, and (when asked) history.
 */
export function PermitTable({
  permits,
  restricted,
  mayEdit,
  showPerson = false,
}: {
  permits: EvaluatedPermit[];
  restricted: boolean;
  mayEdit: boolean;
  showPerson?: boolean;
}) {
  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Document</Th>
            <Th className="hidden md:table-cell">Number / issued by</Th>
            <Th>Status / expiry</Th>
            {mayEdit ? <Th className="text-right">
              <span className="sr-only">Actions</span>
            </Th> : null}
          </Tr>
        </THead>
        <TBody>
          {permits.map((permit) => (
            <Tr key={permit.id}>
              <Td>
                <p className="font-medium text-slate-900">
                  {permit.type}
                  {permit.replacesId && permit.inProgress ? " — renewal" : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {showPerson ? `${permit.personName} · ` : ""}
                  {permit.id}
                  {permit.documentCount ? ` · ${permit.documentCount} document${permit.documentCount === 1 ? "" : "s"}` : permit.current ? " · no copy on file" : ""}
                </p>
                {permit.notes ? <p className="mt-0.5 text-xs text-slate-500">{permit.notes}</p> : null}
              </Td>
              <Td className="hidden md:table-cell">
                <p>{restricted ? <Hidden /> : permit.number || <span className="text-slate-400">—</span>}</p>
                <p className="text-xs text-slate-500">
                  {permit.issuedBy || "—"}
                  {permit.issueDate ? ` · issued ${formatDate(permit.issueDate)}` : ""}
                </p>
              </Td>
              <Td>
                {permit.inProgress ? (
                  <div className="space-y-1">
                    <Pipeline status={permit.status} />
                    {permit.outstanding.length ? (
                      <p className="text-xs text-slate-600">
                        <span className="font-medium">Waiting for:</span> {permit.outstanding.join(", ")}
                      </p>
                    ) : null}
                    {permit.submittedOn ? <p className="text-xs text-slate-500">Submitted {formatDate(permit.submittedOn)}</p> : null}
                  </div>
                ) : permit.historical ? (
                  <span className="flex flex-col items-start gap-1">
                    {permit.status === "Issued" ? <Badge tone="neutral">Replaced</Badge> : <ApplicationBadge status={permit.status} />}
                    {permit.expiryDate ? <span className="text-xs text-slate-500">Expired / ran to {formatDate(permit.expiryDate)}</span> : null}
                  </span>
                ) : permit.expiry ? (
                  <span className="flex flex-col items-start gap-1">
                    <ExpiryCell item={permit.expiry} />
                    {permit.renewal ? (
                      <span className="text-xs text-slate-600">
                        Renewal: <span className="font-medium">{permit.renewal.status}</span>
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="flex flex-col items-start gap-1">
                    <ApplicationBadge status={permit.status} />
                    <span className="text-xs text-slate-500">No expiry date</span>
                  </span>
                )}
              </Td>
              {mayEdit ? (
                <Td className="text-right whitespace-nowrap">
                  <span className="inline-flex flex-col items-end gap-1 text-xs font-medium">
                    <Link
                      href={`/expats/${encodeURIComponent(permit.expatId)}/edit/permit/${encodeURIComponent(permit.id)}`}
                      className="text-brand-700 hover:underline"
                    >
                      {permit.inProgress ? "Update" : "Edit"}
                    </Link>
                    {permit.current && !permit.renewal ? (
                      <Link
                        href={addHref(permit.expatId, {
                          renews: permit.id,
                          type: permit.type,
                          ...(permit.dependantId ? { dependant: permit.dependantId } : {}),
                        })}
                        className="text-brand-700 hover:underline"
                      >
                        Start renewal
                      </Link>
                    ) : null}
                  </span>
                </Td>
              ) : null}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}

export { addHref as addPermitHref };
