"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { logTrackedCompletion, type CompletionFormState } from "@/lib/actions/completions";
import { addVehicleInline } from "@/lib/actions/vehicles";
import { haversineKm, type TrailPoint } from "@/lib/geo";
import { interpolateElevation } from "@/lib/elevation";
import { computeRouteCoverage, COVERAGE_THRESHOLD_PERCENT } from "@/lib/routeCoverage";
import { formatDuration } from "@/lib/format";
import PhotoInput from "@/components/PhotoInput";
import { GlobeIcon, LockIcon } from "@/components/VisibilityIcons";
import type { RouteGeoJSON, Vehicle } from "@/types/database";

// Siehe ExploreView.tsx für die Begründung des dynamischen Imports.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-background" />,
});

const initialState: CompletionFormState = { error: null };
const MIN_ACCURACY_M = 50;
const MIN_SEGMENT_KM = 0.005;
const MAX_NOTIZ_LENGTH = 280;
// Grosszügig genug für GPS-Ungenauigkeit und Parkplätze/Zufahrten am
// Streckenanfang, aber eng genug, um zu verhindern, dass die Zeitmessung
// schon Kilometer vor dem eigentlichen Start beginnt.
const START_PROXIMITY_KM = 0.15;
// Gleicher Toleranzwert für den Zielpunkt — die Aufzeichnung stoppt
// automatisch, sobald der Nutzer ihn erreicht.
const END_PROXIMITY_KM = 0.15;

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

  // Fahrzeug-Liste lokal gehalten und ohne Navigation ergänzbar (siehe
  // handleAddVehicle) — ein <a target="_blank"> zu /profil/fahrzeuge/neu
  // (frühere Lösung) verlässt sich darauf, dass der Browser wirklich einen
  // neuen Tab öffnet; tut er das nicht (z.B. manche mobilen/PWA-Kontexte),
  // navigiert der aktuelle Tab weg und die komplette, nur im Speicher
  // gehaltene Aufzeichnung geht verloren.
  const [vehicleList, setVehicleList] = useState<Vehicle[]>(vehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicleTyp, setNewVehicleTyp] = useState("auto");
  const [newVehicleMarke, setNewVehicleMarke] = useState("");
  const [newVehicleModell, setNewVehicleModell] = useState("");
  const [newVehicleGetriebe, setNewVehicleGetriebe] = useState("manuell");
  const [newVehicleBaujahr, setNewVehicleBaujahr] = useState("");
  const [addVehicleError, setAddVehicleError] = useState<string | null>(null);
  const [addVehiclePending, startAddVehicleTransition] = useTransition();

  function handleAddVehicle() {
    setAddVehicleError(null);
    const formData = new FormData();
    formData.set("typ", newVehicleTyp);
    formData.set("marke", newVehicleMarke);
    formData.set("modell", newVehicleModell);
    formData.set("getriebe", newVehicleGetriebe);
    formData.set("baujahr", newVehicleBaujahr);

    startAddVehicleTransition(async () => {
      const result = await addVehicleInline(formData);
      if (result.error || !result.vehicle) {
        setAddVehicleError(result.error ?? "Fahrzeug konnte nicht gespeichert werden.");
        return;
      }
      setVehicleList((list) => [...list, result.vehicle as Vehicle]);
      setSelectedVehicleId(result.vehicle.id);
      setShowAddVehicle(false);
      setNewVehicleMarke("");
      setNewVehicleModell("");
      setNewVehicleBaujahr("");
    });
  }

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
  // Spiegelt distanceKm für den watchPosition-Callback und handleStop, damit
  // auch ein automatischer Stopp (ausgelöst aus der beim Start erzeugten
  // Callback-Closure) den aktuellen Stand nutzt statt eines veralteten
  // State-Werts aus dem ersten Render.
  const distanceKmRef = useRef(0);
  // Verhindert, dass die Zielnähe-Prüfung bei Rundfahrten (Start = Ziel)
  // sofort nach dem Start greift — erst nachdem der Nutzer den Startpunkt
  // tatsächlich verlassen hat, zählt eine erneute Annäherung als Ankunft.
  const hasLeftStartRef = useRef(false);
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
    distanceKmRef.current = 0;
    hasLeftStartRef.current = false;

    const startPoint = route.start_geojson.coordinates as [number, number];
    const endPoint = route.ziel_geojson.coordinates as [number, number];

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
            distanceKmRef.current += segment;
            setDistanceKm(distanceKmRef.current);
            lastPointRef.current = point;
            lastPointTimeRef.current = now;
          }
        } else {
          lastPointRef.current = point;
          lastPointTimeRef.current = now;
        }

        // Ankunft am Ziel erkennen und die Aufzeichnung automatisch beenden
        // — analog zum automatischen Start am Startpunkt. Bei Rundfahrten
        // (Start = Ziel) erst scharf schalten, nachdem die Startnähe wirklich
        // verlassen wurde, sonst würde direkt nach dem Start sofort gestoppt.
        if (!hasLeftStartRef.current) {
          if (haversineKm(point, startPoint) > END_PROXIMITY_KM) hasLeftStartRef.current = true;
        } else if (haversineKm(point, endPoint) <= END_PROXIMITY_KM) {
          handleStop();
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

  // Nutzt Refs statt der distanceKm/elapsedSeconds-States, damit ein Aufruf
  // aus der beim Start erzeugten watchPosition-Closure (automatischer Stopp
  // am Ziel) nicht auf veraltete Werte aus dem ersten Render zugreift — nur
  // ein Klick auf "Strecke beenden" hätte einen aktuellen State-Closure.
  function handleStop() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchIdRef.current = null;
    intervalRef.current = null;
    wakeLockRef.current?.release();
    wakeLockRef.current = null;

    const finalDistanceKm = distanceKmRef.current;
    const finalSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : elapsedSeconds;

    setResult({ distanceKm: finalDistanceKm, seconds: finalSeconds });
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
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background px-6 pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-center">
        {locationError ? (
          <>
            <p className="text-sm text-red-600">{locationError}</p>
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl border border-foreground/20 px-4 py-2 text-sm text-muted hover:border-foreground"
            >
              Zurück
            </button>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
            />
            <p className="text-sm text-muted">Standort wird ermittelt…</p>
          </>
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
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="min-h-0 flex-1">
          <RouteMap routes={routes} userLocation={currentPosition} />
        </div>
        <div className="flex flex-col gap-3 border-t border-foreground/20 bg-background p-4 pb-[calc(1rem+var(--safe-bottom))]">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {hasStarted ? "Aufzeichnung läuft" : "Unterwegs zum Start"}
          </p>
          <dl className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            <div>
              <dt className="text-xs text-muted">Distanz</dt>
              <dd className="font-mono text-xl tabular-nums">{distanceKm.toFixed(2)} km</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Zeit</dt>
              <dd className="font-mono text-xl tabular-nums">{formatDuration(elapsedSeconds)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tempo</dt>
              <dd className="font-mono text-lg tabular-nums">
                {currentSpeedKmh !== null ? `${currentSpeedKmh.toFixed(0)} km/h` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Höhe</dt>
              <dd className="font-mono text-lg tabular-nums">
                {currentElevationM !== null ? `${currentElevationM} m` : "—"}
              </dd>
            </div>
            {remainingKm !== null && (
              <div>
                <dt className="text-xs text-muted">Noch</dt>
                <dd className="font-mono text-lg tabular-nums">{remainingKm.toFixed(1)} km</dd>
              </div>
            )}
          </dl>
          {!hasStarted && (
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">Fahre zum Startpunkt</span> —{" "}
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
                className="rounded-full border border-accent bg-accent shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Strecke beenden
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelWaiting}
                  className="rounded-xl border border-foreground/20 px-4 py-2 text-sm text-muted hover:border-foreground"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={beginActualTracking}
                  className="text-xs text-accent hover:underline"
                >
                  Bin schon am Start
                </button>
              </div>
            )}
            <p className="text-xs text-muted">
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 py-8 sm:px-6 sm:py-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Fazit</h2>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Distanz</dt>
            <dd className="font-mono text-lg tabular-nums">{result?.distanceKm.toFixed(2)} km</dd>
          </div>
          <div>
            <dt className="text-muted">Zeit</dt>
            <dd className="font-mono text-lg tabular-nums">{formatDuration(result?.seconds ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-muted">Ø Tempo</dt>
            <dd className="font-mono text-lg tabular-nums">{avgKmh?.toFixed(0)} km/h</dd>
          </div>
        </dl>

        {isNewBest ? (
          <p className="border border-accent bg-accent/5 px-3 py-2 text-sm font-medium text-accent">
            {personalBestSeconds === null
              ? "Erste erfasste Zeit für diese Strecke."
              : `Neue persönliche Bestzeit — bisher ${formatDuration(personalBestSeconds)}.`}
          </p>
        ) : (
          <p className="text-sm text-muted">
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

          <div className="flex flex-col gap-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Fahrzeug</h3>
            {vehicleList.length > 0 && (
              <select
                name="fahrzeug_id"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
              >
                <option value="">—</option>
                {vehicleList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marke} {v.modell}
                  </option>
                ))}
              </select>
            )}
            {vehicleList.length === 0 && <input type="hidden" name="fahrzeug_id" value="" />}

            {!showAddVehicle ? (
              <button
                type="button"
                onClick={() => setShowAddVehicle(true)}
                className="self-start text-sm text-accent hover:underline"
              >
                + Fahrzeug hinzufügen
              </button>
            ) : (
              // Bewusst kein verschachteltes <form> — dieser Block liegt
              // innerhalb des äusseren Fahrt-Speichern-Formulars, und
              // HTML erlaubt keine geschachtelten Formulare. handleAddVehicle
              // baut die FormData manuell und ruft die Server Action direkt
              // auf, statt über eine native Formular-Submission zu gehen.
              <div className="flex flex-col gap-2 rounded-xl border border-foreground/15 shadow-sm p-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newVehicleTyp}
                    onChange={(e) => setNewVehicleTyp(e.target.value)}
                    className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
                  >
                    <option value="auto">Auto</option>
                    <option value="motorrad">Motorrad</option>
                  </select>
                  <select
                    value={newVehicleGetriebe}
                    onChange={(e) => setNewVehicleGetriebe(e.target.value)}
                    className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
                  >
                    <option value="manuell">Manuell</option>
                    <option value="automatik">Automatik</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Marke"
                  value={newVehicleMarke}
                  onChange={(e) => setNewVehicleMarke(e.target.value)}
                  className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
                />
                <input
                  type="text"
                  placeholder="Modell"
                  value={newVehicleModell}
                  onChange={(e) => setNewVehicleModell(e.target.value)}
                  className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
                />
                <input
                  type="number"
                  placeholder="Baujahr (optional)"
                  min={1900}
                  max={2100}
                  value={newVehicleBaujahr}
                  onChange={(e) => setNewVehicleBaujahr(e.target.value)}
                  className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
                />
                {addVehicleError && (
                  <p role="alert" className="text-xs text-red-600">
                    {addVehicleError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddVehicle}
                    disabled={addVehiclePending || !newVehicleMarke.trim() || !newVehicleModell.trim()}
                    className="rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                  >
                    {addVehiclePending ? "Speichern…" : "Speichern"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddVehicle(false);
                      setAddVehicleError(null);
                    }}
                    className="rounded-xl border border-foreground/20 px-3 py-1.5 text-sm text-muted hover:border-foreground"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 border-t border-foreground/10 pt-4 text-sm">
            <div className="flex items-baseline justify-between">
              <label htmlFor="tracking-notiz" className="text-xs font-semibold uppercase tracking-wide text-muted">
                Notiz (optional)
              </label>
              <span className="font-mono text-xs tabular-nums text-muted">
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
              className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-1 border-t border-foreground/10 pt-4 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Sichtbarkeit</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm ${
                  !isPublic
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/30 text-muted hover:border-foreground"
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
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/30 text-muted hover:enabled:border-foreground"
                }`}
              >
                <GlobeIcon className="h-4 w-4" />
                Öffentlich
              </button>
            </div>
            <p className="text-xs text-muted">
              {belowCoverageThreshold
                ? `Diese Fahrt deckt nur ${coveragePercent}% der offiziellen Strecke ab — evtl. abgekürzt oder am falschen Punkt gestartet/beendet. Sie bleibt privat gespeichert, kann aber nicht öffentlich geteilt werden.`
                : isPublic
                  ? "Öffentlich: erscheint auf Bestenlisten und deinem öffentlichen Profil. Später jederzeit umschaltbar."
                  : "Privat: nur du siehst diese Fahrt in deinem Profil, für andere bleibt sie unsichtbar. Später jederzeit umschaltbar."}
            </p>
          </div>

          <div className="border-t border-foreground/10 pt-4">
            <PhotoInput name="foto" id="tracking-foto" />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border border-accent bg-accent shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Speichern…" : "Fahrt speichern"}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="px-2 py-2 text-sm text-muted hover:text-foreground"
            >
              Verwerfen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
