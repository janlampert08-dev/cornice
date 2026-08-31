import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium transition-[transform,opacity,border-color,background-color] duration-fast ease-standard active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const variants: Record<ButtonVariant, string> = {
  primary:
    "rounded-full border border-foreground bg-foreground text-background hover:opacity-90",
  accent: "rounded-full border border-accent bg-accent text-background hover:opacity-90",
  secondary:
    "rounded-lg border border-border text-foreground hover:border-border-strong",
  ghost: "rounded-lg text-foreground hover:bg-surface",
  danger: "rounded-full border border-danger bg-danger text-background hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

// Zentrale Klassen-Zusammensetzung, damit dieselben Varianten auch auf
// next/link (z. B. "Zur Übersicht") angewendet werden können, ohne den
// <Button> selbst als Link zu missbrauchen.
export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
