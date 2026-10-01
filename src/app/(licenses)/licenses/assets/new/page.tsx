import Link from "next/link";

import { AssetForm } from "@/components/licenses/asset-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { distinct } from "@/lib/licenses/filters";
import { requireLicenseViewer } from "@/lib/services/auth";
import { loadLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  await requireLicenseViewer("manageAssets");
  const { assets } = await loadLicenses();

  return (
    <div className="space-y-6">
      <Link href="/licenses/assets" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        Assets & locations
      </Link>
      <PageHeader
        eyebrow="Assets & locations"
        title="Add an asset"
        description="A warehouse, factory, depot, site, vehicle, piece of equipment or the company itself. Licenses are added against it once it is saved."
      />
      <AssetForm
        mode="create"
        defaults={{ type: "Warehouse", company: "Trade Kings" }}
        cities={distinct(assets.map(({ asset }) => asset.city))}
        departments={distinct(assets.map(({ asset }) => asset.department))}
      />
    </div>
  );
}
