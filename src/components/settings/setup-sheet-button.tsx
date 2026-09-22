"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setUpSheetAction, type SetupState } from "@/app/(app)/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshIcon } from "@/components/ui/icons";

/**
 * Creates the tabs, headings, dropdowns and colour coding in the Google Sheet.
 * Adding only what is missing makes this safe to press at any time.
 */
export function SetupSheetButton({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<SetupState | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const run = async () => {
    if (!window.confirm("Check the Google Sheet and add anything that is missing?")) return;
    setBusy(true);
    setState(null);
    try {
      const result = await setUpSheetAction();
      setState(result);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void run()} disabled={busy || !connected}>
          <RefreshIcon className="size-4" />
          {busy ? "Checking the sheet…" : "Prepare the Google Sheet"}
        </Button>
        <p className="text-xs text-slate-500">
          Adds any missing tabs, headings, dropdowns and colour coding. Nothing already filled in is
          changed.
        </p>
      </div>

      {state ? (
        <Alert
          tone={state.status === "done" ? "success" : "critical"}
          title={state.status === "done" ? "Sheet checked" : "That did not work"}
        >
          <ul className="space-y-1">
            {state.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
