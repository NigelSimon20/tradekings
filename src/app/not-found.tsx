import Link from "next/link";

import { BrandWordmark } from "@/components/layout/brand-wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <BrandWordmark size="md" className="mb-6 block" />
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">404</p>
        <h1 className="font-display mt-2 text-lg font-semibold text-slate-900">That contract could not be found</h1>
        <p className="mt-2 text-sm text-slate-600">
          It may have been removed from the sheet, or the link may be out of date.
        </p>
        <Link
          href="/contracts"
          className="mt-5 inline-flex h-9 items-center rounded-xl bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
        >
          Back to contracts
        </Link>
      </div>
    </main>
  );
}
