import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

// Gemeinsame Feld-Klassen — auch direkt verwendbar für native Elemente ohne
// eigenen Wrapper (z. B. <select>), statt für jede Variante eine eigene
// Komponente zu bauen.
export function fieldClassName(className?: string, invalid?: boolean): string {
  return cn(
    "w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-shadow duration-fast",
    invalid
      ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/15"
      : "border-border focus:border-accent focus:ring-2 focus:ring-accent/15",
    className,
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return <input className={fieldClassName(className, invalid)} {...props} />;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return <textarea className={fieldClassName(className, invalid)} {...props} />;
}

export default Input;
