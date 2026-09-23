import type { ReactNode } from "react";

import { InsecureBanner } from "@/components/layout/insecure-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/** Sidebar + sticky top bar around every signed-in page. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <InsecureBanner />
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-5 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
