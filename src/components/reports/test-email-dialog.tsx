"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SendIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";

/**
 * Proves email works before anyone relies on the weekly run — without emailing
 * every manager to find out.
 */
export function TestEmailDialog({ defaultAddress }: { defaultAddress: string }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(defaultAddress);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "critical"; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/reports/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: address }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || payload.ok === false) throw new Error(payload.error ?? "The test failed.");
      setResult({ tone: "success", text: payload.message ?? "Sent." });
    } catch (error) {
      setResult({ tone: "critical", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <SendIcon className="size-4" />
        Send a test
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send a test message"
        description="One short email, so you can check that reports arrive before the weekly run."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={() => void send()} disabled={busy || !address.trim()}>
              {busy ? "Sending…" : "Send test"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Send it to" htmlFor="test-address" hint="Use your own address first.">
            <Input
              id="test-address"
              type="email"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          {result ? (
            <Alert tone={result.tone} title={result.tone === "success" ? "Done" : "Not sent"}>
              {result.text}
            </Alert>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
