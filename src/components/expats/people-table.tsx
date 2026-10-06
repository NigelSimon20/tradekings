import Link from "next/link";

import { ExpiryCell, ProfileStatusBadge } from "@/components/expats/badges";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersIcon } from "@/components/ui/icons";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { profileHref } from "@/lib/expats/meta";
import type { EvaluatedExpat } from "@/lib/expats/types";

/** Expats as a table; every row opens the profile. */
export function PeopleTable({
  rows,
  emptyTitle = "No expats match",
  emptyDescription = "Try clearing a filter or searching for something else.",
}: {
  rows: EvaluatedExpat[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!rows.length) {
    return <EmptyState icon={<UsersIcon className="size-5" />} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Expat</Th>
            <Th className="hidden md:table-cell">Company / department</Th>
            <Th className="hidden xl:table-cell">Nationality</Th>
            <Th>Profile</Th>
            <Th className="hidden lg:table-cell">Next expiry</Th>
            <Th className="hidden 2xl:table-cell text-right">Household</Th>
            <Th className="hidden xl:table-cell text-right">Follow-ups</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            const { expat } = row;
            const href = profileHref(expat.id);
            const household = row.dependants.filter((dependant) => !dependant.archived).length;
            return (
              <LinkRow key={expat.id} href={href} className="cursor-pointer">
                <Td>
                  <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                    {expat.fullName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {[expat.id, expat.position].filter(Boolean).join(" · ")}
                    {expat.employmentStatus !== "Active" && !expat.archived ? ` · ${expat.employmentStatus}` : ""}
                  </p>
                </Td>
                <Td className="hidden md:table-cell">
                  <p>{expat.company}</p>
                  <p className="text-xs text-slate-500">{expat.department || "—"}</p>
                </Td>
                <Td className="hidden xl:table-cell">{expat.nationality}</Td>
                <Td>
                  <span className="flex flex-col items-start gap-1">
                    <ProfileStatusBadge status={row.status} />
                    {row.issues.length ? (
                      <span className="line-clamp-1 max-w-56 text-xs text-slate-500" title={row.issues.map((issue) => issue.text).join("\n")}>
                        {row.issues[0].text}
                        {row.issues.length > 1 ? ` +${row.issues.length - 1}` : ""}
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td className="hidden lg:table-cell">
                  {row.nextExpiry ? (
                    <>
                      <p className="text-xs font-medium text-slate-700">
                        {row.nextExpiry.kind}
                        {row.nextExpiry.dependantId ? ` — ${row.nextExpiry.personName}` : ""}
                      </p>
                      <ExpiryCell item={row.nextExpiry} />
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Td>
                <Td className="hidden text-right 2xl:table-cell">{household ? `+${household}` : "—"}</Td>
                <Td className="hidden text-right xl:table-cell">
                  {row.overdueActions ? (
                    <Badge tone="danger">{row.overdueActions} overdue</Badge>
                  ) : row.openActions ? (
                    <Badge tone="warning">{row.openActions} open</Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Td>
              </LinkRow>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
