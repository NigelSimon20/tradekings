import { headers } from "next/headers";

import { AlertIcon } from "@/components/ui/icons";
import { getConfig } from "@/lib/config/env";

/**
 * A standing warning when the tracker is reachable over a network without a
 * password. The database holds names, job titles, managers and contract dates
 * for every blue-collar employee — that should never be one URL away from
 * anyone. Hidden on localhost, where working without a password is normal.
 */
export async function InsecureBanner() {
  const config = getConfig();
  const host = (await headers()).get("host") ?? "";
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (isLocal) return null;

  // Signing in is on, but the key that protects the session cookie is
  // temporary: everyone will be signed out whenever the app restarts.
  if (config.auth.enabled && config.auth.secretIsTemporary) {
    return (
      <div className="flex items-start gap-3 bg-amber-500 px-4 py-2.5 text-amber-950 lg:px-8">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <p className="text-sm">
          <span className="font-semibold">No sign-in key has been set.</span> People will be signed
          out whenever the tracker restarts. Ask your system administrator to set one.
        </p>
      </div>
    );
  }

  if (config.auth.enabled) return null;

  return (
    <div className="flex items-start gap-3 bg-red-700 px-4 py-2.5 text-white lg:px-8">
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <p className="text-sm">
        <span className="font-semibold">This tracker has no password.</span> Anyone with the link can
        read and change employee contract records. Ask your system administrator to set one.
      </p>
    </div>
  );
}
