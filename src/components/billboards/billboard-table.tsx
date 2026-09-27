import Link from "next/link";

import { BillboardFlagBadges, BillboardStatusBadge, LeaseBadge } from "@/components/billboards/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { BillboardIcon } from "@/components/ui/icons";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { EvaluatedBillboard } from "@/lib/billboards/types";
import { describeDays, formatDate } from "@/lib/date/dates";

/** Billboards as a table; every row opens the billboard's profile. */
export function BillboardTable({
  billboards,
  emptyTitle = "No billboards match",
  emptyDescription = "Try clearing a filter or searching for something else.",
}: {
  billboards: EvaluatedBillboard[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!billboards.length) {
    return (
      <EmptyState
        icon={<BillboardIcon className="size-5" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Billboard</Th>
            <Th className="hidden md:table-cell">Location</Th>
            <Th>Status</Th>
            <Th>Lease</Th>
            <Th className="hidden lg:table-cell">On the board</Th>
            <Th className="hidden xl:table-cell">Needs</Th>
          </Tr>
        </THead>
        <TBody>
          {billboards.map((billboard) => {
            const href = `/billboards/${encodeURIComponent(billboard.id)}`;
            const campaign = billboard.computed.currentCampaign;
            return (
              <LinkRow key={billboard.id} href={href} className="cursor-pointer">
                <Td>
                  <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                    {billboard.name}
                  </Link>
                  <p className="text-xs text-slate-500">{billboard.id}</p>
                </Td>
                <Td className="hidden md:table-cell">
                  <p>{billboard.city}</p>
                  <p className="text-xs text-slate-500">{[billboard.area, billboard.road].filter(Boolean).join(" · ")}</p>
                </Td>
                <Td>
                  <BillboardStatusBadge status={billboard.status} />
                </Td>
                <Td>
                  <LeaseBadge status={billboard.computed.leaseStatus} />
                  {billboard.leaseExpiry ? (
                    <p className="numeric mt-1 text-xs text-slate-500">
                      {formatDate(billboard.leaseExpiry)} · {describeDays(billboard.computed.leaseDaysRemaining)}
                    </p>
                  ) : null}
                </Td>
                <Td className="hidden lg:table-cell">
                  {campaign ? (
                    <>
                      <p>{campaign.brand}</p>
                      <p className="text-xs text-slate-500">{campaign.campaign}</p>
                    </>
                  ) : (
                    <span className="text-slate-400">Vacant</span>
                  )}
                </Td>
                <Td className="hidden xl:table-cell">
                  <BillboardFlagBadges
                    flags={billboard.computed.flags.filter((flag) => flag.code !== "MISSING_LOCATION")}
                    limit={2}
                  />
                </Td>
              </LinkRow>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
