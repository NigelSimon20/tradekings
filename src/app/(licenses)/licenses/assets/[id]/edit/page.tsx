import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetForm } from "@/components/licenses/asset-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { distinct } from "@/lib/licenses/filters";
import { requireLicenseViewer } from "@/lib/services/auth";
import { getAssetProfile, loadLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireLicenseViewer("manageAssets");
  const { id } = await params;
  const profile = await getAssetProfile(decodeURIComponent(id));
  if (!profile) notFound();
  const { assets } = await loadLicenses();
  const { asset } = profile;

  return (
    <div className="space-y-6">
      <Link
        href={`/licenses/assets/${encodeURIComponent(asset.id)}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        Back to the asset
      </Link>
      <PageHeader
        eyebrow={asset.id}
        title={`Edit ${asset.name}`}
        description="Every change is recorded in the activity log with your name, and the old value is kept there."
      />
      <AssetForm
        mode="edit"
        defaults={asset}
        cities={distinct(assets.map((summary) => summary.asset.city))}
        departments={distinct(assets.map((summary) => summary.asset.department))}
      />
    </div>
  );
}
