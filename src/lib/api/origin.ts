import "server-only";

import { getConfig } from "@/lib/config/env";

/**
 * Where this deployment is reachable, worked out from the request itself.
 *
 * Links in the sheet's Dashboard tab and in the weekly emails have to point at
 * the running app. Deriving the address from the request means nobody has to
 * remember to set it after deploying; the configured value is the fallback.
 */
export function originFromRequest(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return getConfig().appUrl;
  }
}
