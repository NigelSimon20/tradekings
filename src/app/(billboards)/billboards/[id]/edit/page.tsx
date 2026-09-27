import Link from "next/link";
import { notFound } from "next/navigation";

import { BillboardForm } from "@/components/billboards/billboard-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireBillboardViewer } from "@/lib/services/auth";
import { getBillboardProfile, loadBillboards } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

export default async function EditBillboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBillboardViewer("editBillboards");
  const { id } = await params;
  const profile = await getBillboardProfile(decodeURIComponent(id));
  if (!profile) notFound();

  const { billboards } = await loadBillboards();
  const cities = [...new Set(billboards.map((billboard) => billboard.city).filter(Boolean))].sort();
  // The form takes the stored fields; the calculated ones stay on the profile.
  const { computed: _computed, ...billboard } = profile.billboard;
  void _computed;

  return (
    <div className="space-y-6">
      <Link
        href={`/billboards/${encodeURIComponent(billboard.id)}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        Back to the profile
      </Link>
      <PageHeader
        eyebrow={billboard.id}
        title={`Edit ${billboard.name}`}
        description="Every change is recorded in the activity log with your name, and the old value is kept there."
      />
      <BillboardForm mode="edit" defaults={billboard} cities={cities} />
    </div>
  );
}
