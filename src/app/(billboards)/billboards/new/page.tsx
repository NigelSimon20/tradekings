import Link from "next/link";

import { BillboardForm } from "@/components/billboards/billboard-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireBillboardViewer } from "@/lib/services/auth";
import { loadBillboards } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

export default async function NewBillboardPage() {
  await requireBillboardViewer("editBillboards");
  const { billboards } = await loadBillboards();
  const cities = [...new Set(billboards.map((billboard) => billboard.city).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <Link href="/billboards/list" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        All billboards
      </Link>
      <PageHeader
        eyebrow="Trade Kings"
        title="Add a billboard"
        description="Only the site name and town are required — the rest can be filled in as it is known. Campaigns, maintenance and documents are added on the profile once it is saved."
      />
      <BillboardForm mode="create" defaults={{ status: "Active" }} cities={cities} />
    </div>
  );
}
