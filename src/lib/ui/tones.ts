import type { Tone } from "@/lib/domain/meta";

/**
 * One severity palette, two renderings: Tailwind classes for the UI and hex
 * values for the weekly emails (email clients have no Tailwind). Keeping them
 * side by side means a status looks the same in the browser and the inbox.
 */
export interface ToneClasses {
  badge: string;
  surface: string;
  border: string;
  text: string;
  dot: string;
  bar: string;
}

export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  critical: {
    badge: "bg-red-100 text-red-900 ring-1 ring-inset ring-red-300",
    surface: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    dot: "bg-red-700",
    bar: "bg-red-700",
  },
  danger: {
    badge: "bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-300",
    surface: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-800",
    dot: "bg-rose-600",
    bar: "bg-rose-600",
  },
  warning: {
    badge: "bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300",
    surface: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
  },
  caution: {
    badge: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300",
    surface: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  success: {
    badge: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300",
    surface: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-600",
    bar: "bg-emerald-600",
  },
  info: {
    badge: "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-300",
    surface: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-800",
    dot: "bg-sky-600",
    bar: "bg-sky-600",
  },
  neutral: {
    badge: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300",
    surface: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
  },
};

export interface ToneColors {
  /** Badge background. */
  bg: string;
  /** Badge text. */
  fg: string;
  border: string;
  /** Strong colour for section bars. */
  solid: string;
}

export const TONE_COLORS: Record<Tone, ToneColors> = {
  critical: { bg: "#fee2e2", fg: "#7f1d1d", border: "#fca5a5", solid: "#b91c1c" },
  danger: { bg: "#ffe4e6", fg: "#9f1239", border: "#fda4af", solid: "#e11d48" },
  warning: { bg: "#ffedd5", fg: "#9a3412", border: "#fdba74", solid: "#f97316" },
  caution: { bg: "#fef3c7", fg: "#78350f", border: "#fcd34d", solid: "#f59e0b" },
  success: { bg: "#d1fae5", fg: "#065f46", border: "#6ee7b7", solid: "#059669" },
  info: { bg: "#e0f2fe", fg: "#075985", border: "#7dd3fc", solid: "#0284c7" },
  neutral: { bg: "#f1f5f9", fg: "#334155", border: "#cbd5e1", solid: "#64748b" },
};
