import Link from "next/link";
import { notFound } from "next/navigation";

import { RECORD_KINDS, RecordEditor, findRecord, isRecordKind } from "@/components/expats/record-editor";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { distinct } from "@/lib/expats/filters";
import { requireExpatViewer } from "@/lib/services/auth";
import { getExpatProfile } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

/** Edits one of a profile's records; the change is logged with the old and new values. */
export default async function EditRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; kind: string; recordId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, kind, recordId } = await params;
  if (!isRecordKind(kind)) notFound();
  const user = await requireExpatViewer(RECORD_KINDS[kind].permission);
  const profile = await getExpatProfile(user, decodeURIComponent(id));
  if (!profile) notFound();
  const { row, snapshot } = profile;
  const record = findRecord(row, kind, decodeURIComponent(recordId));
  if (!record) notFound();
  const requested = (await searchParams).returnTo;
  const returnTo = typeof requested === "string" && requested.startsWith("/expats") ? requested : undefined;

  return (
    <div className="space-y-6">
      <Link
        href={returnTo ?? `/expats/${encodeURIComponent(row.expat.id)}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        {returnTo ? "Back" : row.expat.fullName}
      </Link>
      <PageHeader
        eyebrow={`${row.expat.fullName} · ${record.id}`}
        title={`Edit ${RECORD_KINDS[kind].title}`}
        description="Every change is recorded in the profile's activity history with your name."
      />
      <RecordEditor
        row={row}
        kind={kind}
        record={record}
        restricted={snapshot.restricted}
        query={{}}
        people={distinct(snapshot.actions.map((action) => action.responsibleName))}
        returnTo={returnTo}
      />
    </div>
  );
}
