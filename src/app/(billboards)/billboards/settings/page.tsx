import { DisconnectDriveButton, SetUpBillboardSheetButton } from "@/components/billboards/record-forms";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { BILLBOARD_PERMISSION_INFO } from "@/lib/auth/roles";
import { RoleMatrix } from "@/components/ui/role-matrix";
import { BILLBOARD_TABLES } from "@/lib/billboards/data/sheet-tables";
import { getRoleTable, requireBillboardViewer } from "@/lib/services/auth";
import { loadUsersEditor } from "@/lib/services/users";
import { UsersEditor } from "@/components/settings/users-editor";
import { getConfig } from "@/lib/config/env";
import { formatTimestamp } from "@/lib/date/dates";
import type { PageSearchParams } from "@/lib/domain/filters";
import { checkBillboardSource, checkPhotoStore } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

/** Where the billboard data lives and who can open it — for billboard administrators. */
export default async function BillboardSettingsPage({ searchParams }: PageSearchParams) {
  await requireBillboardViewer("manageBillboards");
  const params = await searchParams;
  const driveConnected = params.drive === "connected";
  const driveError = typeof params["drive-error"] === "string" ? params["drive-error"] : "";
  const config = getConfig();
  const timezone = config.timezone;
  const googleSignIn = config.auth.google !== null;
  const secretIsTemporary = config.auth.secretIsTemporary;
  const [health, photos, people, roleTable] = await Promise.all([
    checkBillboardSource(),
    checkPhotoStore(),
    loadUsersEditor(),
    getRoleTable(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billboard tracker"
        title="Setup & access"
        description="The billboard spreadsheet and who can use the billboard tracker."
      />

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Billboard spreadsheet"
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
                Creates any missing tab ({BILLBOARD_TABLES.map((table) => table.tab).join(", ")}), adds
                missing headings, dropdowns and date formats. Safe to press again — it never changes a
                value someone has typed.
              </p>
              <SetUpBillboardSheetButton />
            </>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                The tracker is showing sample data. To connect the real billboard spreadsheet, your
                system administrator needs to:
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Create an empty Google spreadsheet for the billboards.</li>
                <li>Share it with the tracker&rsquo;s service account as an Editor (the same one the contract sheet uses).</li>
                <li>Put its ID in the GOOGLE_BILLBOARDS_SHEET_ID setting and restart the app.</li>
                <li>Come back here and press &ldquo;Prepare the billboard sheet&rdquo;.</li>
              </ol>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Photo & document uploads"
          description={photos.detail}
          action={<Badge tone={photos.ok ? "success" : "warning"}>{photos.label}</Badge>}
        />
        <CardBody className="space-y-5 text-sm text-slate-600">
          {driveConnected ? (
            <Alert tone="success" title="Google Drive connected">
              New uploads will be stored in that account&rsquo;s Drive.
            </Alert>
          ) : null}
          {driveError ? (
            <Alert tone="critical" title="Google Drive was not connected">
              {driveError}
            </Alert>
          ) : null}
          {photos.warnings.map((warning) => (
            <Alert key={warning} tone="caution">
              {warning}
            </Alert>
          ))}
          <p>
            Uploaded files are filed automatically as{" "}
            <span className="font-medium text-slate-800">City / BB-001 – Site name / photos</span>, each
            named by the date and time it was added so a folder lists in order. The tracker shows
            previews itself, so nothing needs to be shared publicly.
          </p>

          <section className="space-y-2 rounded-xl p-4 ring-1 ring-slate-200">
            <p className="font-medium text-slate-900">Option 1 — Connect a Google account</p>
            {photos.connectedAccount ? (
              <>
                <p>
                  Uploads go to{" "}
                  <span className="font-medium text-slate-800">{photos.connectedAccount.email}</span>, in{" "}
                  <span className="font-medium text-slate-800">My Drive / {photos.connectedAccount.folderName}</span>.
                  Connected {formatTimestamp(photos.connectedAccount.connectedAt, timezone)}
                  {photos.connectedAccount.connectedBy ? ` by ${photos.connectedAccount.connectedBy}` : ""}.
                </p>
                <DisconnectDriveButton />
              </>
            ) : (
              <>
                <p>
                  Quickest to set up, and works with a Gmail account. The photos live in that account&rsquo;s
                  Drive and use its storage. The tracker can only see the folder it creates there.
                </p>
                {googleSignIn ? (
                  <a href="/api/drive/connect?app=billboards" className={buttonClasses("primary", "sm")}>
                    Connect Google Drive
                  </a>
                ) : (
                  <p className="text-slate-500">Needs Google sign-in to be set up first.</p>
                )}
                <p className="text-xs text-slate-500">
                  Before connecting: enable the Google Drive API in the Google Cloud project. If the
                  Google sign-in app is still in &ldquo;Testing&rdquo;, Google cuts this access after 7 days —
                  publish it (Google Auth Platform → Audience → Publish app).
                </p>
              </>
            )}
            {secretIsTemporary ? (
              <Alert tone="caution">
                AUTH_SECRET is not set, so a connection is forgotten whenever the server restarts. Set it before
                connecting.
              </Alert>
            ) : null}
          </section>

          <section className="space-y-2 rounded-xl p-4 ring-1 ring-slate-200">
            <p className="font-medium text-slate-900">Option 2 — Company Shared drive (recommended for the live system)</p>
            <p>
              The photos belong to Trade Kings rather than one person. Needs Google Workspace (company Google
              accounts) — personal Gmail accounts cannot have Shared drives.
              {photos.connectedAccount ? " A connected account (Option 1) takes priority; disconnect it to switch." : ""}
            </p>
          </section>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Billboard Tracker roles"
          description="What each role may do. Change the ticks — or add a row for a new role — on the Billboard Roles tab of the users spreadsheet; changes apply within about 30 seconds."
        />
        <RoleMatrix roles={roleTable.billboards} catalogue={BILLBOARD_PERMISSION_INFO} />
      </Card>

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Who can sign in"
          description={
            people.rights.contracts || people.rights.billboards
              ? "Change someone's access to each app, or add a person. Saved to the Users tab of the users spreadsheet; applies within about 30 seconds."
              : "Set on the Users tab of the users spreadsheet. Only administrators can change it."
          }
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
              The tracker is running on sample data, so there is no Users tab yet. Once the Google Sheet is
              connected, people can be added and given access here.
            </p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
