import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ExternalLink } from "@/components/billboards/external-link";
import { LicenseStatusBadge } from "@/components/licenses/badges";
import { DocumentList } from "@/components/licenses/document-list";
import { ArchiveButton } from "@/components/licenses/license-controls";
import { LicenseTable } from "@/components/licenses/license-table";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { ArrowLeftIcon, BuildingIcon, PlusIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { canLicenses } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { formatTimestamp } from "@/lib/date/dates";
import { getPhotoStore } from "@/lib/files";
import { sortLicensesByUrgency } from "@/lib/licenses/filters";
import { requireLicenseViewer } from "@/lib/services/auth";
import { getAssetProfile } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

const blank = (value: string | null | undefined): ReactNode => (value ? value : <span className="text-slate-400">—</span>);

/** One asset and every license linked to it — "view all licenses linked to a specific asset". */
export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireLicenseViewer("viewLicenses");
  const { id } = await params;
  const profile = await getAssetProfile(decodeURIComponent(id));
  if (!profile) notFound();

  const { asset, licenses, worstStatus, needsAction, documents, activity, archivedLicenses } = profile;
  const config = getConfig();
  const mayManage = canLicenses(user, "manageAssets");
  const mayEdit = canLicenses(user, "editLicenses");
  const uploadsOn = (await getPhotoStore("licenses")).kind !== "none";
  const mapLink =
    asset.latitude !== null && asset.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${asset.latitude},${asset.longitude}`
      : "";

  return (
    <div className="space-y-6">
      <Link href="/licenses/assets" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        Assets & locations
      </Link>

      <PageHeader
        eyebrow={`${asset.id} · ${asset.type}`}
        title={asset.name}
        description={[asset.registration, asset.address || asset.city].filter(Boolean).join(" · ")}
        actions={
          <>
            {mayManage ? (
              <ButtonLink href={`/licenses/assets/${encodeURIComponent(asset.id)}/edit`} variant="secondary">
                Edit asset
              </ButtonLink>
            ) : null}
            {mayEdit && !asset.archived ? (
              <ButtonLink href={`/licenses/new?asset=${encodeURIComponent(asset.id)}`}>
                <PlusIcon />
                Add license
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {asset.archived ? (
        <Alert tone="neutral" title="This asset is archived">
          It is hidden from the map and lists. Its licenses and history are kept.
          {mayManage ? (
            <div className="mt-3">
              <ArchiveButton kind="asset" recordId={asset.id} archived />
            </div>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader
            icon={<BuildingIcon className="size-4" />}
            title="Asset"
            action={worstStatus ? <LicenseStatusBadge status={worstStatus} /> : null}
          />
          <CardBody>
            <DefinitionList
              columns={2}
              items={[
                { label: "Type", value: asset.type },
                { label: "Company", value: blank(asset.company) },
                { label: "Department", value: blank(asset.department) },
                { label: "Registration / fleet no", value: blank(asset.registration) },
                { label: "City / town", value: blank(asset.city) },
                {
                  label: "GPS",
                  value: mapLink ? (
                    <ExternalLink href={mapLink}>
                      {asset.latitude}, {asset.longitude}
                    </ExternalLink>
                  ) : (
                    <span className="text-slate-400">Not recorded</span>
                  ),
                },
                {
                  label: "Responsible",
                  value: asset.responsibleEmail ? (
                    <a href={`mailto:${asset.responsibleEmail}`} className="text-brand-700 hover:underline">
                      {asset.responsibleName || asset.responsibleEmail}
                    </a>
                  ) : (
                    blank(asset.responsibleName)
                  ),
                },
                { label: "Needs action", value: needsAction ? `${needsAction} license(s)` : "Nothing" },
                { label: "Notes", value: blank(asset.notes) },
                {
                  label: "Last updated",
                  value: `${formatTimestamp(asset.lastUpdated, config.timezone)}${asset.lastUpdatedBy ? ` by ${asset.lastUpdatedBy}` : ""}`,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ShieldCheckIcon className="size-4" />}
            title="Licenses"
            description="Everything held for this asset, most urgent first."
          />
          <LicenseTable
            licenses={sortLicensesByUrgency(licenses)}
            showAsset={false}
            emptyTitle="No licenses recorded yet"
            emptyDescription={mayEdit ? "Use Add license to record one." : "None have been recorded for this asset."}
          />
          {archivedLicenses.length ? (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {archivedLicenses.length} archived license(s) —{" "}
              <Link href="/licenses/register?archived=1" className="text-brand-700 hover:underline">
                see archived licenses
              </Link>
            </p>
          ) : null}
        </Card>
      </div>

      <DocumentList
        documents={documents}
        target={{ licenseId: "", assetId: asset.id }}
        mayAdd={mayEdit && !asset.archived}
        mayRemove={canLicenses(user, "removeLicenseDocuments")}
        uploadsOn={uploadsOn}
        defaultCategory="Photo"
      />

      <Card>
        <CardHeader title="Activity" description="Every change to this asset: who, when and what." />
        <CardBody className="p-0">
          {activity.length ? (
            <ul className="divide-y divide-slate-100">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                    {entry.details ? <p className="text-xs break-words text-slate-500">{entry.details}</p> : null}
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {formatTimestamp(entry.at, config.timezone)} · {entry.by || "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No changes recorded since this asset was added.</p>
          )}
        </CardBody>
      </Card>

      {mayManage && !asset.archived ? (
        <div className="flex justify-end">
          <ArchiveButton kind="asset" recordId={asset.id} archived={false} />
        </div>
      ) : null}
    </div>
  );
}
