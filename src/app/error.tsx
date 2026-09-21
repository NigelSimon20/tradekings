"use client";

import Link from "next/link";
import { useEffect } from "react";

import { BrandWordmark } from "@/components/layout/brand-wordmark";

/**
 * Shown when a page cannot load — usually because the Google Sheet is
 * unreachable. People see plain language and what to do next; the underlying
 * message is kept out of the way for whoever maintains the system.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        <BrandWordmark size="sm" className="mb-5 block" />
        <h1 className="font-display text-lg font-semibold text-slate-900">
          This page could not be loaded
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The tracker could not reach the contract database just now. Try again in a moment — if it
          keeps happening, let your system administrator know.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="inline-flex h-9 items-center rounded-xl bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
          >
            Back to the dashboard
          </Link>
        </div>

        <details className="mt-5 text-xs text-slate-500">
          <summary className="cursor-pointer select-none hover:text-slate-700">
            Details for the system administrator
          </summary>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 break-words text-slate-600">
            {error.message}
          </p>
        </details>
      </div>
    </main>
  );
}
