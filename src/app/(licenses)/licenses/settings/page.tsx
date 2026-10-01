import {
  DisconnectLicenseDriveButton,
  ReminderDaysForm,
  SetUpLicenseSheetButton,
} from "@/components/licenses/license-controls";
import { UsersEditor } from "@/components/settings/users-editor";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { RoleMatrix } from "@/components/ui/role-matrix";
import { LICENSE_PERMISSION_INFO } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { formatTimestamp } from "@/lib/date/dates";
import type { PageSearchParams } from "@/lib/domain/filters";
import { LICENSE_TABLES } from "@/lib/licenses/data/sheet-tables";
import { getRoleTable, requireLicenseViewer } from "@/lib/services/auth";
import { checkLicenseSource, checkLicenseStorage, getLicenseRules } from "@/lib/services/licenses";
import { loadUsersEditor } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** The license spreadsheet, reminders, document storage and who can use the tracker — for its administrators. */
export default async function LicenseSettingsPage({ searchParams }: PageSearchParams) {
  await requireLicenseViewer("manageLicenses");
  const params = await searchParams;
  const driveConnected = params.drive === "connected";
  const driveError = typeof params["drive-error"] === "string" ? params["drive-error"] : "";
  const config = getConfig();

  const [health, storage, rules, people, roleTable] = await Promise.all([
    checkLicenseSource(),
    checkLicenseStorage(),
    getLicenseRules(),
    loadUsersEditor(),
    getRoleTable(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="License Tracker" title="Setup & access" description="The license spreadsheet, reminders, document storage and access." />

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="License spreadsheet"
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
                Creates any missing tab ({LICENSE_TABLES.map((table) => table.tab).join(", ")}), adds missing headings,
                dropdowns and date formats. Safe to press again — it never changes a value someone has typed.
              </p>
              <SetUpLicenseSheetButton />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              The tracker is showing a sample register. To connect the real one, your system administrator creates an
              empty Google spreadsheet, shares it with the tracker&rsquo;s service account as an Editor, puts its ID in
              GOOGLE_LICENSES_SHEET_ID and restarts the app — then presses &ldquo;Prepare the license sheet&rdquo; here.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Renewal reminders"
          description={`Licenses are flagged at ${rules.reminderDays.join(", ")} days before they expire, and counted as “expiring soon” from ${rules.reminderDays[0]} days.`}
        />
        <CardBody>
          <ReminderDaysForm current={rules.reminderDays} />
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
              New license documents will be stored in that account&rsquo;s Drive.
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
            Uploaded certificates and photos are filed as{" "}
            <span className="font-medium text-slate-800">Trade Kings Licenses / Warehouses &amp; Sites / AS-001 – Msasa Warehouse</span>,
            each named by the date it was added. The tracker shows them itself, so nothing is shared publicly. This is
            separate from the Billboard Tracker&rsquo;s storage.
          </p>
          {storage.connectedAccount ? (
            <div className="space-y-2">
              <p>
                Documents go to <span className="font-medium text-slate-800">{storage.connectedAccount.email}</span>, in{" "}
                <span className="font-medium text-slate-800">My Drive / {storage.connectedAccount.folderName}</span>. Connected{" "}
                {formatTimestamp(storage.connectedAccount.connectedAt, config.timezone)}
                {storage.connectedAccount.connectedBy ? ` by ${storage.connectedAccount.connectedBy}` : ""}.
              </p>
              <DisconnectLicenseDriveButton />
            </div>
          ) : config.auth.google ? (
            <a href="/api/drive/connect?app=licenses" className={buttonClasses("primary", "sm")}>
              Connect Google Drive
            </a>
          ) : (
            <p className="text-slate-500">Needs Google sign-in to be set up first.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="License Tracker roles"
          description="What each role may do. Change the ticks — or add a row for a new role — on the License Roles tab of the users spreadsheet; changes apply within about 30 seconds."
        />
        <RoleMatrix roles={roleTable.licenses} catalogue={LICENSE_PERMISSION_INFO} />
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
