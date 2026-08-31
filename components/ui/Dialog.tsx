"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Button, { type ButtonVariant } from "./Button";
import { cn } from "@/lib/utils/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

// Natives <dialog> statt einer eigenen Modal-Implementierung oder
// Bibliothek — Fokus-Trap und "inert" für den Hintergrund kommen dadurch
// kostenlos vom Browser (Baseline-unterstützt), siehe Plan §3.
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cn(
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-5 shadow-elevated backdrop:bg-foreground/30",
        className,
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) ref.current?.close();
      }}
    >
      {title && <h2 className="mb-3 text-title font-semibold">{title}</h2>}
      {children}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" für zerstörende Aktionen (Löschen), sonst neutrale Bestätigung. */
  variant?: Extract<ButtonVariant, "danger" | "primary">;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  variant = "primary",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      {description && <p className="mb-4 text-sm text-muted">{description}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant}
          size="sm"
          onClick={onConfirm}
          disabled={pending}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export default Dialog;
