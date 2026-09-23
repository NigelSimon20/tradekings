"use client";

import { Button } from "@/components/ui/button";
import { RefreshIcon, SendIcon } from "@/components/ui/icons";
import { postJson, useApiAction } from "@/lib/ui/use-api-action";

/**
 * The manual controls from the specification: re-run the rules over the whole
 * database, or send the weekly reports now. Sending is confirmed first because
 * it emails managers immediately.
 */
export function RunActions({ canSend }: { canSend: boolean }) {
  const { busy, result, setResult, run } = useApiAction();

  const sendReports = () => {
    if (!canSend) {
      setResult({
        tone: "critical",
        text: "No HR recipient has been set yet — add one on the Settings tab of the Google Sheet.",
      });
      return;
    }
    if (!window.confirm("Send the weekly contract reports to HR and every manager now?")) return;
    void run("report", () => postJson("/api/reports/run", { mode: "send" }));
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void run("check", () => postJson("/api/system-check"))}
        >
          <RefreshIcon />
          {busy === "check" ? "Checking…" : "Run system check"}
        </Button>

        <Button onClick={sendReports} disabled={busy !== null}>
          <SendIcon />
          {busy === "report" ? "Sending…" : "Run weekly report"}
        </Button>
      </div>

      {result ? (
        <p
          role="status"
          className={`text-xs ${result.tone === "success" ? "text-emerald-700" : "text-red-700"}`}
        >
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
