"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { logTrackedCompletion, type CompletionFormState } from "@/lib/actions/completions";
import { haversineKm, type TrailPoint } from "@/lib/geo";
import { interpolateElevation } from "@/lib/elevation";
import { computeRouteCoverage, COVERAGE_THRESHOLD_PERCENT } from "@/lib/routeCoverage";
import { formatDuration } from "@/lib/format";
import PhotoInput from "@/components/PhotoInput";
import RouteMap from "@/components/RouteMap";
import { GlobeIcon, LockIcon } from "@/components/VisibilityIcons";
import type { RouteGeoJSON, Vehicle } from "@/types/database";

const initialState: CompletionFormState = { error: null };
const MIN_ACCURACY_M = 50;
const MIN_SEGMENT_KM = 0.005;
const MAX_NOTIZ_LENGTH = 280;
// Grosszügig genug für GPS-Ungenauigkeit und Parkplätze/Zufahrten am
// Streckenanfang, aber eng genug, um zu verhindern, dass die Zeitmessung
// schon Kilometer vor dem eigentlichen Start beginnt.
const START_PROXIMITY_KM = 0.15;

type Phase = "idle" | "tracking" | "finished";

export default function LiveTrackingForm({
  route,
  vehicles,
  personalBestSeconds,
  onExit,
}: {
  route: RouteGeoJSON;
  vehicles: Vehicle[];
  personalBestSeconds: number | null;
  onExit: () => void;
}) {
  const action = logTrackedCompletion.bind(null, route.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  // Stabile Array-Referenz für RouteMap — ein neues [route]-Literal bei
  // jedem Render würde RouteMaps "routes"-Effekt (Kartenausschnitt neu
  // fitten) bei jedem GPS-Update erneut auslösen und die Ansicht ständig
  // zurücksetzen, obwohl sich die Strecke selbst nie ändert.
  const routes = useMemo(() => [route], [route]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<{ distanceKm: number; seconds: number } | null>(null);
  const [coveragePercent, setCoveragePercent] = useState<number | null>(null);
  const [trailJson, setTrailJson] = useState("[]");
  const [hasStarted, setHasStarted] = useState(false);
  const [distanceToStartKm, setDistanceToStartKm] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const belowCoverageThreshold =
    coveragePercent !== null && coveragePercent < COVERAGE_THRESHOLD_PERCENT;
  const notizLength = notiz.length;

  // Nach erfolgreichem Speichern automatisch zurück zur normalen
  // Streckenansicht — sonst wäre der neue Vollbild-Fazit-Screen eine
  // Sackgasse ohne Ausweg.
  useEffect(() => {
    if (submitted && !pending && !state.error) onExit();
  }, [submitted, pending, state.error, onExit]);

  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<[number, number] | null>(null);
  const lastPointTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Spiegelt hasStarted für den watchPosition-Callback — der Callback ist
  // eine einmal beim Start erzeugte Closure und würde sonst den veralteten
  // Wert aus dem ersten Render sehen, statt auf die Ref-gestützte Prüfung
  // pro GPS-Update aktuell zuzugreifen.
  const hasStartedRef = useRef(false);

  // Verhindert, dass der Bildschirm während der Aufzeichnung automatisch
  // gesperrt wird (wie bei einem laufenden Video) — GPS-Tracking im Browser
  // pausiert sonst, sobald der Screen ausgeht. Kein Fehler, wenn die Wake-
  // Lock-API fehlt (z.B. Safari/iOS) oder die Freigabe verweigert wird —
  // Tracking funktioniert dann einfach ohne diese Garantie weiter.
  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      wakeLockRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      wakeLockRef.current?.release();
    };
  }, []);

  // Der Wake Lock wird vom Browser automatisch freigegeben, sobald der Tab
  // in den Hintergrund wechselt (z.B. App-Wechsel) — bei Rückkehr während
  // laufender Aufzeichnung erneut anfragen, statt den Nutzer selbst merken
  // zu lassen, dass der Schutz weg ist.
  useEffect(() => {
    if (phase !== "tracking") return;
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && wakeLockRef.current === null) {
        requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [phase]);

  // Startet die eigentliche Zeitmessung — entweder automatisch, sobald die
  // Näherungsprüfung im GPS-Callback anschlägt, oder manuell über den
  // Notfall-Button (falls die GPS-Genauigkeit am Startpunkt selbst nicht
  // gut genug ist, um automatisch unter START_PROXIMITY_KM zu fallen).
  function beginActualTracking() {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    setHasStarted(true);
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - (startTimeRef.current ?? Date.now())) / 1000));
    }, 1000);
  }

  function handleStart() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }

    setLocationError(null);
    setDistanceKm(0);
    setElapsedSeconds(0);
    setCurrentSpeedKmh(null);
    setCurrentPosition(null);
    setCoveragePercent(null);
    setTrailJson("[]");
    setHasStarted(false);
    setDistanceToStartKm(null);
    hasStartedRef.current = false;
    lastPointRef.current = null;
    lastPointTimeRef.current = null;
    trailRef.current = [];
    startTimeRef.current = null;

    const startPoint = route.start_geojson.coordinates as [number, number];

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // Standort-Marker immer aktualisieren, unabhängig von der GPS-
        // Genauigkeit — sonst bleibt er bei realer (oft > 50m ungenauer)
        // Standortermittlung dauerhaft unsichtbar. Nur die Distanz-/Tempo-
        // Berechnung filtert weiterhin auf ausreichend genaue Punkte.
        const point: [number, number] = [position.coords.longitude, position.coords.latitude];
        setCurrentPosition(point);

        // Zeitmessung/Distanz erst ab dem Startpunkt — bis dahin läuft nur
        // die Karte mit, damit der Nutzer die Anfahrt verfolgen kann, ohne
        // dass sich das schon in der Fahrzeit niederschlägt.
        if (!hasStartedRef.current) {
          const distToStart = haversineKm(point, startPoint);
          setDistanceToStartKm(distToStart);
          if (distToStart <= START_PROXIMITY_KM) beginActualTracking();
          return;
        }

        // Explizit auf null/undefined statt auf Falsy prüfen: accuracy kann
        // gültig 0 sein (z.B. bei manchen Emulatoren) — ein truthy-Check
        // (`accuracy &&`) würde einen 0-Wert fälschlich als "genau genug"
        // durchlassen, statt ihn wie jeden anderen Wert gegen MIN_ACCURACY_M
        // zu prüfen.
        if (position.coords.accuracy != null && position.coords.accuracy > MIN_ACCURACY_M) return;
        const now = Date.now();

        // Für den späteren Deckungsgrad-Check (computeRouteCoverage) und die
        // serverseitige Neuberechnung von Distanz/Dauer (siehe
        // lib/actions/completions.ts) — nur ausreichend genaue Punkte, damit
        // Ungenauigkeit nicht fälschlich als "war dort" zählt.
        trailRef.current.push({ lng: point[0], lat: point[1], t: now });

        if (lastPointRef.current) {
          const segment = haversineKm(lastPointRef.current, point);
          if (segment > MIN_SEGMENT_KM) {
            const dtHours = (now - (lastPointTimeRef.current ?? now)) / 3_600_000;
            const gpsSpeedKmh =
              position.coords.speed !== null && position.coords.speed !== undefined
                ? position.coords.speed * 3.6
                : null;
            setCurrentSpeedKmh(gpsSpeedKmh ?? (dtHours > 0 ? segment / dtHours : null));
            setDistanceKm((d) => d + segment);
            lastPointRef.current = point;
            lastPointTimeRef.current = now;
          }
        } else {
          lastPointRef.current = point;
          lastPointTimeRef.current = now;
        }
      },
      () => setLocationError("Standort konnte nicht ermittelt werden."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15_000 },
    );

    requestWakeLock();
    setPhase("tracking");
  }

  // Der Timer ist nicht mehr optional — ein Klick auf "Strecke starten" (in
  // GefahrenSection) mountet dieses Formular und die Aufzeichnung beginnt
  // sofort, ohne einen zweiten Bestätigungsschritt. setTimeout verschiebt
  // den Start in einen Callback (statt synchron im Effekt-Body), damit die
  // darin ausgelösten setState-Aufrufe nicht als Render-Kaskade zählen.
  useEffect(() => {
    const t = setTimeout(() => handleStart(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vor Erreichen des Startpunkts gibt es noch nichts zu speichern —
  // "Abbrechen" verlässt die Aufzeichnung direkt, statt über den
  // Fazit-Screen mit lauter Nullwerten zu gehen.
  function handleCancelWaiting() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
    onExit();
  }

  function handleStop() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchIdRef.current = null;
    intervalRef.current = null;
    wakeLockRef.current?.release();
    wakeLockRef.current = null;

    setResult({ distanceKm, seconds: elapsedSeconds });
    setCoveragePercent(
      computeRouteCoverage(
        route.geometry_geojson.coordinates as [number, number][],
        trailRef.current.map((p) => [p.lng, p.lat] as [number, number]),
      ),
    );
    setTrailJson(JSON.stringify(trailRef.current));
    setPhase("finished");
  }

  if (phase === "idle") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#FAFAFA] px-6 text-center">
        {locationError ? (
          <>
            <p className="text-sm text-red-600">{locationError}</p>
            <button
              type="button"
              onClick={onExit}
              className="border border-[#131316]/30 px-4 py-2 text-sm text-[#8A8F98] hover:border-[#131316]"
            >
              Zurück
            </button>
          </>
        ) : (
          <p className="text-sm text-[#8A8F98]">Standort wird ermittelt…</p>
        )}
      </div>
    );
  }

  if (phase === "tracking") {
    const remainingKm = route.laenge_km > 0 ? Math.max(route.laenge_km - distanceKm, 0) : null;
    const currentElevationM = route.hoehenprofil
      ? interpolateElevation(route.hoehenprofil, distanceKm)
      : null;

    // Volle Bildschirmfläche statt eines Inline-Blocks in der Streckenansicht
    // — während einer laufenden Aufzeichnung sind die Streckendetails
    // ausgeblendet, stattdessen zeigt die Karte Route und Live-Standort.
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#FAFAFA]">
        <div className="min-h-0 flex-1">
          <RouteMap routes={routes} userLocation={currentPosition} />
        </div>
        <div className="flex flex-col gap-3 border-t border-[#131316]/20 bg-[#FAFAFA] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8F98]">
            {hasStarted ? "Aufzeichnung läuft" : "Unterwegs zum Start"}
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <dt className="text-xs text-[#8A8F98]">Distanz</dt>
              <dd className="font-mono text-xl tabular-nums">{distanceKm.toFixed(2)} km</dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A8F98]">Zeit</dt>
              <dd className="font-mono text-xl tabular-nums">{formatDuration(elapsedSeconds)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A8F98]">Tempo</dt>
              <dd className="font-mono text-lg tabular-nums">
                {currentSpeedKmh !== null ? `${currentSpeedKmh.toFixed(0)} km/h` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A8F98]">Höhe</dt>
              <dd className="font-mono text-lg tabular-nums">
                {currentElevationM !== null ? `${currentElevationM} m` : "—"}
              </dd>
            </div>
            {remainingKm !== null && (
              <div>
                <dt className="text-xs text-[#8A8F98]">Noch</dt>
                <dd className="font-mono text-lg tabular-nums">{remainingKm.toFixed(1)} km</dd>
              </div>
            )}
          </dl>
          {!hasStarted && (
            <p className="text-sm text-[#8A8F98]">
              <span className="font-medium text-[#131316]">Fahre zum Startpunkt</span> —{" "}
              {distanceToStartKm !== null
                ? `noch ca. ${
                    distanceToStartKm < 1
                      ? `${Math.round(distanceToStartKm * 1000)} m`
                      : `${distanceToStartKm.toFixed(1)} km`
                  }, die Zeitmessung startet automatisch, sobald du dort bist.`
                : "Standort wird ermittelt…"}
            </p>
          )}
          {locationError && <p className="text-sm text-red-600">{locationError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {hasStarted ? (
              <button
                type="button"
                onClick={handleStop}
                className="border border-[#131316] bg-[#131316] px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90"
              >
                Strecke beenden
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelWaiting}
                  className="border border-[#131316]/30 px-4 py-2 text-sm text-[#8A8F98] hover:border-[#131316]"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={beginActualTracking}
                  className="text-xs text-[#3D5AFE] hover:underline"
                >
                  Bin schon am Start
                </button>
              </div>
            )}
            <p className="text-xs text-[#8A8F98]">
              Bildschirm eingeschaltet lassen — GPS-Tracking im Browser pausiert sonst.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // phase === "finished" — Fazit als eigener Vollbild-Screen, keine
  // Streckendetails/Karte mehr im Blick.
  const avgKmh = result && result.seconds > 0 ? result.distanceKm / (result.seconds / 3600) : null;
  const isNewBest = result !== null && (personalBestSeconds === null || result.seconds < personalBestSeconds);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#FAFAFA]">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 py-8 sm:px-6 sm:py-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">Fazit</h2>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[#8A8F98]">Distanz</dt>
            <dd className="font-mono text-lg tabular-nums">{result?.distanceKm.toFixed(2)} km</dd>
          </div>
          <div>
            <dt className="text-[#8A8F98]">Zeit</dt>
            <dd className="font-mono text-lg tabular-nums">{formatDuration(result?.seconds ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-[#8A8F98]">Ø Tempo</dt>
            <dd className="font-mono text-lg tabular-nums">{avgKmh?.toFixed(0)} km/h</dd>
          </div>
        </dl>

        {isNewBest ? (
          <p className="border border-[#3D5AFE] bg-[#3D5AFE]/5 px-3 py-2 text-sm font-medium text-[#3D5AFE]">
            {personalBestSeconds === null
              ? "Erste erfasste Zeit für diese Strecke."
              : `Neue persönliche Bestzeit — bisher ${formatDuration(personalBestSeconds)}.`}
          </p>
        ) : (
          <p className="text-sm text-[#8A8F98]">
            Bisherige Bestzeit: {formatDuration(personalBestSeconds ?? 0)}
          </p>
        )}

        <form
          action={formAction}
          onSubmit={() => setSubmitted(true)}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="ist_oeffentlich" value={isPublic ? "true" : "false"} />
          {/* distanz_km/dauer_sekunden/abdeckung_prozent werden serverseitig
              aus trail neu berechnet (lib/actions/completions.ts) — hier nur
              der aufgezeichnete GPS-Trail als Rohdaten, keine vom Client
              berechneten Werte, denen vertraut würde. */}
          <input type="hidden" name="trail" value={trailJson} />

          <div className="flex flex-col gap-1 text-sm">
            Fahrzeug
            {vehicles.length > 0 ? (
              <select
                name="fahrzeug_id"
                className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
              >
                <option value="">—</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marke} {v.modell}
                  </option>
                ))}
              </select>
            ) : (
              <a
                href="/profil/fahrzeuge/neu"
                target="_blank"
                rel="noopener noreferrer"
                className="self-start text-sm text-[#3D5AFE] hover:underline"
              >
                + Fahrzeug hinzufügen
              </a>
            )}
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-baseline justify-between">
              <label htmlFor="tracking-notiz">Notiz (optional)</label>
              <span className="font-mono text-xs tabular-nums text-[#8A8F98]">
                {notizLength}/{MAX_NOTIZ_LENGTH}
              </span>
            </div>
            <textarea
              id="tracking-notiz"
              name="notiz"
              rows={2}
              maxLength={MAX_NOTIZ_LENGTH}
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="z.B. nasse Fahrbahn, mit der Ducati…"
              className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
            />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            Sichtbarkeit
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm ${
                  !isPublic
                    ? "border-[#131316] bg-[#131316] text-[#FAFAFA]"
                    : "border-[#131316]/30 text-[#8A8F98] hover:border-[#131316]"
                }`}
              >
                <LockIcon className="h-4 w-4" />
                Privat
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                disabled={belowCoverageThreshold}
                title={
                  belowCoverageThreshold
                    ? `Deckt nur ${coveragePercent}% der Strecke ab — kann nicht öffentlich gemacht werden.`
                    : undefined
                }
                className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  isPublic
                    ? "border-[#131316] bg-[#131316] text-[#FAFAFA]"
                    : "border-[#131316]/30 text-[#8A8F98] hover:enabled:border-[#131316]"
                }`}
              >
                <GlobeIcon className="h-4 w-4" />
                Öffentlich
              </button>
            </div>
            <p className="text-xs text-[#8A8F98]">
              {belowCoverageThreshold
                ? `Diese Fahrt deckt nur ${coveragePercent}% der offiziellen Strecke ab — evtl. abgekürzt oder am falschen Punkt gestartet/beendet. Sie bleibt privat gespeichert, kann aber nicht öffentlich geteilt werden.`
                : isPublic
                  ? "Öffentlich: erscheint auf Bestenlisten und deinem öffentlichen Profil. Später jederzeit umschaltbar."
                  : "Privat: nur du siehst diese Fahrt in deinem Profil, für andere bleibt sie unsichtbar. Später jederzeit umschaltbar."}
            </p>
          </div>

          <PhotoInput name="foto" id="tracking-foto" />

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="border border-[#131316] bg-[#131316] px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Speichern…" : "Fahrt speichern"}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="border border-[#131316]/30 px-4 py-2 text-sm text-[#8A8F98] hover:border-[#131316]"
            >
              Verwerfen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
