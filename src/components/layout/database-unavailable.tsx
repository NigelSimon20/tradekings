import { AdminDetails } from "@/components/ui/admin-details";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";
import { configurationProblems, getConfig } from "@/lib/config/env";

/**
 * Shown in place of the page when the contract database cannot be read.
 *
 * The reason is rendered on the server so it survives to the browser — an error
 * boundary would replace it with a generic message in production, which is
 * exactly when someone needs to know what is wrong.
 */
export function DatabaseUnavailable({ reason }: { reason: string }) {
  const problems = configurationProblems();
  const connected = getConfig().google !== null;

  // Advice about sharing a spreadsheet is useless when no spreadsheet has been
  // named yet, so the two situations read differently.
  const checks = connected
    ? [
        "The Google Sheet is shared with the tracker as an Editor.",
        "The tracker is pointed at the right spreadsheet.",
        "The sheet has been set up, so the Contracts tab has its headings.",
      ]
    : [
        "A Google Sheet has been created for the contract database.",
        "The tracker has been given the details for that sheet.",
        "The sheet has been set up, so the Contracts tab has its headings.",
      ];

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader
        icon={<AlertIcon className="size-4" />}
        title={
          connected
            ? "The contract database could not be opened"
            : "The tracker is not connected to a contract database yet"
        }
        description={
          connected
            ? "Nothing has been lost — the tracker simply cannot read the Google Sheet right now."
            : "Someone needs to finish connecting it to your Google Sheet before contracts can be shown."
        }
      />
      <CardBody className="space-y-4 text-sm text-slate-600">
        {connected ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-slate-700">{reason}</p>
        ) : null}

        <div>
          <p className="font-medium text-slate-900">What usually fixes this</p>
          <ul className="mt-2 space-y-1.5">
            {checks.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-slate-500">
          If you are not the person who set this up, let your system administrator know — they can fix
          it in a few minutes.
        </p>

        {problems.length ? (
          <AdminDetails>
            <ul className="space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-slate-600">
              {problems.map((problem) => (
                <li key={problem}>· {problem}</li>
              ))}
            </ul>
            <p className="mt-2">
              On a hosted deployment these are set in the hosting project&rsquo;s environment
              settings, not in a local file.
            </p>
          </AdminDetails>
        ) : null}
      </CardBody>
    </Card>
  );
}
