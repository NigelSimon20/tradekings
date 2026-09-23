import "server-only";

import { getConfig } from "@/lib/config/env";
import { secretsMatch } from "@/lib/auth/session";

/** JSON error response with a consistent shape. */
export function failure(error: unknown, status = 500): Response {
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ ok: false, error: message }, { status });
}

export function success(message: string, data: Record<string, unknown> = {}): Response {
  return Response.json({ ok: true, message, ...data });
}

/**
 * Scheduled jobs authenticate with a bearer token. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` automatically when the variable is set.
 */
export function authoriseCron(request: Request): Response | null {
  const { cronSecret } = getConfig();

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { ok: false, error: "CRON_SECRET is not set — scheduled runs are disabled." },
        { status: 503 },
      );
    }
    return null;
  }

  const header = request.headers.get("authorization") ?? "";
  const provided =
    (header.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-cron-secret")) ?? "";

  return secretsMatch(provided, cronSecret)
    ? null
    : Response.json({ ok: false, error: "Unauthorised." }, { status: 401 });
}
