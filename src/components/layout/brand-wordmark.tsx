import { cn } from "@/lib/ui/cn";

const SIZES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

/**
 * The application's mark.
 *
 * The tracker covers two companies, so it carries neither company's logo — just
 * both names, set in the heading face with the separator picked out in the
 * accent blue.
 */
export function BrandWordmark({
  tone = "dark",
  size = "md",
  className,
}: {
  tone?: "dark" | "light";
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-display font-semibold tracking-tight",
        SIZES[size],
        tone === "light" ? "text-white" : "text-slate-900",
        className,
      )}
    >
      Trade Kings
      <span className={cn("mx-1.5", tone === "light" ? "text-accent-400" : "text-accent-500")}>·</span>
      Zimkings
    </span>
  );
}
