"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { KATEGORIEN } from "@/lib/constants";
import { routeShapePath } from "@/lib/routeShape";
import { withAlpha, type RouteSignature } from "@/lib/signature";
import type { Kategorie, RouteGeoJSON } from "@/types/database";

export default function ExploreSidebar({
  routes,
  loadError = false,
  searchQuery,
  onSearchChange,
  signatures,
  userLocation,
  locating,
  locationError,
  onRequestLocation,
  onHoverRoute,
  selectedKategorien,
  onToggleKategorie,
}: {
  routes: RouteGeoJSON[];
  loadError?: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  signatures: Map<string, RouteSignature>;
  userLocation: [number, number] | null;
  locating: boolean;
  locationError: string | null;
  onRequestLocation: () => void;
  onHoverRoute: (id: string | null) => void;
  selectedKategorien: Kategorie[];
  onToggleKategorie: (kategorie: Kategorie) => void;
}) {
  // Nur bei Änderung des Streckenbestands neu berechnet — sonst würde jeder
  // Hover (der über onHoverRoute den State im Elternteil ändert) hier eine
  // erneute Pfadberechnung für alle Karten auslösen.
  const shapes = useMemo(
    () =>
      new Map(
        routes.map((r) => [
          r.id,
          routeShapePath(r.geometry_geojson.coordinates as [number, number][], 64, 48, 4),
        ]),
      ),
    [routes],
  );

  return (
    <div className="flex w-full flex-col gap-5 overflow-y-auto overscroll-y-contain border-foreground/10 px-5 py-5 sm:px-6 sm:py-6 md:max-w-sm md:border-r">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Strecke, Region oder Ort suchen…"
        className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
      />

      <div className="flex flex-col items-start gap-2 border-b border-foreground/10 pb-6">
        <button
          onClick={onRequestLocation}
          disabled={locating}
          className="border border-foreground bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {locating
            ? "Suche Standort…"
            : userLocation
              ? "Standort aktualisieren"
              : "Strecken in meiner Nähe"}
        </button>
        {locationError && <p className="text-xs text-muted">{locationError}</p>}
      </div>

      {/* Umbrechende Chip-Reihe statt Checkboxen/Dropdown — mehrere Tags lassen
          sich per Antippen kombinieren (ODER-Verknüpfung, siehe ExploreView).
          Bewusst kein horizontales Scrollen: bei nur 4 Kategorien zeigt
          Umbrechen alle Optionen sofort, statt einen Teil ohne erkennbaren
          Scroll-Hinweis ausserhalb des sichtbaren Bereichs zu verstecken. */}
      <div className="flex flex-wrap gap-2">
        {KATEGORIEN.map((k) => {
          const active = selectedKategorien.includes(k.value);
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => onToggleKategorie(k.value)}
              aria-pressed={active}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 active:scale-95 ${
                active
                  ? "border-accent bg-accent text-background"
                  : "border-foreground/20 bg-transparent text-foreground hover:border-foreground"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-1">
        {routes.length === 0 && loadError && (
          <li className="text-sm text-red-600">
            Strecken konnten nicht geladen werden. Bitte versuche es später erneut.
          </li>
        )}
        {routes.length === 0 && !loadError && (
          <li className="text-sm text-muted">Keine Strecken für diese Suche.</li>
        )}
        {routes.map((route) => {
          const signature = signatures.get(route.id);
          const shape = shapes.get(route.id);
          // Wenn das Signatur-Merkmal selbst die Länge ist (signature.label
          // lautet dann z.B. "24 km lang"), nicht zusätzlich eine separate
          // km-Zahl daneben zeigen — sonst steht dieselbe Länge zweimal da.
          const showPlainKm = signature?.key !== "laenge";
          const trackColor = signature?.color ?? "#8A8F98";

          return (
            <li key={route.id}>
              <Link
                href={`/strecken/${route.id}`}
                onMouseEnter={() => onHoverRoute(route.id)}
                onMouseLeave={() => onHoverRoute(null)}
                onFocus={() => onHoverRoute(route.id)}
                onBlur={() => onHoverRoute(null)}
                style={
                  {
                    "--track-color": trackColor,
                    "--track-hover-bg": withAlpha(trackColor, 0.1),
                    borderLeftColor: withAlpha(trackColor, 0.55),
                  } as CSSProperties
                }
                className="group flex h-20 items-center gap-3 border-b border-foreground/10 border-l-[3px] py-3 pl-3 pr-2 transition-colors duration-150 hover:bg-[var(--track-hover-bg)] active:bg-[var(--track-hover-bg)]"
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <span className="truncate text-base font-medium transition-colors duration-150 group-hover:text-[var(--track-color)]">
                    {route.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {showPlainKm && (
                      <span className="font-mono text-sm tabular-nums text-muted">
                        {route.laenge_km} km
                      </span>
                    )}
                    {signature && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0"
                          style={{ backgroundColor: signature.color }}
                        />
                        <span
                          className="truncate text-xs font-medium tracking-wide"
                          style={{ color: signature.color }}
                        >
                          {signature.label}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {shape && (
                  <svg
                    viewBox="0 0 64 48"
                    aria-hidden="true"
                    className="h-10 w-14 shrink-0 opacity-80 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    <path
                      d={shape}
                      fill="none"
                      stroke={trackColor}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
