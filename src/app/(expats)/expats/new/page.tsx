import Link from "next/link";

import { ExpatForm } from "@/components/expats/record-forms";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { distinct } from "@/lib/expats/filters";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats, seesSensitive } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

export default async function NewExpatPage() {
  const user = await requireExpatViewer("editExpats");
  const { people, archived } = await loadExpats(user);
  const all = [...people, ...archived].map((row) => row.expat);
  return (
    <div className="space-y-6">
      <Link href="/expats/people" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        Expats
      </Link>
      <PageHeader
        eyebrow="Expats"
        title="Add an expat"
        description="Their personal and employment details. Passports, permits, dependants, a lease, vehicles and documents are added on the profile once it is saved."
      />
      <ExpatForm
        mode="create"
        defaults={{ company: "Trade Kings", employmentStatus: "Active" }}
        restricted={!seesSensitive(user)}
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
