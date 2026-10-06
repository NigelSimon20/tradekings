import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OffboardForm } from "@/components/expats/record-forms";
import { Alert } from "@/components/ui/alert";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/date/dates";
import { OPEN_ACTION } from "@/lib/expats/types";
import { requireExpatViewer } from "@/lib/services/auth";
import { getExpatProfile } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

/** Offboarding: record the departure and archive the profile — never delete it. */
export default async function OffboardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireExpatViewer("offboardExpats");
  const { id } = await params;
  const profile = await getExpatProfile(user, decodeURIComponent(id));
  if (!profile) notFound();
  const { row } = profile;
  if (row.expat.archived) redirect(`/expats/${encodeURIComponent(row.expat.id)}`);
  const open = row.actions.filter((action) => OPEN_ACTION.includes(action.status));
  const openText = open
    .map((action) => `${action.title}${action.responsibleName ? ` — ${action.responsibleName}` : ""}${action.dueDate ? `, due ${formatDate(action.dueDate)}` : ""}`)
    .join("\n");
  const inUse = [
    ...row.permits.filter((permit) => permit.current && !permit.dependantId && permit.type !== "Passport").map((permit) => permit.type),
    ...row.leases.filter((lease) => lease.status !== "Ended").map(() => "a lease"),
    ...row.vehicles.filter((vehicle) => vehicle.status === "In use").map((vehicle) => `${vehicle.description} ${vehicle.registration}`.trim()),
  ];

  return (
    <div className="space-y-6">
      <Link href={`/expats/${encodeURIComponent(row.expat.id)}`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        {row.expat.fullName}
      </Link>
      <PageHeader
        eyebrow={row.expat.id}
        title={`Offboard ${row.expat.fullName}`}
        description="For an expat leaving the company or the country. The profile is archived with everything on it — nothing is deleted — and can be restored."
      />
      {inUse.length ? (
        <Alert tone="caution" title="Still on record as current">
          {inUse.join(", ")}. Note below what happened to each — the permit closed or cancelled, the home handed back, the vehicle returned.
        </Alert>
      ) : null}
      <OffboardForm expat={row.expat} openActions={openText} />
    </div>
  );
}
