import { haversineKm } from "@/lib/geo";

// Unter diesem Deckungsgrad (%) gilt eine Fahrt als möglicherweise abgekürzt
// oder am falschen Punkt gestartet/beendet — sie bleibt speicherbar, kann
// aber nicht öffentlich markiert werden (siehe lib/actions/completions.ts).
// Bewusst grosszügig: Alpenpässe haben Tunnel und dichten Wald, die GPS-Fixes
// zuverlässig ausfallen lassen, ohne dass der Nutzer tatsächlich abgekürzt hat.
export const COVERAGE_THRESHOLD_PERCENT = 75;

const SAMPLE_INTERVAL_KM = 0.1;
const CORRIDOR_KM = 0.08;

// Tastet die offizielle Streckengeometrie alle SAMPLE_INTERVAL_KM ab und
// prüft je Abtastpunkt, ob mindestens ein aufgezeichneter GPS-Punkt innerhalb
// des Korridors liegt. Der Anteil abgedeckter Abtastpunkte ist ein einziger,
// robuster Indikator sowohl für Abkürzungen (Lücke in der Mitte) als auch für
// falsche Start-/Endpunkte (Lücke am Rand) — keine separate Logik nötig.
export function computeRouteCoverage(
  routeCoordinates: [number, number][],
  trail: [number, number][],
): number {
  if (routeCoordinates.length < 2 || trail.length === 0) return 0;

  const samples = sampleRoute(routeCoordinates, SAMPLE_INTERVAL_KM);
  if (samples.length === 0) return 0;

  const covered = samples.filter((sample) =>
    trail.some((point) => haversineKm(sample, point) <= CORRIDOR_KM),
  ).length;

  return Math.round((covered / samples.length) * 100);
}

function sampleRoute(coords: [number, number][], intervalKm: number): [number, number][] {
  const samples: [number, number][] = [coords[0]];
  let accumulated = 0;
  for (let i = 1; i < coords.length; i++) {
    accumulated += haversineKm(coords[i - 1], coords[i]);
    if (accumulated >= intervalKm) {
      samples.push(coords[i]);
      accumulated = 0;
    }
  }
  samples.push(coords[coords.length - 1]);
  return samples;
}
