import OfflineRetryButton from "@/components/OfflineRetryButton";
import StatusPage from "@/components/ui/StatusPage";

export const metadata = {
  title: "Offline – Cornice",
};

// Statischer Fallback, den der Service Worker (public/sw.js) bei
// Navigations-Requests ohne Netzwerkverbindung ausliefert, statt der
// generischen Offline-Seite des Browsers. Keine Live-Daten, keine
// Interaktivität ausser dem Retry-Button — bewusst so minimal wie möglich.
export default function OfflinePage() {
  return (
    <StatusPage
      eyebrow="Cornice"
      title="Du bist offline"
      description="Diese Seite braucht eine Verbindung, die gerade nicht besteht. Läuft gerade eine Fahrt-Aufzeichnung, ist sie lokal gesichert und geht nicht verloren."
    >
      <OfflineRetryButton />
    </StatusPage>
  );
}
