"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

export interface ActionResult {
  tone: "success" | "critical";
  text: string;
}

/** The shape every endpoint in this app answers with. */
export interface ApiResponse {
  ok?: boolean;
  message?: string;
  error?: string;
}

/**
 * Running something on the server from a button: track which button is busy,
 * keep the message to show afterwards, and refresh the page on success.
 *
 * Five buttons were each doing this by hand — system check, weekly report,
 * send test, import and sheet setup — with slightly different error handling.
 */
export function useApiAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [, startTransition] = useTransition();

  const run = useCallback(
    async (key: string, work: () => Promise<ApiResponse>, options: { refresh?: boolean } = {}) => {
      setBusy(key);
      setResult(null);
      try {
        const payload = await work();
        if (payload.ok === false || payload.error) {
          throw new Error(payload.error ?? "That did not work.");
        }
        setResult({ tone: "success", text: payload.message ?? "Done." });
        if (options.refresh !== false) startTransition(() => router.refresh());
        return payload;
      } catch (error) {
        setResult({ tone: "critical", text: (error as Error).message });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [router],
  );

  return { busy, result, setResult, run };
}

/** POSTs JSON and returns the parsed answer, whatever the status code. */
export async function postJson(url: string, body?: unknown): Promise<ApiResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return asApiResponse(response);
}

/** POSTs a file upload and returns the parsed answer. */
export async function postForm(url: string, form: FormData): Promise<ApiResponse> {
  return asApiResponse(await fetch(url, { method: "POST", body: form }));
}

async function asApiResponse(response: Response): Promise<ApiResponse> {
  const payload = (await response.json().catch(() => ({}))) as ApiResponse;
  if (!response.ok && !payload.error) payload.error = `The request failed (${response.status}).`;
  return payload;
}
