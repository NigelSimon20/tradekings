import Link from "next/link";

import { FollowUpForm } from "@/components/expats/record-forms";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { distinct } from "@/lib/expats/filters";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats } from "@/lib/services/expats";

export const dynamic = "force-dynamic";

export default async function NewFollowUpPage() {
  const user = await requireExpatViewer("manageActions");
  const { people, actions } = await loadExpats(user);
  return (
    <div className="space-y-6">
      <Link href="/expats/actions" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        Follow-ups
      </Link>
      <PageHeader eyebrow="Follow-ups" title="Add a follow-up" description="Give it to someone with a due date; it shows on the expat's profile." />
      <FollowUpForm
        mode="create"
        defaults={{}}
        expats={people.map((row) => ({ value: row.expat.id, label: `${row.expat.fullName} — ${row.expat.position}` }))}
        returnTo="/expats/actions"
        people={distinct([...actions.map((action) => action.responsibleName), ...people.map((row) => row.expat.managerName)])}
      />
    </div>
  );
}
