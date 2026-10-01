import Link from "next/link";

import { LicenseTable } from "@/components/licenses/license-table";
import { ViewSwitch } from "@/components/licenses/view-switch";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { DownloadIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { canLicenses } from "@/lib/auth/roles";
import type { PageSearchParams } from "@/lib/domain/filters";
import {
  STATUS_FILTER_OPTIONS,
  countActiveLicenseFilters,
  distinct,
  filterLicenses,
  parseLicenseFilters,
  sortLicensesByUrgency,
} from "@/lib/licenses/filters";
import { ASSET_TYPES, DEFAULT_LICENSE_CATEGORIES } from "@/lib/licenses/types";
import { LICENSE_VIEWS, getLicenseView } from "@/lib/licenses/views";
import { requireLicenseViewer } from "@/lib/services/auth";
import { loadLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

/** The License Register: the whole database, searchable and filterable. Filters live in the URL. */
export default async function LicenseRegisterPage({ searchParams }: PageSearchParams) {
  const user = await requireLicenseViewer("viewLicenses");
  const params = await searchParams;
  const filters = parseLicenseFilters(params);
  const showArchived = params.archived === "1";

  const { licenses, archivedLicenses, assets } = await loadLicenses();
  const source = showArchived ? archivedLicenses : licenses;
  const rows = sortLicensesByUrgency(filterLicenses(source, filters));
  const view = filters.view ? getLicenseView(filters.view) : undefined;
  const asset = filters.asset ? assets.find((summary) => summary.asset.id === filters.asset)?.asset : undefined;

  const locations = distinct(assets.map((summary) => summary.asset.city));
  const types = distinct(licenses.map((license) => license.type));
  const departments = distinct(licenses.map((license) => license.department));
  const categories = distinct([...DEFAULT_LICENSE_CATEGORIES, ...licenses.map((license) => license.category)]);
  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value) as [string, string][],
  ).toString();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="License register"
        title={showArchived ? "Archived licenses" : asset ? `Licenses for ${asset.name}` : (view?.label ?? "All licenses")}
        description={
          showArchived
            ? "Licenses taken off the register. Their history is kept and they can be restored."
            : (view?.description ?? "Every license, permit and certificate, most urgent first.")
        }
        actions={
          <>
            <ViewSwitch current="register" />
            {canLicenses(user, "exportLicenses") ? (
              <a href={`/api/licenses/export${exportQuery ? `?${exportQuery}` : ""}`} className={buttonClasses("secondary")}>
                <DownloadIcon className="size-4" />
                Export
              </a>
            ) : null}
            {canLicenses(user, "editLicenses") ? (
              <ButtonLink href="/licenses/new">
                <PlusIcon />
                Add license
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <form
            action="/licenses/register"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[minmax(14rem,1.6fr)_repeat(7,minmax(0,1fr))_auto]"
          >
            {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
            {filters.asset ? <input type="hidden" name="asset" value={filters.asset} /> : null}
            <label className="relative block sm:col-span-2 lg:col-span-4 2xl:col-span-1">
              <span className="sr-only">Search</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                name="q"
                defaultValue={filters.q}
                placeholder="License number, registration, site, type…"
                className="pl-9"
              />
            </label>
            <Select
              name="view"
              aria-label="Dashboard view"
              defaultValue={filters.view}
              placeholder="All licenses"
              options={LICENSE_VIEWS.map((option) => ({ value: option.id, label: option.label }))}
            />
            <Select name="status" aria-label="Expiry status" defaultValue={filters.status} placeholder="Any status" options={STATUS_FILTER_OPTIONS} />
            <Select name="location" aria-label="Location" defaultValue={filters.location} placeholder="Any location" options={options(locations)} />
            <Select name="assetType" aria-label="Asset type" defaultValue={filters.assetType} placeholder="Any asset type" options={options(ASSET_TYPES)} />
            <Select name="category" aria-label="Category" defaultValue={filters.category} placeholder="Any category" options={options(categories)} />
            <Select name="type" aria-label="License type" defaultValue={filters.type} placeholder="Any license type" options={options(types)} />
            <Select name="department" aria-label="Department" defaultValue={filters.department} placeholder="Any department" options={options(departments)} />
            <Button type="submit" className="sm:col-span-2 lg:col-span-1">
              Apply
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing {rows.length} of {source.length}
              {countActiveLicenseFilters(filters) ? (
                <>
                  {" · "}
                  <Link
                    href={showArchived ? "/licenses/register?archived=1" : "/licenses/register"}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Clear filters
                  </Link>
                </>
              ) : null}
            </span>
            <Link
              href={showArchived ? "/licenses/register" : "/licenses/register?archived=1"}
              className="font-medium text-brand-700 hover:underline"
            >
              {showArchived ? "Back to the register" : `Archived (${archivedLicenses.length})`}
            </Link>
          </div>
        </div>
        <LicenseTable licenses={rows} />
      </Card>
    </div>
  );
}
