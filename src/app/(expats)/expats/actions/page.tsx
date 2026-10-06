import Link from "next/link";

import { FollowUpList } from "@/components/expats/follow-up-list";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { DownloadIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { canExpats } from "@/lib/auth/roles";
import type { PageSearchParams } from "@/lib/domain/filters";
import { distinct, filterActions, parseActionFilters } from "@/lib/expats/filters";
import { ACTION_VIEWS, findView } from "@/lib/expats/views";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

/** Follow-up actions across every expat: permit follow-ups, document requests, lease renewals. */
export default async function FollowUpsPage({ searchParams }: PageSearchParams) {
  const user = await requireExpatViewer("viewExpats");
  const filters = parseActionFilters(await searchParams);
  const { actions, people, today } = await loadExpats(user);
  const names = new Map(people.map((row) => [row.expat.id, row.expat.fullName]));
  const nameOf = (id: string) => names.get(id) ?? id;
  const rows = filterActions(actions, filters, today, nameOf);
  const view = findView(ACTION_VIEWS, filters.view || "open")!;
  const mayManage = canExpats(user, "manageActions");
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Follow-ups"
        title={`${view.label} follow-ups`}
        description="Who has to do what, and by when. Overdue ones make the profile Action required."
        actions={
          <>
            {canExpats(user, "exportExpats") ? (
              <a href={`/api/expats/export?list=actions${query ? `&${query}` : ""}`} className={buttonClasses("secondary")}>
                <DownloadIcon className="size-4" />
                Export to Excel
              </a>
            ) : null}
            {mayManage ? (
              <ButtonLink href="/expats/actions/new">
                <PlusIcon />
                Add follow-up
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <Card>
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <form action="/expats/actions" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
            <label className="relative block sm:col-span-2 lg:col-span-1">
              <span className="sr-only">Search</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input type="search" name="q" defaultValue={filters.q} placeholder="Action, notes, person…" className="pl-9" />
            </label>
            <Select name="view" aria-label="Status" defaultValue={filters.view || "open"} options={ACTION_VIEWS.map((option) => ({ value: option.id, label: option.label }))} />
            <Select name="expat" aria-label="Expat" defaultValue={filters.expat} placeholder="Every expat" options={people.map((row) => ({ value: row.expat.id, label: row.expat.fullName }))} />
            <Select
              name="responsible"
              aria-label="Responsible person"
              defaultValue={filters.responsible}
              placeholder="Anyone responsible"
              options={distinct(actions.map((action) => action.responsibleName || action.responsibleEmail)).map((value) => ({ value, label: value }))}
            />
            <Button type="submit">Apply</Button>
          </form>
          <div className="text-xs text-slate-500">
            Showing {rows.length} of {actions.length}
            {filters.q || filters.expat || filters.responsible ? (
              <>
                {" · "}
                <Link href={`/expats/actions?view=${view.id}`} className="font-medium text-brand-700 hover:underline">
                  Clear filters
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <FollowUpList actions={rows} today={today} nameOf={nameOf} mayManage={mayManage} returnTo={`/expats/actions${query ? `?${query}` : ""}`} />
      </Card>
    </div>
  );
}
