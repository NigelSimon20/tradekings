import Link from "next/link";

import { LicenseForm } from "@/components/licenses/license-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import type { PageSearchParams } from "@/lib/domain/filters";
import { licenseFormOptions } from "@/lib/licenses/form-options";
import { assetGroupOf } from "@/lib/licenses/meta";
import { requireLicenseViewer } from "@/lib/services/auth";
import { loadLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

export default async function NewLicensePage({ searchParams }: PageSearchParams) {
  await requireLicenseViewer("editLicenses");
  const assetId = String((await searchParams).asset ?? "");
  const { assets, licenses } = await loadLicenses();
  const asset = assets.find((summary) => summary.asset.id === assetId)?.asset;

  return (
    <div className="space-y-6">
      <Link
        href={asset ? `/licenses/assets/${encodeURIComponent(asset.id)}` : "/licenses/register"}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        {asset ? asset.name : "License register"}
      </Link>
      <PageHeader
        eyebrow="License register"
        title="Add a license"
        description="Only the name, category and type are required. Documents and renewals are added on the license once it is saved."
      />
      <LicenseForm
        mode="create"
        defaults={{
          assetId: asset?.id ?? "",
          category: asset ? (assetGroupOf(asset.type) ?? "") : "",
          department: asset?.department ?? "",
          responsibleName: asset?.responsibleName ?? "",
          responsibleEmail: asset?.responsibleEmail ?? "",
          renewalFrequency: "Annual",
          renewalStatus: "Not started",
        }}
        {...licenseFormOptions(assets, licenses)}
      />
    </div>
  );
}
