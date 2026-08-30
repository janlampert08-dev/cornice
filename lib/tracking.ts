import { haversineKm } from "@/lib/geo";

// Grosszügig genug für GPS-Ungenauigkeit und Parkplätze/Zufahrten am
// Streckenanfang, aber eng genug, um zu verhindern, dass die Zeitmessung
// schon Kilometer vor dem eigentlichen Start beginnt.
export const START_PROXIMITY_KM = 0.15;
// Gleicher Toleranzwert für den Zielpunkt — die Aufzeichnung stoppt
// automatisch, sobald der Nutzer ihn erreicht.
export const END_PROXIMITY_KM = 0.15;

export interface ProximityState {
  hasStarted: boolean;
  hasLeftStart: boolean;
}

export interface ProximityResult {
  distanceToStartKm: number | null;
  shouldBeginTracking: boolean;
  hasLeftStart: boolean;
  shouldAutoStop: boolean;
}

// Reine Zustandslogik für Auto-Start/Auto-Stop beim Live-Tracking
// (components/LiveTrackingForm.tsx), extrahiert für Testbarkeit. Verhindert
// bei Rundstrecken (Start = Ziel), dass die Aufzeichnung sofort nach dem
// Start wieder stoppt: die Zielnähe-Prüfung greift erst, nachdem die
// Startnähe tatsächlich verlassen wurde (hasLeftStart), daher die
// if/else-if-Struktur — beides wird nie im selben Aufruf geprüft.
export function evaluateProximity(
  point: [number, number],
  startPoint: [number, number],
  endPoint: [number, number],
  state: ProximityState,
  startProximityKm: number = START_PROXIMITY_KM,
  endProximityKm: number = END_PROXIMITY_KM,
): ProximityResult {
  if (!state.hasStarted) {
    const distanceToStartKm = haversineKm(point, startPoint);
    return {
      distanceToStartKm,
      shouldBeginTracking: distanceToStartKm <= startProximityKm,
      hasLeftStart: state.hasLeftStart,
      shouldAutoStop: false,
    };
  }

  if (!state.hasLeftStart) {
    return {
      distanceToStartKm: null,
      shouldBeginTracking: false,
      hasLeftStart: haversineKm(point, startPoint) > endProximityKm,
      shouldAutoStop: false,
    };
  }

  return {
    distanceToStartKm: null,
    shouldBeginTracking: false,
    hasLeftStart: true,
    shouldAutoStop: haversineKm(point, endPoint) <= endProximityKm,
  };
}
