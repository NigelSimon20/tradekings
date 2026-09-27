import { SetUpBillboardSheetButton } from "@/components/billboards/record-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";

/**
 * Shown in place of a billboard page when its data cannot be read, rendered on
 * the server so the reason reaches the browser in production too.
 *
 * It replaces every billboard page, Setup & access included, so the button
 * that prepares a new spreadsheet has to be offered here — otherwise an empty
 * spreadsheet could never be set up from the app.
 */
export function BillboardsUnavailable({ reason, canSetUp }: { reason: string; canSetUp: boolean }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader
        icon={<AlertIcon className="size-4" />}
        title="The billboard data could not be opened"
        description={reason}
      />
      <CardBody className="space-y-4 text-sm text-slate-600">
        {canSetUp ? (
          <div className="space-y-3">
            <p>
              If this is a new, empty spreadsheet, prepare it now. This creates the Billboards,
              Campaigns, Maintenance, Documents and Activity Log tabs with their headings. It never
              changes anything already typed in.
            </p>
            <SetUpBillboardSheetButton />
          </div>
        ) : null}
        <div className="space-y-2">
          <p>{canSetUp ? "If that does not help, check that:" : "Ask your system administrator to check that:"}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The billboard spreadsheet is shared with the tracker as an Editor.</li>
            <li>The tracker is pointed at the right spreadsheet (GOOGLE_BILLBOARDS_SHEET_ID).</li>
            <li>The spreadsheet has been prepared, so its tabs have their headings.</li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
