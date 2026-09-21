import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900 focus-visible:outline-brand-700",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-xs hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300 focus-visible:outline-brand-600",
  subtle:
    "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100 hover:bg-brand-100 focus-visible:outline-brand-600",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:outline-red-700",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9.5 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
};

const BASE =
  "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0";

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button {...props} className={buttonClasses(variant, size, className)} />;
}

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  prefetch?: boolean;
}

export function ButtonLink({ href, children, variant, size, className, prefetch }: ButtonLinkProps) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}

/** Square icon-only button, used in toolbars. */
export function IconButton({
  label,
  className,
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS[variant], "size-9.5", className)}
    />
  );
}
