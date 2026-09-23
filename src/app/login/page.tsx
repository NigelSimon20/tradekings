import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { BrandWordmark } from "@/components/layout/brand-wordmark";
import { Alert } from "@/components/ui/alert";
import { getConfig } from "@/lib/config/env";
import type { PageSearchParams } from "@/lib/domain/filters";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: PageSearchParams) {
  const config = getConfig();
  if (!config.auth.enabled) redirect("/");

  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : "";
  const signedOut = params.signedOut === "1";
  const google = config.auth.google !== null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 px-4 py-10">
      {/* The brand blues, thrown softly behind the card. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(42rem 30rem at 70% -10%, rgba(22,145,208,.45), transparent 62%), radial-gradient(34rem 24rem at 10% 110%, rgba(1,82,144,.65), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandWordmark tone="light" size="lg" />
          <p className="mt-3 text-sm text-white/60">Blue Collar Contract Tracker</p>
        </div>

        <div className="rounded-3xl bg-white/95 p-7 shadow-panel ring-1 ring-white/20 backdrop-blur sm:p-9">
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold text-slate-900">Sign in</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
              {google
                ? "Use the Google account your employer gave you."
                : "Enter the access password provided by the system administrator."}
            </p>
          </div>

          {error ? (
            <Alert tone="critical" title="Could not sign you in" className="mt-6">
              {error}
            </Alert>
          ) : null}
          {signedOut && !error ? (
            <Alert tone="success" className="mt-6">
              You have been signed out.
            </Alert>
          ) : null}

          <div className="mt-7">
            {google ? (
              <a
                href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
                className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-400 active:translate-y-0"
              >
                <GoogleMark />
                Continue with Google
              </a>
            ) : (
              <LoginForm next={next} />
            )}
          </div>

          <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-500">
            Access is limited to the people listed on the contract sheet. If you cannot get in, ask
            an administrator to add you.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          Trade Kings Zimbabwe (Pvt) Ltd &amp; Zimkings Trading (Pvt) Ltd
        </p>
      </div>
    </main>
  );
}

/** Google's mark, drawn inline so the page loads nothing from another origin. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 transition-transform group-hover:scale-110" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
