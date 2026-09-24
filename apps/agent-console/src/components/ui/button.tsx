import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-ui-ink bg-opacity-95 text-white hover:bg-ui-ink border-ui-ink/90 shadow-sm",
    secondary: "glass-control text-ui-ink hover:bg-ui-surface/90 border-ui-border/80",
    ghost: "bg-transparent text-ui-muted hover:bg-ui-subtle/80 border-transparent hover:text-ui-ink",
    danger: "bg-red-600 text-white hover:bg-red-700 border-red-600",
  };

  return (
    <button
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-[background-color,color,border-color,transform,box-shadow] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
