import OfflineRetryButton from "@/components/OfflineRetryButton";

export const metadata = {
  title: "Offline – Cornice",
};

// Statischer Fallback, den der Service Worker (public/sw.js) bei
// Navigations-Requests ohne Netzwerkverbindung ausliefert, statt der
// generischen Offline-Seite des Browsers. Keine Live-Daten, keine
// Interaktivität ausser dem Retry-Button — bewusst so minimal wie möglich.
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">Cornice</p>
      <h1 className="text-lg font-medium text-foreground">Du bist offline</h1>
      <p className="max-w-xs text-sm text-muted">
        Diese Seite braucht eine Verbindung, die gerade nicht besteht. Läuft gerade eine
        Fahrt-Aufzeichnung, ist sie lokal gesichert und geht nicht verloren.
      </p>
      <OfflineRetryButton />
    </div>
  );
}
