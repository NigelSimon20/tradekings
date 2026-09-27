import Link from "next/link";

import { BillboardTable } from "@/components/billboards/billboard-table";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardToolbar } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { canBillboards } from "@/lib/auth/roles";
import {
  LEASE_FILTER_OPTIONS,
  countActiveBillboardFilters,
  filterBillboards,
  parseBillboardFilters,
  sortBillboardsByUrgency,
} from "@/lib/billboards/filters";
import { BILLBOARD_STATUSES } from "@/lib/billboards/types";
import { BILLBOARD_VIEWS, getBillboardView } from "@/lib/billboards/views";
import type { PageSearchParams } from "@/lib/domain/filters";
import { getCurrentUser } from "@/lib/services/auth";
import { loadBillboards } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

/** Every billboard as a searchable list. Filters live in the URL, so a view can be shared. */
export default async function BillboardListPage({ searchParams }: PageSearchParams) {
  const params = await searchParams;
  const filters = parseBillboardFilters(params);
  const showArchived = params.archived === "1";

  const [{ billboards, archived }, user] = await Promise.all([loadBillboards(), getCurrentUser()]);
  const source = showArchived ? archived : billboards;
  const rows = sortBillboardsByUrgency(filterBillboards(source, filters));
  const cities = [...new Set(billboards.map((billboard) => billboard.city).filter(Boolean))].sort();
  const view = filters.view ? getBillboardView(filters.view) : undefined;
  const mayEdit = user ? canBillboards(user.billboardRole, "editBillboards") : false;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trade Kings"
        title={showArchived ? "Archived billboards" : (view?.label ?? "All billboards")}
        description={
          showArchived
            ? "Sites taken out of use. Their history is kept; an administrator can restore them."
            : (view?.description ?? "Every site, most urgent first. Open one to see its full profile.")
        }
        actions={
          mayEdit ? (
            <ButtonLink href="/billboards/new">
              <PlusIcon />
              Add billboard
            </ButtonLink>
          ) : null
        }
      />

      <Card>
        <CardToolbar>
          <form className="flex w-full flex-wrap items-center gap-2" action="/billboards/list">
            {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
            <Input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search ID, road, area, city or brand"
              aria-label="Search"
              className="w-full sm:w-72"
            />
            <Select
              name="view"
              aria-label="Dashboard view"
              defaultValue={filters.view}
              placeholder="All sites"
              options={BILLBOARD_VIEWS.filter((option) => option.id !== "all").map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              className="w-auto"
            />
            <Select
              name="status"
              aria-label="Status"
              defaultValue={filters.status}
              placeholder="Any status"
              options={BILLBOARD_STATUSES.map((status) => ({ value: status, label: status }))}
              className="w-auto"
            />
            <Select
              name="city"
              aria-label="City or town"
              defaultValue={filters.city}
              placeholder="Any city"
              options={cities.map((city) => ({ value: city, label: city }))}
              className="w-auto"
            />
            <Select
              name="lease"
              aria-label="Lease"
              defaultValue={filters.lease}
              placeholder="Any lease"
              options={LEASE_FILTER_OPTIONS}
              className="w-auto"
            />
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
            {countActiveBillboardFilters(filters) ? (
              <Link
                href={showArchived ? "/billboards/list?archived=1" : "/billboards/list"}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Clear
              </Link>
            ) : null}
            <span className="ml-auto text-xs text-slate-500">
              {rows.length} of {source.length}
              {" · "}
              <Link
                href={showArchived ? "/billboards/list" : "/billboards/list?archived=1"}
                className="font-medium text-brand-700 hover:underline"
              >
                {showArchived ? "Back to sites in use" : `Archived (${archived.length})`}
              </Link>
            </span>
          </form>
        </CardToolbar>
        <BillboardTable billboards={rows} />
      </Card>
    </div>
  );
}
