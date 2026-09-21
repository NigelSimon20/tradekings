import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { BrandWordmark } from "@/components/layout/brand-wordmark";
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

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(36rem 24rem at 80% 0%, rgba(34,155,208,.45), transparent 60%), radial-gradient(28rem 20rem at 0% 100%, rgba(34,95,147,.55), transparent 65%)",
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
          This system holds employee information. Access is limited to HR and administrators.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandWordmark size="md" />
          </div>

          <h2 className="font-display text-xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the access password provided by the system administrator.
          </p>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
            <LoginForm next={next} />
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Trouble signing in? Contact the system administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
