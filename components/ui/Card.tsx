import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Für tatsächlich schwebende Flächen (Dropdowns, Tooltips) statt nur
   *  ruhende Listen-/Inhaltsflächen — siehe --shadow-elevated in globals.css. */
  elevated?: boolean;
  /** Leicht abgesetzter Untergrund für verschachtelte Flächen (z. B. Karte in Karte). */
  surface?: boolean;
  /** Anderes Element als <div> rendern (z. B. "ul", "dl") — spart einen
   *  zusätzlichen Wrapper, wenn die Karte direkt eine Liste ist. */
  as?: ElementType;
}

export default function Card({ elevated, surface, as: Component = "div", className, ...props }: CardProps) {
  return (
    <Component
      className={cn(
        "rounded-lg border border-border",
        surface ? "bg-surface" : "bg-background",
        elevated && "shadow-elevated",
        className,
      )}
      {...props}
    />
  );
}
