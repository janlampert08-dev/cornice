"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import RoutePicker from "@/components/RoutePicker";
import BackButton from "@/components/BackButton";
import DragSheet from "@/components/ui/DragSheet";
import { GlobeIcon, LockIcon } from "@/components/VisibilityIcons";
import { KATEGORIEN } from "@/lib/constants";
import { fetchDrivingRoute, type DirectionsResult } from "@/lib/mapboxDirections";
import { proposeRoute, type ProposeRouteState } from "@/lib/actions/routes";
import { Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const initialState: ProposeRouteState = { error: null };

// Gleiche Bottom-Sheet-Mechanik wie auf Startseite (ExploreView.tsx) und
// Routendetailseite (RouteDetailLayout.tsx) — die Karte bleibt hier zudem
// der primäre Bedienweg (Tippen setzt Wegpunkte), die Peek-Höhe zeigt daher
// bewusst nur Titel + Hinweistext + Wegpunkt-Zähler, den Rest des
// Formulars (Name, Region, Kategorien, …) füllt man erst nach dem
// Aufziehen aus.
const SHEET_PEEK_PX = 280;
const SHEET_EXPANDED_GAP_PX = 96;

export default function NeueStreckeForm() {
  const containerRef = useRef<HTMLElement>(null);
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
    <main ref={containerRef} className="relative flex h-dvh flex-1 flex-col overflow-hidden md:flex-row">
      <div
        className="absolute inset-0 md:static md:order-first md:h-auto md:flex-1"
        aria-label="Karte zum Setzen der Wegpunkte — auf die Karte tippen, um einen Punkt zu setzen."
      >
        <RoutePicker
          waypoints={waypoints}
          previewCoords={activeDirections?.coordinates ?? null}
          onPick={handlePick}
        />
      </div>

      <DragSheet
        containerRef={containerRef}
        peekPx={SHEET_PEEK_PX}
        expandedGapPx={SHEET_EXPANDED_GAP_PX}
        handleLabels={{ expand: "Formular ausklappen", collapse: "Formular einklappen" }}
      >
        <form
          action={formAction}
          className="flex w-full flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain border-border px-6 py-8 md:max-w-sm md:border-r lg:max-w-md"
        >
          <BackButton fallbackHref="/" />

          <div>
            <h1 className="text-display font-semibold">Strecke vorschlagen</h1>
            <p className="mt-1 text-sm text-muted">
              Setze nacheinander Wegpunkte auf der Karte — die Route wird automatisch entlang
              echter Strassen berechnet. Öffentliche Vorschläge prüft ein Moderator, bevor sie
              sichtbar werden.
            </p>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Name
            <Input name="name" required />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Region
            <Input name="region" required />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rundfahrt}
              onChange={(e) => setRundfahrt(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Rundfahrt (Ziel = Start)
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Start-Ort
              <Input
                name="start_ort"
                required
                value={startOrt}
                onChange={(e) => setStartOrt(e.target.value)}
              />
            </label>
            {rundfahrt ? (
              <input type="hidden" name="ziel_ort" value={startOrt} />
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Ziel-Ort
                <Input name="ziel_ort" required />
              </label>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span>{waypoints.length} Wegpunkt(e) gesetzt</span>
            {waypoints.length > 0 && (
              <button type="button" onClick={undoLast} className="font-medium text-accent hover:underline">
                Letzten entfernen
              </button>
            )}
            {waypoints.length > 0 && (
              <button type="button" onClick={reset} className="font-medium text-accent hover:underline">
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
            {routingError && <span className="text-danger">{routingError}</span>}
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

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Länge (km)
            <Input
              name="laenge_km"
              type="number"
              step="0.1"
              min="0.1"
              required
              readOnly
              value={activeDirections ? activeDirections.distanceKm.toFixed(1) : ""}
              className="font-mono"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 text-muted">Kategorien</legend>
            {KATEGORIEN.map((k) => (
              <label key={k.value} className="flex items-center gap-2">
                <input type="checkbox" name="kategorien" value={k.value} className="h-4 w-4 accent-accent" />
                {k.label}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Charakter (optional)
            <Textarea name="charakter_text" rows={3} />
          </label>

          <Card surface className="flex flex-col gap-2 px-3 py-3 text-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIstPrivat(true)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-fast ${
                  istPrivat
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:border-border-strong"
                }`}
              >
                <LockIcon className="h-4 w-4" />
                Privat
              </button>
              <button
                type="button"
                onClick={() => setIstPrivat(false)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-fast ${
                  !istPrivat
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:border-border-strong"
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
          </Card>
          <input type="hidden" name="ist_privat" value={istPrivat ? "true" : "false"} />

          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={pending || !activeDirections}>
            {pending ? "Speichern…" : istPrivat ? "Privat speichern" : "Vorschlagen"}
          </Button>
        </form>
      </DragSheet>
    </main>
  );
}
