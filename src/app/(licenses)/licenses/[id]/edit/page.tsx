import Link from "next/link";
import { notFound } from "next/navigation";

import { LicenseForm } from "@/components/licenses/license-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { licenseFormOptions } from "@/lib/licenses/form-options";
import { requireLicenseViewer } from "@/lib/services/auth";
import { getLicenseProfile, loadLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

export default async function EditLicensePage({ params }: { params: Promise<{ id: string }> }) {
  await requireLicenseViewer("editLicenses");
  const { id } = await params;
  const profile = await getLicenseProfile(decodeURIComponent(id));
  if (!profile) notFound();
  const { assets, licenses } = await loadLicenses();
  // The form takes the stored fields; the calculated ones stay on the license page.
  const { computed: _computed, ...license } = profile.license;
  void _computed;

  return (
    <div className="space-y-6">
      <Link
        href={`/licenses/${encodeURIComponent(license.id)}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        Back to the license
      </Link>
      <PageHeader
        eyebrow={license.id}
        title={`Edit ${license.name}`}
        description="Every change is recorded in the activity log with your name, and the old value is kept there. To renew, use Record a renewal on the license instead."
      />
      <LicenseForm mode="edit" defaults={license} {...licenseFormOptions(assets, licenses)} />
    </div>
  );
}
