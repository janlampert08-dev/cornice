"use client";

export default function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition-transform active:scale-95 hover:opacity-90"
    >
      Erneut versuchen
    </button>
  );
}
