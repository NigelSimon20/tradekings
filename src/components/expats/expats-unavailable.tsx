import { SetUpExpatSheetButton } from "@/components/expats/controls";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";
import { EXPAT_TABLES } from "@/lib/expats/data/sheet-tables";

/**
 * Shown in place of an Expat Tracker page when its data cannot be read. It
 * replaces every page, Setup & access included, so an administrator is offered
 * the button that prepares a new spreadsheet here.
 */
export function ExpatsUnavailable({ reason, canSetUp }: { reason: string; canSetUp: boolean }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader icon={<AlertIcon className="size-4" />} title="The expat data could not be opened" description={reason} />
      <CardBody className="space-y-4 text-sm text-slate-600">
        {canSetUp ? (
          <div className="space-y-3">
            <p>
              If this is a new, empty spreadsheet, prepare it now. This creates the{" "}
              {Object.values(EXPAT_TABLES)
                .map((table) => table.tab)
                .join(", ")}{" "}
              tabs. It never changes anything already typed in.
            </p>
            <SetUpExpatSheetButton />
          </div>
        ) : null}
        <div className="space-y-2">
          <p>{canSetUp ? "If that does not help, check that:" : "Ask your system administrator to check that:"}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The expat spreadsheet is shared with the tracker as an Editor.</li>
            <li>The tracker is pointed at the right spreadsheet (GOOGLE_EXPATS_SHEET_ID).</li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
