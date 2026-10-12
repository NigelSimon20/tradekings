import Link from "next/link";

import { BillboardTable } from "@/components/billboards/billboard-table";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ActivityCard } from "@/components/ui/activity-card";
import { Card, CardHeader } from "@/components/ui/card";
import { AlertIcon, BillboardIcon, ContractsIcon, MapIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { sortBillboardsByUrgency } from "@/lib/billboards/filters";
import { BILLBOARD_VIEWS, getBillboardView } from "@/lib/billboards/views";
import { formatDate } from "@/lib/date/dates";
import { requireBillboardViewer } from "@/lib/services/auth";
import { loadBillboards, recentBillboardActivity } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

export default async function BillboardDashboardPage() {
  await requireBillboardViewer("viewBillboards");
  const [{ billboards, today }, activity] = await Promise.all([loadBillboards(), recentBillboardActivity(8)]);

  const count = (id: string) => billboards.filter(getBillboardView(id)!.matches).length;
  const followUp = sortBillboardsByUrgency(billboards.filter(getBillboardView("follow-up")!.matches));
  const expiring = billboards
    .filter(getBillboardView("lease-90")!.matches)
    .sort((a, b) => (a.leaseExpiry ?? "").localeCompare(b.leaseExpiry ?? ""));

  const cities = [...new Set(billboards.map((billboard) => billboard.city))].sort().map((city) => {
    const sites = billboards.filter((billboard) => billboard.city === city);
    return {
      city,
      total: sites.length,
      active: sites.filter((site) => site.status === "Active").length,
      followUp: sites.filter((site) => site.computed.needsFollowUp).length,
    };
  });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Trade Kings"
        title="Billboard dashboard"
        description={`The billboard network as at ${formatDate(today)}. Every number opens the sites behind it.`}
        actions={
          <ButtonLink href="/billboards" variant="secondary">
            <MapIcon />
            Open the map
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BILLBOARD_VIEWS.map((view) => (
          <StatCard
            key={view.id}
            label={view.label}
            value={count(view.id)}
            description={view.description}
            tone={view.tone}
            total={view.id === "all" ? undefined : billboards.length}
            href={`/billboards/list?view=${view.id}`}
          />
        ))}
      </div>

      <Card>
        <CardHeader
          icon={<AlertIcon className="size-4" />}
          title="Sites requiring follow-up"
          description="Expired or expiring leases, notice deadlines, overdue inspections, repairs and campaigns left up."
          action={
            <ButtonLink href="/billboards/list?view=follow-up" variant="secondary" size="sm">
              View all {followUp.length}
            </ButtonLink>
          }
        />
        <BillboardTable
          billboards={followUp.slice(0, 8)}
          emptyTitle="Nothing to follow up"
          emptyDescription="Every site's lease, inspections and campaigns are in order."
        />
      </Card>

      <Card>
        <CardHeader
          icon={<ContractsIcon className="size-4" />}
          title="Leases ending in the next 90 days"
          description="Soonest first."
        />
        <BillboardTable
          billboards={expiring}
          emptyTitle="No leases end in the next 90 days"
          emptyDescription="Nothing to renew for now."
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<BillboardIcon className="size-4" />} title="By city or town" />
          <TableWrap>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>City / town</Th>
                  <Th className="text-right">Sites</Th>
                  <Th className="text-right">Active</Th>
                  <Th className="text-right">Follow-up</Th>
                </Tr>
              </THead>
              <TBody>
                {cities.map((row) => (
                  <Tr key={row.city}>
                    <Td>
                      <Link
                        href={`/billboards/list?city=${encodeURIComponent(row.city)}`}
                        className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {row.city}
                      </Link>
                    </Td>
                    <Td className="numeric text-right">{row.total}</Td>
                    <Td className="numeric text-right">{row.active}</Td>
                    <Td className="text-right">
                      {row.followUp ? <Badge tone="danger">{row.followUp}</Badge> : <span className="text-slate-400">—</span>}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
        <ActivityCard
          title="Recent changes"
          description="Who changed what, and when. Every change is kept in the Activity Log tab."
          items={activity.map((entry) => ({
            ...entry,
            link: entry.billboardId ? { href: `/billboards/${encodeURIComponent(entry.billboardId)}`, label: entry.billboardId } : null,
          }))}
          empty="No changes recorded yet."
        />
      </div>
    </div>
  );
}
