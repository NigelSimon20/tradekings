import Link from "next/link";

import { PeopleTable } from "@/components/expats/people-table";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { DownloadIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { canExpats } from "@/lib/auth/roles";
import type { PageSearchParams } from "@/lib/domain/filters";
import {
  ACTION_FILTER_OPTIONS,
  PERMIT_STATUS_OPTIONS,
  WITHIN_OPTIONS,
  countActive,
  distinct,
  filterPeople,
  parsePeopleFilters,
} from "@/lib/expats/filters";
import { PROFILE_STATUS_META } from "@/lib/expats/meta";
import { LEASE_STATUSES, PERMIT_TYPES, PROFILE_STATUSES } from "@/lib/expats/types";
import { PEOPLE_VIEWS, findView } from "@/lib/expats/views";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

/** Every expat, searchable by the brief's list. Filters live in the URL, and the export follows them. */
export default async function PeoplePage({ searchParams }: PageSearchParams) {
  const user = await requireExpatViewer("viewExpats");
  const params = await searchParams;
  const filters = parsePeopleFilters(params);
  const showArchived = params.archived === "1";

  const { people, archived, today } = await loadExpats(user);
  const source = showArchived ? archived : people;
  const rows = filterPeople(source, filters, today);
  const view = findView(PEOPLE_VIEWS, filters.view);
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as [string, string][]).toString();
  const all = [...people, ...archived];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expats"
        title={showArchived ? "Offboarded expats" : (view?.label ?? "All expats")}
        description={
          showArchived
            ? "Expats who have left. Profiles are archived, never deleted, with their offboarding record and history."
            : (view?.description ?? "Every expat on the books. Open one for their full profile and household.")
        }
        actions={
          <>
            {canExpats(user, "exportExpats") && !showArchived ? (
              <a href={`/api/expats/export?list=people${exportQuery ? `&${exportQuery}` : ""}`} className={buttonClasses("secondary")}>
                <DownloadIcon className="size-4" />
                Export to Excel
              </a>
            ) : null}
            {canExpats(user, "editExpats") ? (
              <ButtonLink href="/expats/new">
                <PlusIcon />
                Add expat
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <form action="/expats/people" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
            <label className="relative block sm:col-span-2">
              <span className="sr-only">Search</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input type="search" name="q" defaultValue={filters.q} placeholder="Name, employee number, dependant…" className="pl-9" />
            </label>
            <Select name="view" aria-label="Dashboard view" defaultValue={filters.view} placeholder="Everyone" options={PEOPLE_VIEWS.map((option) => ({ value: option.id, label: option.label }))} />
            <Select name="company" aria-label="Company" defaultValue={filters.company} placeholder="Any company" options={options(distinct(all.map((row) => row.expat.company)))} />
            <Select name="department" aria-label="Department" defaultValue={filters.department} placeholder="Any department" options={options(distinct(all.map((row) => row.expat.department)))} />
            <Select name="nationality" aria-label="Nationality" defaultValue={filters.nationality} placeholder="Any nationality" options={options(distinct(all.map((row) => row.expat.nationality)))} />
            <Select name="position" aria-label="Position" defaultValue={filters.position} placeholder="Any position" options={options(distinct(all.map((row) => row.expat.position)))} />
            <Select name="permitType" aria-label="Permit type" defaultValue={filters.permitType} placeholder="Work / residence permit" options={options(PERMIT_TYPES)} />
            <Select name="permitStatus" aria-label="Permit status" defaultValue={filters.permitStatus} placeholder="Any permit status" options={PERMIT_STATUS_OPTIONS} />
            <Select name="expiresWithin" aria-label="Something expires" defaultValue={filters.expiresWithin} placeholder="Any expiry date" options={WITHIN_OPTIONS} />
            <Select name="leaseStatus" aria-label="Lease status" defaultValue={filters.leaseStatus} placeholder="Any lease status" options={[...options(LEASE_STATUSES), { value: "none", label: "No lease" }]} />
            <Select
              name="completeness"
              aria-label="Profile completeness"
              defaultValue={filters.completeness}
              placeholder="Any profile status"
              options={PROFILE_STATUSES.map((status) => ({ value: status, label: PROFILE_STATUS_META[status].label }))}
            />
            <Select name="actions" aria-label="Outstanding actions" defaultValue={filters.actions} placeholder="Any follow-ups" options={ACTION_FILTER_OPTIONS} />
            <Button type="submit" className="sm:col-span-2 lg:col-span-1">
              Apply
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing {rows.length} of {source.length}
              {countActive(filters, []) ? (
                <>
                  {" · "}
                  <Link href={showArchived ? "/expats/people?archived=1" : "/expats/people"} className="font-medium text-brand-700 hover:underline">
                    Clear filters
                  </Link>
                </>
              ) : null}
            </span>
            <Link href={showArchived ? "/expats/people" : "/expats/people?archived=1"} className="font-medium text-brand-700 hover:underline">
              {showArchived ? "Back to current expats" : `Offboarded (${archived.length})`}
            </Link>
          </div>
        </div>
        <PeopleTable rows={rows} />
      </Card>
    </div>
  );
}
