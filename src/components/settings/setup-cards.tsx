import type { ReactNode } from "react";

import { ActionButton } from "@/components/forms/record-form";
import { SharedFolderSection } from "@/components/settings/shared-folder-section";
import { UsersEditor } from "@/components/settings/users-editor";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon, RefreshIcon, SettingsIcon } from "@/components/ui/icons";
import { RoleMatrix } from "@/components/ui/role-matrix";
import type { PermissionInfo, RoleDefinition } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { tabNames } from "@/lib/data/record-store";
import type { RepositoryHealth } from "@/lib/data/repository";
import { formatTimestamp } from "@/lib/date/dates";
import type { RecordAction } from "@/lib/domain/form-state";
import type { StorageApp } from "@/lib/files";
import type { checkStorage } from "@/lib/services/storage";
import type { loadUsersEditor } from "@/lib/services/users";

/**
 * The cards every tracker's Setup & access page is made of — its spreadsheet,
 * its document storage, its roles and who can sign in — and the screen shown
 * when its data cannot be opened. One definition each, for every app.
 */

/** What these cards need to know about an app's spreadsheet. */
interface StoreInfo {
  name: string;
  sheetSetting: string;
  tables: object;
}

export function SetUpSheetButton({ store, action }: { store: StoreInfo; action: RecordAction }) {
  return (
    <ActionButton
      action={action}
      label={`Prepare the ${store.name} sheet`}
      busyLabel="Preparing…"
      icon={<RefreshIcon className="size-4" />}
      variant="primary"
      size="md"
    />
  );
}

/**
 * Shown in place of every page of a tracker whose data cannot be read — Setup
 * & access included — so the button that prepares a new spreadsheet is
 * offered here, or an empty spreadsheet could never be set up from the app.
 */
