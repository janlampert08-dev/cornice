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
