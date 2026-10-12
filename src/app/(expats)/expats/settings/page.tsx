import { disconnectExpatDriveAction, setUpExpatSheetAction } from "@/app/(expats)/expats/actions";
import { ReminderSettingsForm, SendRemindersButton } from "@/components/expats/controls";
import { RolesCard, SheetCard, SignInCard, StorageCard } from "@/components/settings/setup-cards";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BellIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { EXPAT_PERMISSION_INFO } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { EXPAT_ROLES_TAB } from "@/lib/data/sheet-schema";
import { formatDate } from "@/lib/date/dates";
import type { PageSearchParams } from "@/lib/domain/filters";
import { getMailer } from "@/lib/email/mailer";
import { EXPAT_STORE } from "@/lib/expats/data/sheet-tables";
import { getRoleTable, requireExpatViewer } from "@/lib/services/auth";
import { checkExpatSource, checkExpatStorage, getExpatRules, runExpatReminders } from "@/lib/services/expats";
import { loadUsersEditor } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** The expat spreadsheet, reminder emails, document storage and who can use the tracker — for its administrators. */
export default async function ExpatSettingsPage({ searchParams }: PageSearchParams) {
  const user = await requireExpatViewer("manageExpats");
  const config = getConfig();
  const [params, health, storage, rules, preview, people, roleTable] = await Promise.all([
    searchParams,
    checkExpatSource(),
    checkExpatStorage(),
    getExpatRules(),
    runExpatReminders({ appUrl: config.appUrl, actor: user.email, dryRun: true }).catch(() => null),
    loadUsersEditor(),
    getRoleTable(),
  ]);
  const mailer = getMailer();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Expat Tracker" title="Setup & access" description="The expat spreadsheet, reminder emails, document storage and access." />
      <SheetCard store={EXPAT_STORE} health={health} setUp={setUpExpatSheetAction} />

      <Card>
        <CardHeader
          icon={<BellIcon className="size-4" />}
          title="Reminder emails"
          description={`Sent every morning for anything reaching ${rules.reminderDays.join(", ")} days before expiry, and once more when it expires. Each item is emailed once per window.`}
          action={<Badge tone={mailer.kind === "outbox" ? "warning" : "success"}>{mailer.label}</Badge>}
        />
        <CardBody className="space-y-6">
          <ReminderSettingsForm days={rules.reminderDays} recipients={rules.recipients} />
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <p className="text-sm font-medium text-slate-900">Due now</p>
            {preview?.preview.length ? (
              <ul className="space-y-3 text-sm">
                {preview.preview.map((entry) => (
                  <li key={entry.recipient} className="rounded-xl p-3 ring-1 ring-slate-200/70">
                    <p className="font-medium text-slate-900">
                      {entry.recipient}{" "}
                      <span className="font-normal text-slate-500">
                        — {entry.items.length} item{entry.items.length === 1 ? "" : "s"}
                      </span>
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {entry.items.slice(0, 6).map((item) => (
                        <li key={`${item.kind}-${item.person}-${item.when}`}>
                          {item.kind} — {item.person} · {item.status} {formatDate(item.when)}
                        </li>
                      ))}
                      {entry.items.length > 6 ? <li>and {entry.items.length - 6} more</li> : null}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                {preview ? "Nothing is due — every reminder has already gone out." : "The reminders could not be worked out just now."}
              </p>
            )}
            {!rules.recipients.length ? (
              <p className="text-xs text-slate-500">
                No HR recipients are set, so reminders go to each expat&rsquo;s responsible manager only.
              </p>
            ) : null}
            {health.kind === "google-sheets" ? (
              <SendRemindersButton due={preview?.due ?? 0} />
            ) : (
              <p className="text-xs text-slate-500">
                On sample data nothing is emailed — the people are made up. Reminders start once the live expat sheet is
                connected.
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <StorageCard
        app="expats"
        title="Document uploads"
        storage={storage}
        filing="Trade Kings Expats / EXP-001 – Name / (a folder per dependant)"
        disconnect={disconnectExpatDriveAction}
        searchParams={params}
      />
      <RolesCard
        appName="Expat Tracker"
        tab={EXPAT_ROLES_TAB}
        roles={roleTable.expats}
        catalogue={EXPAT_PERMISSION_INFO}
        note="Without “See sensitive details”, passport and permit numbers, dates of birth, personal contacts, addresses, rent and documents are hidden."
      />
      <SignInCard people={people} />
    </div>
  );
}
