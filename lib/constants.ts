// Geografischer Standard-Mittelpunkt: Zürich HB.
export const ZURICH_CENTER: [number, number] = [8.5417, 47.3769];
export const DEFAULT_ZOOM = 10.5;

export const KATEGORIEN = [
  { value: "kurvig", label: "Kurvig" },
  { value: "scenic", label: "Aussichtsreich" },
  { value: "passstrasse", label: "Passstrasse" },
  { value: "freie_fahrt", label: "Freie Fahrt" },
] as const;

// Gold/Silber/Bronze für die Top 3 einer Bestenliste — an mehreren Stellen
// verwendet (RouteLeaderboardPreview.tsx, app/leaderboards/page.tsx), daher
// hier zentral statt mehrfach dupliziert.
export const MEDAL_COLORS = ["#D4AF37", "#A8A9AD", "#CD7F32"] as const;

// Feste Werte statt Freitext, damit die Moderationswarteschlange (siehe
// lib/moderation.ts) filter-/auswertbar bleibt — ein optionaler
// Freitextkommentar ergänzt bei Bedarf.
//
// Bewusst hier statt in lib/actions/reports.ts: eine Datei mit der
// "use server"-Direktive darf laut Next.js/React nur async Functions
// exportieren. Eine einfache Konstante wie diese wird von der
// Client-Reference-Manifest-Transformation dieser Dateien nicht abgebildet
// und kommt im Client-Bundle als undefined an — genau das liess
// ReportDialog.tsx (Client Component) mit "REPORT_REASONS.map is not a
// function" abstürzen, sobald die Seite über einen Client-seitigen
// Navigationspfad statt eines vollen Seitenladens gerendert wurde.
export const REPORT_REASONS = [
  { value: "unangemessen", label: "Unangemessener Inhalt" },
  { value: "spam", label: "Spam" },
  { value: "falsche_angaben", label: "Falsche Angaben" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

// Leben bewusst auf der Marketing-Domain statt als eigene Routen hier —
// Erreichbarkeit per Link genügt, unabhängig vom Hosting-Ort.
// TODO: Platzhalter-Domain durch die echte Marketing-Domain ersetzen.
export const LEGAL_URLS = {
  impressum: "https://xyz.ch/impressum",
  datenschutz: "https://xyz.ch/datenschutz",
  agb: "https://xyz.ch/agb",
} as const;
