"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { RefreshIcon, SendIcon } from "@/components/ui/icons";

type Result = { tone: "success" | "error"; message: string } | null;

/**
 * The manual controls from the specification: re-run the rules over the whole
 * database, or send the weekly reports now. Sending is confirmed first because
 * it emails managers immediately.
 */
export function RunActions({ canSend }: { canSend: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"check" | "report" | null>(null);

  const call = async (action: "check" | "report") => {
    setBusy(action);
    setResult(null);
    try {
      const response = await fetch(action === "check" ? "/api/system-check" : "/api/reports/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "send", trigger: "manual" }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "The request failed.");
      }
      setResult({ tone: "success", message: payload.message ?? "Done." });
      startTransition(() => router.refresh());
    } catch (error) {
      setResult({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => call("check")}
          disabled={busy !== null || pending}
        >
          <RefreshIcon />
          {busy === "check" ? "Checking…" : "Run system check"}
        </Button>
        <Button
          onClick={() => {
            if (!canSend) {
              setResult({
                tone: "error",
                message:
                  "No HR recipient has been set yet — add one on the Settings tab of the Google Sheet.",
              });
              return;
            }
            if (window.confirm("Send the weekly contract reports to HR and every manager now?")) {
              void call("report");
            }
          }}
          disabled={busy !== null || pending}
        >
          <SendIcon />
          {busy === "report" ? "Sending…" : "Run weekly report"}
        </Button>
      </div>
      {result ? (
        <p
          className={`text-xs ${result.tone === "success" ? "text-emerald-700" : "text-red-700"}`}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
