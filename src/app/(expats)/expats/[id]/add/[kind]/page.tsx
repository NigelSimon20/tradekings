import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RECORD_KINDS, RecordEditor, isRecordKind } from "@/components/expats/record-editor";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { distinct } from "@/lib/expats/filters";
import { requireExpatViewer } from "@/lib/services/auth";
import { getExpatProfile } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

/** Adds a dependant, passport / permit / application, lease, vehicle or follow-up to a profile. */
export default async function AddRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, kind } = await params;
  if (!isRecordKind(kind)) notFound();
  const user = await requireExpatViewer(RECORD_KINDS[kind].permission);
  const profile = await getExpatProfile(user, decodeURIComponent(id));
  if (!profile) notFound();
  const { row, snapshot } = profile;
  if (row.expat.archived) redirect(`/expats/${encodeURIComponent(row.expat.id)}`);
  const query = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [key, (Array.isArray(value) ? value[0] : value) ?? ""]),
  );
  const renewing = kind === "permit" && query.renews;

  return (
    <div className="space-y-6">
      <Link href={`/expats/${encodeURIComponent(row.expat.id)}`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        {row.expat.fullName}
      </Link>
      <PageHeader
        eyebrow={row.expat.fullName}
        title={renewing ? "Start a renewal" : `Add a ${RECORD_KINDS[kind].title}`}
        description={
          renewing
            ? "A renewal is its own record: track it through the application steps. When it is issued, the one it renews moves to history."
            : undefined
        }
      />
      <RecordEditor
        row={row}
        kind={kind}
        record={null}
        restricted={snapshot.restricted}
        query={query}
        people={distinct(snapshot.actions.map((action) => action.responsibleName))}
      />
    </div>
  );
}
