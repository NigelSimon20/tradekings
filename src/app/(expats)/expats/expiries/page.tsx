import Link from "next/link";

import { ExpiryTable } from "@/components/expats/expiry-table";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { DownloadIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { canExpats } from "@/lib/auth/roles";
import type { PageSearchParams } from "@/lib/domain/filters";
import { WITHIN_OPTIONS, countActive, distinct, filterExpiries, parseExpiryFilters } from "@/lib/expats/filters";
import { EXPIRY_STATUS_META } from "@/lib/expats/meta";
import { EXPIRY_GROUPS, EXPIRY_STATUSES } from "@/lib/expats/types";
import { EXPIRY_VIEWS, findView } from "@/lib/expats/views";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

/**
 * The Master Expiry View: every date being watched, across expats and their
 * dependants — passports, visas, permits, contracts, leases, licences and
 * cover — filterable by person, type, date, status and responsible person.
 */
export default async function ExpiriesPage({ searchParams }: PageSearchParams) {
  const user = await requireExpatViewer("viewExpats");
  const filters = parseExpiryFilters(await searchParams);
  const { expiries, people, today, restricted } = await loadExpats(user);
  const rows = filterExpiries(expiries, filters, today);
  const view = findView(EXPIRY_VIEWS, filters.view);
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Master expiry view"
        title={view?.label ?? "Every expiry date"}
        description={view?.description ?? "Every date being watched across expats and their dependants, most urgent first."}
        actions={
          canExpats(user, "exportExpats") ? (
            <a href={`/api/expats/export?list=expiries${exportQuery ? `&${exportQuery}` : ""}`} className={buttonClasses("secondary")}>
              <DownloadIcon className="size-4" />
              Export to Excel
            </a>
          ) : null
        }
      />

      <Card>
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <form action="/expats/expiries" className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            <label className="relative block sm:col-span-2">
              <span className="sr-only">Search</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input type="search" name="q" defaultValue={filters.q} placeholder="Name, document, reference…" className="pl-9" />
            </label>
            <Select name="view" aria-label="View" defaultValue={filters.view} placeholder="Every date" options={EXPIRY_VIEWS.map((option) => ({ value: option.id, label: option.label }))} />
            <Select
              name="expat"
              aria-label="Employee"
              defaultValue={filters.expat}
              placeholder="Every employee"
              options={people.map((row) => ({ value: row.expat.id, label: row.expat.fullName }))}
            />
            <Select name="kind" aria-label="Document type" defaultValue={filters.kind} placeholder="Any document type" options={options(distinct(expiries.map((item) => item.kind)))} />
            <Select name="group" aria-label="Group" defaultValue={filters.group} placeholder="Any group" options={options(EXPIRY_GROUPS)} />
            <Select
              name="status"
              aria-label="Status"
              defaultValue={filters.status}
              placeholder="Any status"
              options={EXPIRY_STATUSES.map((status) => ({ value: status, label: EXPIRY_STATUS_META[status].label }))}
            />
            <Select
              name="responsible"
              aria-label="Responsible person"
              defaultValue={filters.responsible}
              placeholder="Anyone responsible"
              options={options(distinct(expiries.map((item) => item.responsibleName || item.responsibleEmail)))}
            />
            <Select name="within" aria-label="Expires within" defaultValue={filters.within} placeholder="Any time" options={WITHIN_OPTIONS} />
            <Field label="From" htmlFor="from" className="[&_label]:text-xs">
              <Input id="from" name="from" type="date" defaultValue={filters.from} />
            </Field>
            <Field label="To" htmlFor="to" className="[&_label]:text-xs">
              <Input id="to" name="to" type="date" defaultValue={filters.to} />
            </Field>
            <Button type="submit">Apply</Button>
          </form>
          <div className="text-xs text-slate-500">
            Showing {rows.length} of {expiries.length}
            {countActive(filters, []) ? (
              <>
                {" · "}
                <Link href="/expats/expiries" className="font-medium text-brand-700 hover:underline">
                  Clear filters
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <ExpiryTable items={rows} restricted={restricted} />
      </Card>
    </div>
  );
}
