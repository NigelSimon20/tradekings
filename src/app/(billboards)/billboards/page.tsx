import { BillboardMap } from "@/components/billboards/billboard-map";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { AlertIcon, PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { canBillboards } from "@/lib/auth/roles";
import type { PageSearchParams } from "@/lib/domain/filters";
import { requireBillboardViewer } from "@/lib/services/auth";
import { loadBillboards } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

/** The billboard tracker's front door: every site on the map. */
export default async function BillboardMapPage({ searchParams }: PageSearchParams) {
  const params = await searchParams;
  const denied = params.denied === "1";
  const focus = typeof params.focus === "string" ? params.focus : undefined;
  const user = await requireBillboardViewer("viewBillboards");
  const { billboards, source } = await loadBillboards();
  const cities = [...new Set(billboards.map((billboard) => billboard.city).filter(Boolean))].sort();
  const mayEdit = canBillboards(user, "editBillboards");

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Trade Kings"
        title="Billboard map"
        description="Search or pick a site to see its summary, then open the full profile."
        actions={
          mayEdit ? (
            <ButtonLink href="/billboards/new" className="lg:hidden">
              <PlusIcon />
              Add billboard
            </ButtonLink>
          ) : null
        }
      />

      {denied ? (
        <Alert tone="warning" title="That page is not available to your account">
          You were brought back here because your billboard access does not include what you opened.
        </Alert>
      ) : null}

      {source.kind === "local" ? (
        <Alert tone="caution" title="You are looking at practice data" icon={<AlertIcon className="size-4" />}>
          The billboard spreadsheet is not connected yet, so the tracker is showing a sample network.
        </Alert>
      ) : null}

      <BillboardMap billboards={billboards} cities={cities} focusId={focus} />
    </div>
  );
}
