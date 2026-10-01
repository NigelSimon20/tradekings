import Link from "next/link";

import { LicenseStatusBadge } from "@/components/licenses/badges";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { BuildingIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { LinkRow, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { canLicenses } from "@/lib/auth/roles";
import type { PageSearchParams } from "@/lib/domain/filters";
import { assetGroupOf } from "@/lib/licenses/meta";
import { ASSET_TYPE_GROUPS, ASSET_TYPES, type AssetGroup } from "@/lib/licenses/types";
import { requireLicenseViewer } from "@/lib/services/auth";
import { loadLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

/** Every warehouse, site, vehicle, piece of equipment and the company itself, with its licenses. */
export default async function AssetsPage({ searchParams }: PageSearchParams) {
  const user = await requireLicenseViewer("viewLicenses");
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const type = String(params.type ?? "");
  const showArchived = params.archived === "1";

  const { assets, archivedAssets, licenses } = await loadLicenses();
  const rows = (showArchived
    ? archivedAssets.map((asset) => ({ asset, licenses: [], worstStatus: null, needsAction: 0, hasLocation: false }))
    : assets
  ).filter(({ asset }) => {
    if (type && asset.type !== type) return false;
    if (!q) return true;
    return [asset.id, asset.name, asset.registration, asset.city, asset.address, asset.department]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const groups = (Object.keys(ASSET_TYPE_GROUPS) as AssetGroup[])
    .map((group) => ({ group, items: rows.filter(({ asset }) => (assetGroupOf(asset.type) ?? "Equipment & Other Assets") === group) }))
    .filter(({ items }) => items.length);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="License Tracker"
        title={showArchived ? "Archived assets" : "Assets & locations"}
        description={`${assets.length} assets holding ${licenses.length} licenses. Open one to see all of its licenses.`}
        actions={
          canLicenses(user, "manageAssets") ? (
            <ButtonLink href="/licenses/assets/new">
              <PlusIcon />
              Add asset
            </ButtonLink>
          ) : null
        }
      />

      <form action="/licenses/assets" className="flex flex-wrap items-center gap-2">
        {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Search</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input type="search" name="q" defaultValue={q} placeholder="Name, registration, town…" className="pl-9" />
        </label>
        <span className="w-full sm:w-56">
          <Select
            name="type"
            aria-label="Asset type"
            defaultValue={type}
            placeholder="Any asset type"
            options={ASSET_TYPES.map((value) => ({ value, label: value }))}
          />
        </span>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        <Link
          href={showArchived ? "/licenses/assets" : "/licenses/assets?archived=1"}
          className="ml-auto text-xs font-medium text-brand-700 hover:underline"
        >
          {showArchived ? "Back to assets in use" : `Archived (${archivedAssets.length})`}
        </Link>
      </form>

      {groups.length ? (
        groups.map(({ group, items }) => (
          <Card key={group}>
            <CardHeader icon={<BuildingIcon className="size-4" />} title={group} action={<Badge tone="neutral">{items.length}</Badge>} />
            <TableWrap>
              <Table>
                <THead>
                  <Tr className="hover:bg-transparent">
                    <Th>Asset</Th>
                    <Th className="hidden md:table-cell">Location / registration</Th>
                    <Th className="text-right">Licenses</Th>
                    <Th>Most urgent</Th>
                    <Th className="hidden lg:table-cell text-right">Needs action</Th>
                  </Tr>
                </THead>
                <TBody>
                  {items.map(({ asset, licenses: own, worstStatus, needsAction }) => {
                    const href = `/licenses/assets/${encodeURIComponent(asset.id)}`;
                    return (
                      <LinkRow key={asset.id} href={href} className="cursor-pointer">
                        <Td>
                          <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                            {asset.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {asset.id} · {asset.type}
                          </p>
                        </Td>
                        <Td className="hidden md:table-cell">
                          {[asset.registration, asset.city].filter(Boolean).join(" · ") || "—"}
                        </Td>
                        <Td className="numeric text-right">{own.length}</Td>
                        <Td>{worstStatus ? <LicenseStatusBadge status={worstStatus} /> : <span className="text-slate-400">None yet</span>}</Td>
                        <Td className="hidden lg:table-cell text-right">
                          {needsAction ? <Badge tone="danger">{needsAction}</Badge> : <span className="text-slate-400">—</span>}
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
          <EmptyState icon={<BuildingIcon className="size-5" />} title="No assets match" description="Try clearing the search." />
        </Card>
      )}
    </div>
  );
}
