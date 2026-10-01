import Link from "next/link";

import { AssetMap, type MapPoint } from "@/components/licenses/asset-map";
import { LicenseTable } from "@/components/licenses/license-table";
import { ViewSwitch } from "@/components/licenses/view-switch";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon, PlusIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { canLicenses } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { formatDate, formatTimestamp } from "@/lib/date/dates";
import type { PageSearchParams } from "@/lib/domain/filters";
import { sortLicensesByUrgency } from "@/lib/licenses/filters";
import { LOCATION_ASSET_TYPES } from "@/lib/licenses/types";
import { LICENSE_VIEWS, getLicenseView } from "@/lib/licenses/views";
import { requireLicenseViewer } from "@/lib/services/auth";
import { loadLicenses, recentLicenseActivity } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

/** The License Tracker's front door: the compliance position at a glance, and where. */
export default async function LicenseDashboardPage({ searchParams }: PageSearchParams) {
  const user = await requireLicenseViewer("viewLicenses");
  const denied = (await searchParams).denied === "1";
  const config = getConfig();
  const [{ licenses, assets, rules, today, source }, activity] = await Promise.all([
    loadLicenses(),
    recentLicenseActivity(8),
  ]);
  const mayEdit = canLicenses(user, "editLicenses");

  const count = (id: string) => licenses.filter(getLicenseView(id)!.matches).length;
  const action = sortLicensesByUrgency(licenses.filter((license) => license.computed.needsAction));
  const upcoming = licenses
    .filter(getLicenseView("upcoming")!.matches)
    .sort((a, b) => (a.computed.daysRemaining ?? 0) - (b.computed.daysRemaining ?? 0));

  const points: MapPoint[] = assets
    .filter((summary) => summary.hasLocation && LOCATION_ASSET_TYPES.includes(summary.asset.type))
    .map(({ asset, licenses: own, worstStatus, needsAction }) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      city: asset.city,
      latitude: asset.latitude!,
      longitude: asset.longitude!,
      worstStatus,
      needsAction,
      licenses: sortLicensesByUrgency(own).map((license) => ({
        id: license.id,
        name: license.name,
        status: license.computed.status,
        expiryDate: license.expiryDate,
      })),
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trade Kings · ZimKings"
        title="License & compliance"
        description={`Every license, permit and certificate as at ${formatDate(today)}. Reminders at ${rules.reminderDays.join(", ")} days before expiry.`}
        actions={
          <>
            <ViewSwitch current="map" />
            {mayEdit ? (
              <ButtonLink href="/licenses/new" className="lg:hidden">
                <PlusIcon />
                Add license
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {denied ? (
        <Alert tone="warning" title="That page is not available to your account">
          You were brought back here because your License Tracker access does not include what you opened.
        </Alert>
      ) : null}
      {source.kind === "local" ? (
        <Alert tone="caution" title="You are looking at practice data" icon={<AlertIcon className="size-4" />}>
          The license spreadsheet is not connected yet, so the tracker is showing a sample register.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {LICENSE_VIEWS.map((view) => (
          <StatCard
            key={view.id}
            label={view.label}
            value={count(view.id)}
            description={view.description}
            tone={view.tone}
            href={`/licenses/register?view=${view.id}`}
          />
        ))}
      </div>

      <AssetMap points={points} />

      <div className="grid gap-5 2xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={<AlertIcon className="size-4" />}
            title="Requiring action"
            description="Overdue, due a reminder, missing an expiry date or linked to a missing asset."
            action={
              <ButtonLink href="/licenses/register?view=action" variant="secondary" size="sm">
                View all {action.length}
              </ButtonLink>
            }
          />
          <LicenseTable
            licenses={action.slice(0, 8)}
            emptyTitle="Nothing needs action"
            emptyDescription="Every license is current, or its renewal is under way."
          />
        </Card>
        <Card>
          <CardHeader
            icon={<ShieldCheckIcon className="size-4" />}
            title="Upcoming renewals"
            description="Due in the next 90 days, soonest first."
            action={
              <ButtonLink href="/licenses/register?view=upcoming" variant="secondary" size="sm">
                View all {upcoming.length}
              </ButtonLink>
            }
          />
          <LicenseTable
            licenses={upcoming.slice(0, 8)}
            emptyTitle="No renewals due in the next 90 days"
            emptyDescription="Nothing to renew for now."
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent changes" description="Who changed what, and when. Every change is kept in the Activity Log tab." />
        <CardBody className="p-0">
          {activity.length ? (
            <ul className="divide-y divide-slate-100">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{entry.action}</span>{" "}
                      {entry.recordId ? (
                        <Link
                          href={
                            entry.recordType === "Asset"
                              ? `/licenses/assets/${encodeURIComponent(entry.recordId)}`
                              : `/licenses/${encodeURIComponent(entry.recordId)}`
                          }
                          className="text-brand-700 hover:underline"
                        >
                          {entry.recordId}
                        </Link>
                      ) : null}
                    </p>
                    {entry.details ? <p className="line-clamp-2 text-xs text-slate-500">{entry.details}</p> : null}
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {formatTimestamp(entry.at, config.timezone)} · {entry.by || "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No changes recorded yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
