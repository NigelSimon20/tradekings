import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpatForm } from "@/components/expats/record-forms";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { distinct } from "@/lib/expats/filters";
import { requireExpatViewer } from "@/lib/services/auth";
import { getExpatProfile } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

export default async function EditExpatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireExpatViewer("editExpats");
  const { id } = await params;
  const profile = await getExpatProfile(user, decodeURIComponent(id));
  if (!profile) notFound();
  const { row, snapshot } = profile;
  const all = [...snapshot.people, ...snapshot.archived].map((entry) => entry.expat);

  return (
    <div className="space-y-6">
      <Link href={`/expats/${encodeURIComponent(row.expat.id)}`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        Back to the profile
      </Link>
      <PageHeader
        eyebrow={row.expat.id}
        title={`Edit ${row.expat.fullName}`}
        description="Every change is recorded in the profile's activity history with your name."
      />
      <ExpatForm
        mode="edit"
        defaults={row.expat}
        restricted={snapshot.restricted}
        suggestions={{
          nationalities: distinct(all.map((expat) => expat.nationality)),
          departments: distinct(all.map((expat) => expat.department)),
          positions: distinct(all.map((expat) => expat.position)),
          managers: distinct(all.map((expat) => expat.managerName)),
        }}
      />
    </div>
  );
}
