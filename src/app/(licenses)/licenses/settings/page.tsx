import { disconnectLicenseDriveAction, setUpLicenseSheetAction } from "@/app/(licenses)/licenses/actions";
import { ReminderDaysForm } from "@/components/licenses/license-controls";
import { RolesCard, SheetCard, SignInCard, StorageCard } from "@/components/settings/setup-cards";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LICENSE_PERMISSION_INFO } from "@/lib/auth/roles";
import { LICENSE_ROLES_TAB } from "@/lib/data/sheet-schema";
import type { PageSearchParams } from "@/lib/domain/filters";
import { LICENSE_STORE } from "@/lib/licenses/data/sheet-tables";
import { getRoleTable, requireLicenseViewer } from "@/lib/services/auth";
import { checkLicenseSource, checkLicenseStorage, getLicenseRules } from "@/lib/services/licenses";
import { loadUsersEditor } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** The license spreadsheet, reminders, document storage and who can use the tracker — for its administrators. */
export default async function LicenseSettingsPage({ searchParams }: PageSearchParams) {
  await requireLicenseViewer("manageLicenses");
  const [params, health, storage, rules, people, roleTable] = await Promise.all([
    searchParams,
    checkLicenseSource(),
    checkLicenseStorage(),
    getLicenseRules(),
    loadUsersEditor(),
    getRoleTable(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="License Tracker" title="Setup & access" description="The license spreadsheet, reminders, document storage and access." />
      <SheetCard store={LICENSE_STORE} health={health} setUp={setUpLicenseSheetAction} />
      <Card>
        <CardHeader
          title="Renewal reminders"
          description={`Licenses are flagged at ${rules.reminderDays.join(", ")} days before they expire, and counted as “expiring soon” from ${rules.reminderDays[0]} days.`}
        />
        <CardBody>
          <ReminderDaysForm current={rules.reminderDays} />
        </CardBody>
      </Card>
      <StorageCard
        app="licenses"
        title="Document uploads"
        storage={storage}
        filing="Trade Kings Licenses / Warehouses & Sites / AS-001 – Msasa Warehouse"
        disconnect={disconnectLicenseDriveAction}
        searchParams={params}
      />
      <RolesCard appName="License Tracker" tab={LICENSE_ROLES_TAB} roles={roleTable.licenses} catalogue={LICENSE_PERMISSION_INFO} />
      <SignInCard people={people} />
    </div>
  );
}
