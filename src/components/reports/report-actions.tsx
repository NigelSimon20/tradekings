"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { SendIcon } from "@/components/ui/icons";

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
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"one" | "all" | null>(null);
  const [, startTransition] = useTransition();

  const send = async (scope: "one" | "all") => {
    const question =
      scope === "one"
        ? `Send this report to ${recipient} now?`
        : "Send the weekly reports to HR and every manager now?";
    if (!window.confirm(question)) return;

    setBusy(scope);
    setMessage(null);
    try {
      const response = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "send", ...(scope === "one" ? { onlyRecipient: recipient } : {}) }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || payload.ok === false) throw new Error(payload.error ?? "The run failed.");
      setMessage({ tone: "success", text: payload.message ?? "Sent." });
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage({ tone: "error", text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!recipient || busy !== null}
          onClick={() => void send("one")}
          title={recipient ? `Send to ${recipient}` : "This recipient has no email address"}
        >
          <SendIcon />
          {busy === "one" ? "Sending…" : `Send to ${recipientLabel}`}
        </Button>
        <Button size="sm" disabled={!canSend || busy !== null} onClick={() => void send("all")}>
          <SendIcon />
          {busy === "all" ? "Sending…" : "Run full weekly report"}
        </Button>
      </div>
      {message ? (
        <p className={`text-xs ${message.tone === "success" ? "text-emerald-700" : "text-red-700"}`} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
