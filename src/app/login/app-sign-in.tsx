"use client";

import { useState, type ReactNode } from "react";

import { LoginForm } from "@/app/login/login-form";
import { BillboardIcon, CheckIcon, ContractsIcon } from "@/components/ui/icons";
import { PROJECTS, PROJECT_IDS, landingFor, type ProjectId } from "@/lib/domain/projects";
import { cn } from "@/lib/ui/cn";

const ICONS: Record<ProjectId, ReactNode> = {
  contracts: <ContractsIcon className="size-5" />,
  billboards: <BillboardIcon className="size-5" />,
};

/**
 * Choose the app, then sign in to it. The choice decides where the person
 * lands, and the sign-in is refused if their account cannot open that app.
 */
export function AppSignIn({
  initialApp,
  next,
  google,
  googleMark,
}: {
  initialApp: ProjectId;
  /** The page that sent the person here, used if it belongs to the chosen app. */
  next: string;
  google: boolean;
  googleMark: ReactNode;
}) {
  const [app, setApp] = useState<ProjectId>(initialApp);
  const landing = landingFor(app, next);

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Which app?</legend>
        <div className="grid gap-2.5">
          {PROJECT_IDS.map((id) => {
            const project = PROJECTS[id];
            const selected = id === app;
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 ring-1 transition",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600",
                  selected ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-slate-200 hover:ring-slate-300",
                )}
              >
                <input
                  type="radio"
                  name="app"
                  value={id}
                  checked={selected}
                  onChange={() => setApp(id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
                    selected ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {ICONS[id]}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-slate-900">{project.name}</span>
                  <span className="block text-xs text-slate-500">{project.description}</span>
                </span>
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full ring-1",
                    selected ? "bg-brand-700 text-white ring-brand-700" : "ring-slate-300",
                  )}
                  aria-hidden
                >
                  {selected ? <CheckIcon className="size-3.5" /> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {google ? (
        <a
          href={`/api/auth/google/start?app=${app}&next=${encodeURIComponent(landing)}`}
          className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-400 active:translate-y-0"
        >
          <span className="shrink-0">{googleMark}</span>
          <span>Continue to {PROJECTS[app].name} with Google</span>
        </a>
      ) : (
        <LoginForm next={landing} />
      )}
    </div>
  );
}
