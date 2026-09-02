export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// laenge_km kommt bei serverseitig aus der Route-Geometrie berechneten
// Strecken (ST_Length, siehe propose_route_full) mit voller Float-Präzision
// aus der DB — ungerundet für die Anzeige ungeeignet.
export function formatKm(laengeKm: number): string {
  return laengeKm.toFixed(1);
}

// Kalenderdatum (YYYY-MM-DD) in der Zeitzone Europe/Zurich statt UTC — für
// eine Fahrt, die spätabends oder früh morgens Ortszeit eingetragen wird,
// weicht das UTC-Datum sonst um einen Tag vom tatsächlichen lokalen Tag ab
// (z.B. 00:30 Uhr CEST im Sommer ist noch 22:30 Uhr UTC des Vortags).
// en-CA formatiert direkt als YYYY-MM-DD, ohne die Teile manuell wieder
// zusammensetzen zu müssen.
export function todayInZurich(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
