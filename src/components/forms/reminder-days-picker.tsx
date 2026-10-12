"use client";

import { useState } from "react";

import { DurationWheel, type Duration } from "@/components/forms/duration-wheel";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/ui/cn";

/** A month on the wheel is 30 days; reminders are kept as days. */
const MONTH = 30;
/** Matches what the server accepts (`parseReminderDays`). */
const MAX_DAYS = 730;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** 90 → "3 months", 75 → "2 months 15 days", 7 → "7 days". */
function describeDuration(total: number): string {
  const months = Math.floor(total / MONTH);
  const days = total % MONTH;
  return [months ? plural(months, "month") : "", days ? plural(days, "day") : ""].filter(Boolean).join(" ");
}

/** "3 months, 2 months and 7 days" */
const listed = (days: number[]) => {
  const words = days.map(describeDuration);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : (words[0] ?? "");
};

/**
 * When expiry reminders go out: pick months and days on a wheel, as on the
 * iPhone timer, and add it; each reminder shows as a chip that can be removed.
 * Sends `name` as "90, 60, 30, 7" (days), so the server reads it as it always has.
 */
export function ReminderDaysPicker({
  name = "reminderDays",
  initial,
  defaults,
  error,
}: {
  name?: string;
  initial: number[];
  /** What "Reset" goes back to, and what applies if nothing is chosen. */
  defaults: number[];
  error?: string;
}) {
  const sorted = (list: number[]) => [...new Set(list)].sort((a, b) => b - a);
  const [days, setDays] = useState(() => sorted(initial));
  const [wheel, setWheel] = useState<Duration>({ months: 1, days: 0 });
  const [problem, setProblem] = useState("");

  const total = wheel.months * MONTH + wheel.days;
  const add = () => {
    if (total < 1) return setProblem("Turn the wheel to at least 1 day.");
    if (total > MAX_DAYS) return setProblem("Reminders can be at most 24 months (730 days) before expiry.");
    if (days.includes(total)) return setProblem(`There is already a reminder ${describeDuration(total)} before.`);
    setProblem("");
    setDays(sorted([...days, total]));
  };
  const remove = (day: number) => {
    setProblem("");
    setDays(days.filter((value) => value !== day));
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={days.join(", ")} />

      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="flex w-fit flex-col gap-3">
          <DurationWheel value={wheel} onChange={(next) => (setWheel(next), setProblem(""))} />
          <Button type="button" variant="secondary" size="sm" onClick={add} className="w-full justify-center">
            <PlusIcon className="size-4" />
            Add {total ? `${describeDuration(total)} before` : "reminder"}
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Reminders</p>
          {days.length ? (
            <ul className="flex flex-wrap gap-2">
              {days.map((day) => (
                <li key={day}>
                  <button
                    type="button"
                    onClick={() => remove(day)}
                    title="Remove this reminder"
                    aria-label={`Remove the reminder ${describeDuration(day)} before expiry`}
                    className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand-700 py-1.5 pr-2.5 pl-3.5 text-sm font-medium text-white transition hover:bg-brand-800"
                  >
                    {describeDuration(day)} before
                    <span aria-hidden className="text-white/60 group-hover:text-white">
                      ✕
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">None yet — turn the wheel and press Add.</p>
          )}
          <button
            type="button"
            onClick={() => (setDays(sorted(defaults)), setProblem(""))}
            className="cursor-pointer text-xs font-medium text-brand-700 hover:underline"
          >
            Reset to {listed(sorted(defaults))}
          </button>
        </div>
      </div>

      <p className={cn("text-xs", problem || error ? "font-medium text-red-600" : "text-slate-500")}>
        {problem ||
          error ||
          (days.length
            ? `A reminder goes out ${listed(days)} before something expires, and once more when it expires.`
            : `Nothing chosen — the defaults (${listed(sorted(defaults))} before) will be used.`)}
      </p>
    </div>
  );
}
