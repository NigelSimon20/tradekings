import { SetUpLicenseSheetButton } from "@/components/licenses/license-controls";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";

/**
 * Shown in place of a License Tracker page when its data cannot be read. It
 * replaces every page, Setup & access included, so an administrator is offered
 * the button that prepares a new spreadsheet here.
 */
export function LicensesUnavailable({ reason, canSetUp }: { reason: string; canSetUp: boolean }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader icon={<AlertIcon className="size-4" />} title="The license data could not be opened" description={reason} />
      <CardBody className="space-y-4 text-sm text-slate-600">
        {canSetUp ? (
          <div className="space-y-3">
            <p>
              If this is a new, empty spreadsheet, prepare it now. This creates the Assets &amp; Locations,
              Licenses, Renewals, Documents and Activity Log tabs. It never changes anything already typed in.
            </p>
            <SetUpLicenseSheetButton />
          </div>
        ) : null}
        <div className="space-y-2">
          <p>{canSetUp ? "If that does not help, check that:" : "Ask your system administrator to check that:"}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The license spreadsheet is shared with the tracker as an Editor.</li>
            <li>The tracker is pointed at the right spreadsheet (GOOGLE_LICENSES_SHEET_ID).</li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
