"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SendIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { postJson, useApiAction } from "@/lib/ui/use-api-action";

/**
 * Proves email works before anyone relies on the weekly run — without emailing
 * every manager to find out.
 */
export function TestEmailDialog({ defaultAddress }: { defaultAddress: string }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(defaultAddress);
  const { busy, result, run } = useApiAction();

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
            <Button
              disabled={busy !== null || !address.trim()}
              onClick={() => void run("test", () => postJson("/api/reports/test", { to: address }))}
            >
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
