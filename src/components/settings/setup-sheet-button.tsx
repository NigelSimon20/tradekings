"use client";

import { setUpSheetAction } from "@/app/(app)/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshIcon } from "@/components/ui/icons";
import { useApiAction } from "@/lib/ui/use-api-action";

/**
 * Creates the tabs, headings, dropdowns and colour coding in the Google Sheet.
 * Adding only what is missing makes this safe to press at any time.
 */
export function SetupSheetButton({ connected }: { connected: boolean }) {
  const { busy, result, run } = useApiAction();

  const prepare = () => {
    if (!window.confirm("Check the Google Sheet and add anything that is missing?")) return;

    void run("setup", async () => {
      const outcome = await setUpSheetAction();
      return outcome.status === "done"
        ? { ok: true, message: outcome.messages.join(" ") }
        : { ok: false, error: outcome.messages.join(" ") };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={prepare} disabled={busy !== null || !connected}>
          <RefreshIcon className="size-4" />
          {busy ? "Checking the sheet…" : "Prepare the Google Sheet"}
        </Button>
        <p className="text-xs text-slate-500">
          Adds any missing tabs, headings, dropdowns and colour coding. Nothing already filled in is
          changed.
        </p>
      </div>

      {result ? (
        <Alert
          tone={result.tone === "success" ? "success" : "critical"}
          title={result.tone === "success" ? "Sheet checked" : "That did not work"}
        >
          {result.text}
        </Alert>
      ) : null}
    </div>
  );
}
