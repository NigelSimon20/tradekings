"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/ui/cn";

/** Height of one row on the wheel, in pixels. Five rows show at once. */
const ROW = 40;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ROW;

/**
 * One column of an iPhone-timer style wheel: scroll (or swipe, or use the arrow
 * keys) and the value in the middle band is the one chosen. Each row snaps into
 * place. It is a spin button to assistive technology.
 */
function WheelColumn({
  label,
  max,
  value,
  onChange,
  unit,
}: {
  label: string;
  max: number;
  value: number;
  onChange: (value: number) => void;
  /** Shown beside the middle band, like the iPhone's "hours" / "min". */
  unit: (value: number) => string;
}) {
  const column = useRef<HTMLDivElement>(null);
  // The value the wheel itself last reported, so outside changes can be told apart.
  const shown = useRef(value);
  // Where a key press or click sent the wheel, while it is still scrolling there.
  const heading = useRef<number | null>(null);

  // Follow the value when it changes from outside (e.g. after "Add").
  useEffect(() => {
    const element = column.current;
    if (!element || shown.current === value) return;
    shown.current = value;
    element.scrollTo({ top: value * ROW, behavior: "smooth" });
  }, [value]);

  // Start at the value given, without animating.
  useEffect(() => {
    if (column.current) column.current.scrollTop = shown.current * ROW;
  }, []);

  const onScroll = () => {
    const element = column.current;
    if (!element) return;
    const next = Math.min(max, Math.max(0, Math.round(element.scrollTop / ROW)));
    if (next === heading.current) heading.current = null;
    if (next !== shown.current) {
      shown.current = next;
      onChange(next);
    }
  };

  const go = (next: number) => {
    const clamped = Math.min(max, Math.max(0, next));
    heading.current = clamped;
    column.current?.scrollTo({ top: clamped * ROW, behavior: "smooth" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
    // Quick presses add up: count from where the wheel is going, not where it is.
    if (event.key in moves) go((heading.current ?? value) + moves[event.key]);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(max);
    else return;
    event.preventDefault();
  };

  return (
    <div className="relative flex items-center">
      <div
        ref={column}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unit(value)}`}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="wheel-column relative z-10 w-16 snap-y snap-mandatory overflow-y-scroll rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
        style={{ height: ROW * VISIBLE, paddingBlock: PAD, scrollPaddingBlock: PAD }}
      >
        {Array.from({ length: max + 1 }, (_, number) => (
          <button
            key={number}
            type="button"
            tabIndex={-1}
            onClick={() => go(number)}
            className={cn(
              "numeric flex w-full cursor-pointer snap-center items-center justify-end pr-2 text-xl transition-colors",
              number === value ? "font-semibold text-slate-900" : "text-slate-400",
            )}
            style={{ height: ROW }}
          >
            {number}
          </button>
        ))}
      </div>
      <span className="pointer-events-none relative z-10 w-16 pl-1 text-sm font-medium text-slate-700">{unit(value)}</span>
    </div>
  );
}

export interface Duration {
  months: number;
  days: number;
}

/**
 * Months and days on two wheels, as on the iPhone timer. The band across the
 * middle shows the choice; the rows above and below fade out.
 */
export function DurationWheel({
  value,
  onChange,
  maxMonths = 24,
}: {
  value: Duration;
  onChange: (value: Duration) => void;
  maxMonths?: number;
}) {
  return (
    <div className="wheel relative inline-flex items-center rounded-2xl bg-slate-50 px-3 ring-1 ring-slate-200">
      {/* The selection band, behind the numbers. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xs ring-1 ring-slate-200"
        style={{ height: ROW }}
      />
      <WheelColumn
        label="Months"
        max={maxMonths}
        value={value.months}
        onChange={(months) => onChange({ ...value, months })}
        unit={(months) => (months === 1 ? "month" : "months")}
      />
      <WheelColumn
        label="Days"
        max={30}
        value={value.days}
        onChange={(days) => onChange({ ...value, days })}
        unit={(days) => (days === 1 ? "day" : "days")}
      />
    </div>
  );
}
