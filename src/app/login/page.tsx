import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { BrandWordmark } from "@/components/layout/brand-wordmark";
import { Alert } from "@/components/ui/alert";
import { getConfig } from "@/lib/config/env";

export const dynamic = "force-dynamic";

const POINTS = [
  "Contract expiries tracked for both companies",
  "Zimkings 5-contract and casual 6-contract limits applied automatically",
  "Weekly reports for HR and every manager",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const config = getConfig();
  if (!config.auth.enabled) redirect("/");

  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : "";
  const signedOut = params.signedOut === "1";
  const google = config.auth.google !== null;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(36rem 24rem at 80% 0%, rgba(22,145,208,.45), transparent 60%), radial-gradient(28rem 20rem at 0% 100%, rgba(1,82,144,.55), transparent 65%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <BrandWordmark tone="light" size="lg" />
        </div>

        <div className="relative">
          <h1 className="font-display max-w-md text-3xl leading-tight font-semibold text-white">
            Blue Collar Contract Tracker
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/70">
            Trade Kings Zimbabwe &amp; Zimkings Trading — one place for blue collar and casual
            contracts, their limits and their renewals.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          This system holds employee information. Access is limited to the people listed on the
          Users tab of the contract sheet.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandWordmark size="md" />
          </div>

          <h2 className="font-display text-xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            {google
              ? "Use the Google account your employer gave you."
              : "Enter the access password provided by the system administrator."}
          </p>

          {error ? (
            <Alert tone="critical" title="Could not sign you in" className="mt-5">
              {error}
            </Alert>
          ) : null}
          {signedOut && !error ? (
            <Alert tone="success" className="mt-5">
              You have been signed out.
            </Alert>
          ) : null}

          <div className="mt-6 space-y-5 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
            {google ? (
              <a
                href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 hover:ring-slate-400"
              >
                <GoogleMark />
                Continue with Google
              </a>
            ) : null}

            {google && config.auth.password ? (
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            ) : null}

            {config.auth.password ? <LoginForm next={next} /> : null}
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Not on the list yet? Ask an administrator to add you.{" "}
            <Link href="/" className="underline">
              Back to the tracker
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

/** Google's mark, drawn inline so the page loads nothing from another origin. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
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
