import {
  DisconnectExpatDriveButton,
  ReminderSettingsForm,
  SendRemindersButton,
  SetUpExpatSheetButton,
} from "@/components/expats/controls";
import { UsersEditor } from "@/components/settings/users-editor";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BellIcon, SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { RoleMatrix } from "@/components/ui/role-matrix";
import { EXPAT_PERMISSION_INFO } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { formatDate, formatTimestamp } from "@/lib/date/dates";
import type { PageSearchParams } from "@/lib/domain/filters";
import { EXPAT_TABLES } from "@/lib/expats/data/sheet-tables";
import { getRoleTable, requireExpatViewer } from "@/lib/services/auth";
import { checkExpatSource, checkExpatStorage, getExpatRules, runExpatReminders } from "@/lib/services/expats";
import { getMailer } from "@/lib/email/mailer";
import { loadUsersEditor } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** The expat spreadsheet, reminder emails, document storage and who can use the tracker — for its administrators. */
export default async function ExpatSettingsPage({ searchParams }: PageSearchParams) {
  const user = await requireExpatViewer("manageExpats");
  const params = await searchParams;
  const driveConnected = params.drive === "connected";
  const driveError = typeof params["drive-error"] === "string" ? params["drive-error"] : "";
  const config = getConfig();

  const [health, storage, rules, preview, people, roleTable] = await Promise.all([
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

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Expat spreadsheet"
          description={health.detail}
          action={<Badge tone={health.ok ? "success" : "warning"}>{health.label}</Badge>}
        />
        <CardBody className="space-y-4">
          {health.warnings.map((warning) => (
            <Alert key={warning} tone="caution">
              {warning}
            </Alert>
          ))}
          {health.kind === "google-sheets" ? (
            <>
              <p className="text-sm text-slate-600">
                Creates any missing tab ({Object.values(EXPAT_TABLES).map((table) => table.tab).join(", ")}), adds missing
                headings, dropdowns and date formats. Safe to press again — it never changes a value someone has typed.
              </p>
              <SetUpExpatSheetButton />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              The tracker is showing a sample register. To connect the real one, your system administrator creates an
              empty Google spreadsheet, shares it with the tracker&rsquo;s service account as an Editor, puts its ID in
              GOOGLE_EXPATS_SHEET_ID and restarts the app — then presses &ldquo;Prepare the expat sheet&rdquo; here.
            </p>
          )}
        </CardBody>
      </Card>

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

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Document uploads"
          description={storage.detail}
          action={<Badge tone={storage.ok ? "success" : "warning"}>{storage.label}</Badge>}
        />
        <CardBody className="space-y-4 text-sm text-slate-600">
          {driveConnected ? (
            <Alert tone="success" title="Google Drive connected">
              New expat documents will be stored in that account&rsquo;s Drive.
            </Alert>
          ) : null}
          {driveError ? (
            <Alert tone="critical" title="Google Drive was not connected">
              {driveError}
            </Alert>
          ) : null}
          {storage.warnings.map((warning) => (
            <Alert key={warning} tone="caution">
              {warning}
            </Alert>
          ))}
          <p>
            Uploaded passports, permits, contracts and other documents are filed as{" "}
            <span className="font-medium text-slate-800">Trade Kings Expats / EXP-001 – Name</span> (with a folder per
            dependant), each named by the date it was added. They open only through the tracker, and only for people who
            may see sensitive details. This is separate from the other trackers&rsquo; storage.
          </p>
          {storage.connectedAccount ? (
            <div className="space-y-2">
              <p>
                Documents go to <span className="font-medium text-slate-800">{storage.connectedAccount.email}</span>, in{" "}
                <span className="font-medium text-slate-800">My Drive / {storage.connectedAccount.folderName}</span>. Connected{" "}
                {formatTimestamp(storage.connectedAccount.connectedAt, config.timezone)}
                {storage.connectedAccount.connectedBy ? ` by ${storage.connectedAccount.connectedBy}` : ""}.
              </p>
              <DisconnectExpatDriveButton />
            </div>
          ) : config.auth.google ? (
            <a href="/api/drive/connect?app=expats" className={buttonClasses("primary", "sm")}>
              Connect Google Drive
            </a>
          ) : (
            <p className="text-slate-500">Needs Google sign-in to be set up first.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Expat Tracker roles"
          description="What each role may do. Without “See sensitive details”, passport and permit numbers, dates of birth, personal contacts, addresses, rent and documents are hidden. Change the ticks — or add a role — on the Expat Roles tab of the users spreadsheet; changes apply within about 30 seconds."
        />
        <RoleMatrix roles={roleTable.expats} catalogue={EXPAT_PERMISSION_INFO} />
      </Card>

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Who can sign in"
          description="Change someone's access to each app, or add a person. Saved to the Users tab of the users spreadsheet; applies within about 30 seconds."
        />
        {people.editable ? (
          <UsersEditor
            users={people.users}
            contractRoles={people.contractRoles}
            billboardRoles={people.billboardRoles}
            licenseRoles={people.licenseRoles}
            expatRoles={people.expatRoles}
            rights={people.rights}
            currentEmail={people.currentEmail}
          />
        ) : (
          <CardBody>
            <p className="text-sm text-slate-500">
              The tracker is running on sample data, so there is no Users tab yet. Once the Google Sheet is connected,
              people can be added and given access here.
            </p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
