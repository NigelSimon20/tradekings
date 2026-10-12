import { disconnectDriveAction, setUpBillboardSheetAction } from "@/app/(billboards)/billboards/actions";
import { RolesCard, SheetCard, SignInCard, StorageCard } from "@/components/settings/setup-cards";
import { PageHeader } from "@/components/ui/page-header";
import { BILLBOARD_PERMISSION_INFO } from "@/lib/auth/roles";
import { BILLBOARD_STORE } from "@/lib/billboards/data/sheet-tables";
import { BILLBOARD_ROLES_TAB } from "@/lib/data/sheet-schema";
import type { PageSearchParams } from "@/lib/domain/filters";
import { getRoleTable, requireBillboardViewer } from "@/lib/services/auth";
import { checkBillboardSource, checkPhotoStore } from "@/lib/services/billboards";
import { loadUsersEditor } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** Where the billboard data lives and who can open it — for billboard administrators. */
export default async function BillboardSettingsPage({ searchParams }: PageSearchParams) {
  await requireBillboardViewer("manageBillboards");
  const [params, health, photos, people, roleTable] = await Promise.all([
    searchParams,
    checkBillboardSource(),
    checkPhotoStore(),
    loadUsersEditor(),
    getRoleTable(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billboard tracker" title="Setup & access" description="The billboard spreadsheet and who can use the billboard tracker." />
      <SheetCard store={BILLBOARD_STORE} health={health} setUp={setUpBillboardSheetAction} />
      <StorageCard
        app="billboards"
        title="Photo & document uploads"
        storage={photos}
        filing="City / BB-001 – Site name / photos"
        disconnect={disconnectDriveAction}
        searchParams={params}
      />
      <RolesCard appName="Billboard Tracker" tab={BILLBOARD_ROLES_TAB} roles={roleTable.billboards} catalogue={BILLBOARD_PERMISSION_INFO} />
      <SignInCard people={people} />
    </div>
  );
}
