"use client";

import { Button } from "@/components/ui/button";
import { SendIcon } from "@/components/ui/icons";
import { postJson, useApiAction } from "@/lib/ui/use-api-action";

/**
 * Sends either the report currently on screen or the full weekly run. Both are
 * confirmed first — they put real email in people's inboxes.
 */
export function ReportActions({
  recipient,
  recipientLabel,
  canSend,
}: {
  recipient: string;
  recipientLabel: string;
  canSend: boolean;
}) {
  const { busy, result, run } = useApiAction();

  const send = (scope: "one" | "all") => {
    const question =
      scope === "one"
        ? `Send this report to ${recipient} now?`
        : "Send the weekly reports to HR and every manager now?";
    if (!window.confirm(question)) return;

    void run(scope, () =>
      postJson("/api/reports/run", {
        mode: "send",
        ...(scope === "one" ? { onlyRecipient: recipient } : {}),
      }),
    );
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!recipient || busy !== null}
          onClick={() => send("one")}
          title={recipient ? `Send to ${recipient}` : "This recipient has no email address"}
        >
          <SendIcon />
          {busy === "one" ? "Sending…" : `Send to ${recipientLabel}`}
        </Button>

        <Button size="sm" disabled={!canSend || busy !== null} onClick={() => send("all")}>
          <SendIcon />
          {busy === "all" ? "Sending…" : "Run full weekly report"}
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
