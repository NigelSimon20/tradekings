import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ExpiryCell, Hidden, ProfileStatusBadge } from "@/components/expats/badges";
import { PrintButton } from "@/components/expats/print-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/date/dates";
import { isHistoricalDocument } from "@/lib/expats/evaluate";
import { OPEN_ACTION } from "@/lib/expats/types";
import { requireExpatViewer } from "@/lib/services/auth";
import { getExpatProfile } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

const or = (value: ReactNode) => (value === "" || value === null || value === undefined ? "—" : value);

/**
 * The individual expat summary: key details, dependants, current documents
 * and upcoming expiry dates on one printable page.
 */
export default async function ExpatSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireExpatViewer("viewExpats");
  const { id } = await params;
  const profile = await getExpatProfile(user, decodeURIComponent(id));
  if (!profile) notFound();
  const { row, snapshot } = profile;
  const { expat } = row;
  const { restricted, today } = snapshot;
  const sensitive = (value: ReactNode) => (restricted ? <Hidden /> : or(value));
  const household = row.dependants.filter((dependant) => !dependant.archived);
  const currentPermits = row.permits.filter((permit) => permit.current || permit.inProgress);
  const documents = row.documents.filter((document) => !isHistoricalDocument(row, document));
  const openActions = row.actions.filter((action) => OPEN_ACTION.includes(action.status));
  const upcoming = [...row.expiries].sort((a, b) => a.daysRemaining - b.daysRemaining);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
        <Link href={`/expats/${encodeURIComponent(expat.id)}`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeftIcon />
          Back to the profile
        </Link>
        <PrintButton />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-700 uppercase">Trade Kings · ZimKings — Expat summary</p>
          <h1 className="font-display mt-1 text-2xl font-semibold text-slate-900">{expat.fullName}</h1>
          <p className="text-sm text-slate-600">
            {[expat.position, expat.department, expat.company].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>As at {formatDate(today)}</p>
          {expat.archived ? <Badge tone="neutral">Offboarded</Badge> : <ProfileStatusBadge status={row.status} />}
        </div>
      </header>

      <Card>
        <CardHeader title="Key details" />
        <CardBody>
          <DefinitionList
            columns={4}
            items={[
              { label: "Expat ID", value: expat.id },
              { label: "Employee number", value: or(expat.employeeNumber) },
              { label: "Nationality", value: or(expat.nationality) },
              { label: "Date of birth", value: sensitive(formatDate(expat.dateOfBirth)) },
              { label: "Phone", value: sensitive(expat.phone) },
              { label: "Email", value: sensitive(expat.email) },
              { label: "Responsible manager", value: or(expat.managerName) },
              { label: "Employment status", value: expat.employmentStatus },
              { label: "Employment start", value: or(formatDate(expat.employmentStart)) },
              { label: "Contract end", value: or(formatDate(expat.contractEnd)) },
              { label: "Residential address", value: sensitive(expat.residentialAddress) },
              {
                label: "Emergency contact",
                value: restricted ? <Hidden /> : or([expat.emergencyName, expat.emergencyPhone].filter(Boolean).join(" · ")),
              },
            ]}
          />
        </CardBody>
      </Card>

      {row.issues.length ? (
        <Card>
          <CardHeader title="Needs attention" />
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
              {row.issues.map((issue) => (
                <li key={issue.text}>{issue.text}</li>
              ))}
              {openActions.map((action) => (
                <li key={action.id}>
                  Follow-up: {action.title}
                  {action.responsibleName ? ` — ${action.responsibleName}` : ""}
                  {action.dueDate ? `, due ${formatDate(action.dueDate)}` : ""}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Dependants" description={household.length ? undefined : "No dependants recorded."} />
        {household.length ? (
          <TableWrap>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>Name</Th>
                  <Th>Relationship</Th>
                  <Th>Date of birth</Th>
                  <Th>Nationality</Th>
                </Tr>
              </THead>
              <TBody>
                {household.map((dependant) => (
                  <Tr key={dependant.id}>
                    <Td className="font-medium text-slate-900">{dependant.fullName}</Td>
                    <Td>{dependant.relationship}</Td>
                    <Td>{sensitive(formatDate(dependant.dateOfBirth))}</Td>
                    <Td>{or(dependant.nationality)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Passports, permits & cover" />
        <TableWrap>
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th>Person</Th>
                <Th>Document</Th>
                <Th>Number</Th>
                <Th>Status / expiry</Th>
              </Tr>
            </THead>
            <TBody>
              {currentPermits.map((permit) => (
                <Tr key={permit.id}>
                  <Td>{permit.personName}</Td>
                  <Td>
                    {permit.type}
                    {permit.inProgress ? " (application)" : ""}
                  </Td>
                  <Td>{restricted ? <Hidden /> : or(permit.number)}</Td>
                  <Td>
                    {permit.inProgress ? (
                      <Badge tone="info">{permit.status}</Badge>
                    ) : permit.expiry ? (
                      <ExpiryCell item={permit.expiry} />
                    ) : (
                      "No expiry date"
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader title="Upcoming expiry dates" description="Everything still being watched for this household." />
        <TableWrap>
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th>Item</Th>
                <Th>Person</Th>
                <Th>Expiry</Th>
              </Tr>
            </THead>
            <TBody>
              {upcoming.map((item) => (
                <Tr key={item.key}>
                  <Td>{item.kind}</Td>
                  <Td>{item.personName}</Td>
                  <Td>
                    <ExpiryCell item={item} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader title="Current documents on file" />
        <CardBody>
          {documents.length ? (
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {documents.map((document) => (
                <li key={document.id} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                  <span className="text-slate-800">{document.title || document.category}</span>
                  {document.title ? <span className="shrink-0 text-xs text-slate-500">{document.category}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No documents on file.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
