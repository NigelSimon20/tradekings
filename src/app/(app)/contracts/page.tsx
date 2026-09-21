import Link from "next/link";

import { ContractFiltersBar } from "@/components/contracts/contract-filters";
import { ContractTable } from "@/components/contracts/contract-table";
import { ImportDialog } from "@/components/contracts/import-dialog";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardFooter, CardToolbar } from "@/components/ui/card";
import { DownloadIcon, PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import {
  applyFilters,
  buildFilterOptions,
  parseFilters,
  sortByUrgency,
  toSearchParams,
} from "@/lib/domain/filters";
import { getView } from "@/lib/domain/views";
import { loadSnapshot } from "@/lib/services/contracts";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const { contracts } = await loadSnapshot();

  const view = getView(filters.view);
  const matching = sortByUrgency(applyFilters(contracts, filters));
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const needsAction = matching.filter((contract) => contract.computed.needsAction).length;

  const buildHref = (nextPage: number) =>
    `/contracts?${toSearchParams({ ...filters, page: nextPage }).toString()}`;
  const exportHref = filters.history ? "/api/export?history=1" : "/api/export";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contract database"
        title="Contracts"
        description="Every contract row, with the Trade Kings, Zimkings and casual rules applied automatically."
        actions={
          <ButtonLink href="/contracts/new">
            <PlusIcon className="size-4" />
            Add contract
          </ButtonLink>
        }
      />

      {view ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm ring-1 ring-brand-100">
          <Badge tone={view.tone}>{view.label}</Badge>
          <span className="text-brand-900">{view.description}</span>
          <Link
            href={`/contracts?${toSearchParams({ ...filters, view: "", page: 1 }).toString()}`}
            className="ml-auto text-xs font-medium text-brand-800 hover:underline"
          >
            Clear view
          </Link>
        </div>
      ) : null}

      <ContractFiltersBar
        filters={filters}
        options={buildFilterOptions(contracts)}
        resultCount={matching.length}
      />

      <Card>
        <CardToolbar>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="numeric font-medium text-slate-900">{matching.length}</span>
            <span>contract{matching.length === 1 ? "" : "s"}</span>
            {needsAction > 0 ? (
              <Badge tone="warning">{needsAction} need action</Badge>
            ) : (
              <Badge tone="success">Nothing outstanding</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ImportDialog />
            <ButtonLink href={exportHref} variant="secondary" size="sm">
              <DownloadIcon className="size-4" />
              Export CSV
            </ButtonLink>
          </div>
        </CardToolbar>

        <ContractTable
          contracts={rows}
          emptyTitle="No contracts match these filters"
          emptyDescription="Adjust or clear the filters, or import contracts from a spreadsheet."
        />

        <CardFooter>
          <Pagination page={page} pageCount={pageCount} total={matching.length} buildHref={buildHref} />
        </CardFooter>
      </Card>
    </div>
  );
}