export function TrackerUnavailable({
  store,
  reason,
  setUp,
}: {
  store: StoreInfo;
  reason: string;
  /** The "prepare the sheet" action, for someone allowed to run it. */
  setUp?: RecordAction;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader icon={<AlertIcon className="size-4" />} title={`The ${store.name} data could not be opened`} description={reason} />
      <CardBody className="space-y-4 text-sm text-slate-600">
        {setUp ? (
          <div className="space-y-3">
            <p>
              If this is a new, empty spreadsheet, prepare it now. This creates the {tabNames(store).join(", ")} tabs
              with their headings. It never changes anything already typed in.
            </p>
            <SetUpSheetButton store={store} action={setUp} />
          </div>
        ) : null}
        <div className="space-y-2">
          <p>{setUp ? "If that does not help, check that:" : "Ask your system administrator to check that:"}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The {store.name} spreadsheet is shared with the tracker as an Editor.</li>
            <li>The tracker is pointed at the right spreadsheet ({store.sheetSetting}).</li>
            <li>The spreadsheet has been prepared, so its tabs have their headings.</li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

/** The app's spreadsheet: whether it is connected, and the button that prepares it. */
export function SheetCard({
  store,
  health,
  setUp,
}: {
  store: StoreInfo;
  health: RepositoryHealth & { kind: string; label: string };
  setUp: RecordAction;
}) {
  return (
    <Card>
      <CardHeader
        icon={<SettingsIcon className="size-4" />}
        title={`${store.name.charAt(0).toUpperCase()}${store.name.slice(1)} spreadsheet`}
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
              Creates any missing tab ({tabNames(store).join(", ")}), adds missing headings, dropdowns and date formats.
              Safe to press again — it never changes a value someone has typed.
            </p>
            <SetUpSheetButton store={store} action={setUp} />
          </>
        ) : (
          <div className="space-y-2 text-sm text-slate-600">
            <p>The tracker is showing sample data. To connect the real {store.name} spreadsheet, your system administrator needs to:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Create an empty Google spreadsheet.</li>
              <li>Share it with the tracker&rsquo;s service account as an Editor (the same one the contract sheet uses).</li>
              <li>Put its ID in the {store.sheetSetting} setting and restart the app.</li>
              <li>Come back here and press &ldquo;Prepare the {store.name} sheet&rdquo;.</li>
            </ol>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Where an app's uploads are kept: the connected Google account (and the
 * shared folder it files into, if one was chosen), or how to connect one.
 */
export function StorageCard({
  app,
  title,
  storage,
  filing,
  disconnect,
  searchParams,
}: {
  app: StorageApp;
  title: string;
  storage: Awaited<ReturnType<typeof checkStorage>>;
  /** How files are filed, e.g. "City / BB-001 – Site name / photos". */
  filing: ReactNode;
  disconnect: RecordAction;
  /** The page's query, which says how a trip to Google went. */
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { auth, timezone } = getConfig();
  const driveError = typeof searchParams["drive-error"] === "string" ? searchParams["drive-error"] : "";
  const account = storage.connectedAccount;

  return (
    <Card>
      <CardHeader
        icon={<SettingsIcon className="size-4" />}
        title={title}
        description={storage.detail}
        action={<Badge tone={storage.ok ? "success" : "warning"}>{storage.label}</Badge>}
      />
      <CardBody className="space-y-4 text-sm text-slate-600">
        {searchParams.drive === "connected" ? (
          <Alert tone="success" title="Google Drive connected">
            New uploads will be stored in that account&rsquo;s Drive.
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
          Uploaded files are filed as <span className="font-medium text-slate-800">{filing}</span>, each named by the date
          it was added so a folder lists in order. The tracker shows them itself, so nothing is shared publicly.
        </p>

        <section className="space-y-2 rounded-xl p-4 ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">Connect a Google account</p>
          {account ? (
            <>
              <p>
                Uploads go to <span className="font-medium text-slate-800">{account.email}</span>, in{" "}
                <span className="font-medium text-slate-800">{account.location}</span>. Connected{" "}
                {formatTimestamp(account.connectedAt, timezone)}
                {account.connectedBy ? ` by ${account.connectedBy}` : ""}.
              </p>
              <ActionButton
                action={disconnect}
                label="Disconnect"
                busyLabel="Disconnecting…"
                confirm="Stop storing uploads in this Google account? Files already uploaded stay in its Drive."
              />
            </>
          ) : auth.google ? (
            <>
              <p>
                The files live in that account&rsquo;s Drive and use its storage. The tracker can only see the folders it
                creates, or one you choose for it.
              </p>
              <a href={`/api/drive/connect?app=${app}`} className={buttonClasses("primary", "sm")}>
                Connect Google Drive
              </a>
              <p className="text-xs text-slate-500">
                Before connecting: enable the Google Drive API in the Google Cloud project. If the Google sign-in app is
                still in &ldquo;Testing&rdquo;, Google cuts this access after 7 days — publish it (Google Auth Platform →
                Audience → Publish app).
              </p>
            </>
          ) : (
            <p className="text-slate-500">Needs Google sign-in to be set up first.</p>
          )}
          {auth.secretIsTemporary ? (
            <Alert tone="caution">
              AUTH_SECRET is not set, so a connection is forgotten whenever the server restarts. Set it before connecting.
            </Alert>
          ) : null}
        </section>

        {account ? <SharedFolderSection app={app} account={account} pickerReady={storage.pickerReady} /> : null}
      </CardBody>
    </Card>
  );
}

/** What each role may do in one app, from its roles tab. */
export function RolesCard<P extends string>({
  appName,
  tab,
  roles,
  catalogue,
  note,
}: {
  appName: string;
  tab: string;
  roles: RoleDefinition<P>[];
  catalogue: PermissionInfo<P>[];
  note?: string;
}) {
  return (
    <Card>
      <CardHeader
        icon={<SettingsIcon className="size-4" />}
        title={`${appName} roles`}
        description={`What each role may do.${note ? ` ${note}` : ""} Change the ticks — or add a row for a new role — on the ${tab} tab of the users spreadsheet; changes apply within about 30 seconds.`}
      />
      <RoleMatrix roles={roles} catalogue={catalogue} />
    </Card>
  );
}

/** Who may sign in to which app — editable by administrators. */
export function SignInCard({ people }: { people: Awaited<ReturnType<typeof loadUsersEditor>> }) {
  const { rights } = people;
  const canEdit = rights.contracts || rights.billboards || rights.licenses || rights.expats;
  return (
    <Card>
      <CardHeader
        icon={<SettingsIcon className="size-4" />}
        title="Who can sign in"
        description={
          canEdit
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
          expatRoles={people.expatRoles}
          rights={people.rights}
          currentEmail={people.currentEmail}
        />
      ) : (
        <CardBody>
          <p className="text-sm text-slate-500">
            The tracker is running on sample data, so there is no Users tab yet. Once the Google Sheet is connected, people
            can be added and given access here.
          </p>
        </CardBody>
      )}
    </Card>
  );
}
