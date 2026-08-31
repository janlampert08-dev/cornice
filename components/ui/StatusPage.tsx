import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants, type ButtonVariant } from "./Button";
import { cn } from "@/lib/utils/cn";

interface BaseAction {
  label: string;
  variant?: ButtonVariant;
}
type StatusPageAction =
  | (BaseAction & { href: string; onClick?: never })
  | (BaseAction & { onClick: () => void; href?: never });

interface StatusPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: StatusPageAction[];
  children?: ReactNode;
  className?: string;
}

// Gemeinsames Layout für error.tsx / not-found.tsx / offline/page.tsx —
// bisher drei fast identische, unabhängig gepflegte Centered-Column-Layouts.
export default function StatusPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: StatusPageProps) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-center",
        className,
      )}
    >
      {eyebrow && (
        <p className="text-sm font-semibold tracking-wide text-muted uppercase">{eyebrow}</p>
      )}
      <h1 className="text-lg font-medium text-foreground">{title}</h1>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {actions && actions.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-3">
          {actions.map((action) =>
            "href" in action && action.href ? (
              <Link
                key={action.label}
                href={action.href}
                className={buttonVariants({ variant: action.variant ?? "secondary" })}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                onClick={action.onClick}
                className={buttonVariants({ variant: action.variant ?? "primary" })}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
      {children}
    </div>
  );
}
