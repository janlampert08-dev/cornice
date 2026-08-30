"use client";

import { useActionState, useEffect, useState } from "react";
import RoutePicker from "@/components/RoutePicker";
import BackButton from "@/components/BackButton";
import { GlobeIcon, LockIcon } from "@/components/VisibilityIcons";
import { KATEGORIEN } from "@/lib/constants";
import { fetchDrivingRoute, type DirectionsResult } from "@/lib/mapboxDirections";
import { proposeRoute, type ProposeRouteState } from "@/lib/actions/routes";

const initialState: ProposeRouteState = { error: null };

export default function NeueStreckeForm() {
  const [state, formAction, pending] = useActionState(proposeRoute, initialState);
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [rundfahrt, setRundfahrt] = useState(false);
  const [startOrt, setStartOrt] = useState("");
  const [directions, setDirections] = useState<DirectionsResult | null>(null);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [istPrivat, setIstPrivat] = useState(false);

  const effectiveWaypoints: [number, number][] =
    rundfahrt && waypoints.length >= 2 ? [...waypoints, waypoints[0]] : waypoints;
  const effectiveKey = JSON.stringify(effectiveWaypoints);
  const routing = effectiveWaypoints.length >= 2 && fetchedKey !== effectiveKey;
  const activeDirections = effectiveWaypoints.length >= 2 && fetchedKey === effectiveKey ? directions : null;

  useEffect(() => {
    if (effectiveWaypoints.length < 2) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      const result = await fetchDrivingRoute(effectiveWaypoints);
      if (cancelled) return;
      setDirections(result);
      setFetchedKey(effectiveKey);
      setRoutingError(result ? null : "Für diese Punkte konnte keine Strasse gefunden werden.");
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveKey]);

  function handlePick(point: [number, number]) {
    setWaypoints((prev) => [...prev, point]);
  }

  function undoLast() {
    setWaypoints((prev) => prev.slice(0, -1));
  }

  function reset() {
    setWaypoints([]);
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <form
        action={formAction}
        className="flex w-full flex-1 flex-col gap-4 overflow-y-auto border-foreground/10 px-6 py-8 md:max-w-sm md:border-r"
      >
        <BackButton fallbackHref="/" />

        <div>
          <h1 className="text-xl font-semibold">Strecke vorschlagen</h1>
          <p className="mt-1 text-sm text-muted">
            Setze nacheinander Wegpunkte auf der Karte — die Route wird automatisch entlang
            echter Strassen berechnet. Öffentliche Vorschläge prüft ein Moderator, bevor sie
            sichtbar werden.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            required
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Region
          <input
            name="region"
            required
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rundfahrt}
            onChange={(e) => setRundfahrt(e.target.checked)}
          />
          Rundfahrt (Ziel = Start)
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Start-Ort
            <input
              name="start_ort"
              required
              value={startOrt}
              onChange={(e) => setStartOrt(e.target.value)}
              className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
            />
          </label>
          {rundfahrt ? (
            <input type="hidden" name="ziel_ort" value={startOrt} />
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              Ziel-Ort
              <input
                name="ziel_ort"
                required
                className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
              />
            </label>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{waypoints.length} Wegpunkt(e) gesetzt</span>
          {waypoints.length > 0 && (
            <button type="button" onClick={undoLast} className="text-accent">
              Letzten entfernen
            </button>
          )}
          {waypoints.length > 0 && (
            <button type="button" onClick={reset} className="text-accent">
              Zurücksetzen
            </button>
          )}
        </div>

        <p className="text-xs text-muted">
          {waypoints.length === 0 && "Klicke auf die Karte, um den Startpunkt zu setzen."}
          {waypoints.length === 1 && "Klicke weitere Punkte entlang der gewünschten Strecke."}
          {waypoints.length > 1 && routing && "Route wird berechnet…"}
          {waypoints.length > 1 && !routing && activeDirections && (
            <>Strassenroute gefunden: ca. {activeDirections.distanceKm.toFixed(1)} km</>
          )}
          {routingError && <span className="text-red-600">{routingError}</span>}
        </p>

        <input
          type="hidden"
          name="geometry_geojson"
          value={
            activeDirections
              ? JSON.stringify({ type: "LineString", coordinates: activeDirections.coordinates })
              : ""
          }
        />
        <input
          type="hidden"
          name="tempolimits"
          value={activeDirections ? JSON.stringify(activeDirections.tempolimits) : "[]"}
        />

        <label className="flex flex-col gap-1 text-sm">
          Länge (km)
          <input
            name="laenge_km"
            type="number"
            step="0.1"
            min="0.1"
            required
            readOnly
            value={activeDirections ? activeDirections.distanceKm.toFixed(1) : ""}
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 text-muted">Kategorien</legend>
          {KATEGORIEN.map((k) => (
            <label key={k.value} className="flex items-center gap-2">
              <input type="checkbox" name="kategorien" value={k.value} />
              {k.label}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          Charakter (optional)
          <textarea
            name="charakter_text"
            rows={3}
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>

        <div className="flex flex-col gap-2 rounded-xl border border-foreground/15 shadow-sm bg-foreground/[0.03] px-3 py-3 text-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIstPrivat(true)}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm ${
                istPrivat
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/30 text-muted hover:border-foreground"
              }`}
            >
              <LockIcon className="h-4 w-4" />
              Privat
            </button>
            <button
              type="button"
              onClick={() => setIstPrivat(false)}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm ${
                !istPrivat
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/30 text-muted hover:border-foreground"
              }`}
            >
              <GlobeIcon className="h-4 w-4" />
              Öffentlich
            </button>
          </div>
          <p className="text-xs text-muted">
            {istPrivat
              ? "Nur für dich sichtbar, bis du sie selbst veröffentlichst."
              : "Durchläuft die Moderation und wird danach öffentlich."}
          </p>
        </div>
        <input type="hidden" name="ist_privat" value={istPrivat ? "true" : "false"} />

        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !activeDirections}
          className="rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Speichern…" : istPrivat ? "Privat speichern" : "Vorschlagen"}
        </button>
      </form>

      <div className="h-[45vh] shrink-0 md:order-first md:h-auto md:flex-1">
        <RoutePicker
          waypoints={waypoints}
          previewCoords={activeDirections?.coordinates ?? null}
          onPick={handlePick}
        />
      </div>
    </div>
  );
}
