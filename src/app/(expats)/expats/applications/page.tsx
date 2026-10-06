import Link from "next/link";

import { Pipeline } from "@/components/expats/pipeline";
import { Hidden } from "@/components/expats/badges";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PassportIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { describeDays, daysBetween, formatDate } from "@/lib/date/dates";
import { profileHref } from "@/lib/expats/meta";
import { OPEN_APPLICATION } from "@/lib/expats/types";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

/**
 * Applications and renewals still moving through Documents Required → Ready
 * for Submission → Submitted → In Progress → Approved → Issued, with what each
 * is still waiting for.
 */
export default async function ApplicationsPage() {
  const user = await requireExpatViewer("viewExpats");
  const { applications, today, restricted } = await loadExpats(user);
  const byStage = OPEN_APPLICATION.map((stage) => ({ stage, items: applications.filter((permit) => permit.status === stage) })).filter(
    ({ items }) => items.length,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expats"
        title="Applications & renewals"
        description="Everything with the authorities or being prepared, by stage. Update the status on the profile as it moves."
      />
      {byStage.length ? (
        byStage.map(({ stage, items }) => (
          <Card key={stage}>
            <CardHeader title={stage} description={`${items.length} application${items.length === 1 ? "" : "s"}`} />
            <TableWrap>
              <Table>
                <THead>
                  <Tr className="hover:bg-transparent">
                    <Th>Person</Th>
                    <Th>Application</Th>
                    <Th className="hidden md:table-cell">Progress</Th>
                    <Th className="hidden lg:table-cell">Submitted</Th>
                    <Th>Waiting for</Th>
                  </Tr>
                </THead>
                <TBody>
                  {items.map((permit) => {
                    const href = profileHref(permit.expatId, permit.dependantId ? "household" : "immigration");
                    return (
                      <LinkRow key={permit.id} href={href} className="cursor-pointer">
                        <Td>
                          <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                            {permit.personName}
                          </Link>
                          <p className="text-xs text-slate-500">{permit.dependantId ? "Dependant" : permit.expatId}</p>
                        </Td>
                        <Td>
                          <p>
                            {permit.type}
                            {permit.replacesId ? " (renewal)" : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            {permit.issuedBy || "—"}
                            {permit.reference ? ` · ${permit.reference}` : restricted ? " · " : ""}
                            {restricted ? <Hidden /> : null}
                          </p>
                        </Td>
                        <Td className="hidden md:table-cell">
                          <Pipeline status={permit.status} compact />
                        </Td>
                        <Td className="hidden lg:table-cell">
                          {permit.submittedOn ? (
                            <>
                              <p className="numeric">{formatDate(permit.submittedOn)}</p>
                              <p className="text-xs text-slate-500">{describeDays(daysBetween(today, permit.submittedOn))}</p>
                            </>
                          ) : (
                            <span className="text-slate-400">Not yet</span>
                          )}
                        </Td>
                        <Td className="text-sm">
                          {permit.outstanding.length ? (
                            <ul className="list-disc pl-4 text-slate-700">
                              {permit.outstanding.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400">Nothing outstanding</span>
                          )}
                        </Td>
                      </LinkRow>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          </Card>
        ))
      ) : (
        <Card>
          <EmptyState icon={<PassportIcon className="size-5" />} title="No applications in progress" description="Start one from an expat's profile." />
        </Card>
      )}
    </div>
  );
}
