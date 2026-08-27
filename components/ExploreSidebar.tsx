"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { routeShapePath } from "@/lib/routeShape";
import { withAlpha, type RouteSignature } from "@/lib/signature";
import type { RouteGeoJSON } from "@/types/database";

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
    <div className="flex w-full flex-col gap-5 overflow-y-auto border-[#131316]/10 px-5 py-5 sm:px-6 sm:py-6 md:max-w-sm md:border-r">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Strecke, Region oder Ort suchen…"
        className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
      />

      <div className="flex flex-col items-start gap-2 border-b border-[#131316]/10 pb-6">
        <button
          onClick={onRequestLocation}
          disabled={locating}
          className="border border-[#131316] bg-[#FAFAFA] px-3 py-1.5 text-sm font-medium text-[#131316] hover:bg-[#131316] hover:text-[#FAFAFA] disabled:opacity-50"
        >
          {locating
            ? "Suche Standort…"
            : userLocation
              ? "Standort aktualisieren"
              : "Strecken in meiner Nähe"}
        </button>
        {locationError && <p className="text-xs text-[#8A8F98]">{locationError}</p>}
      </div>

      <ul className="flex flex-col gap-1">
        {routes.length === 0 && loadError && (
          <li className="text-sm text-red-600">
            Strecken konnten nicht geladen werden. Bitte versuche es später erneut.
          </li>
        )}
        {routes.length === 0 && !loadError && (
          <li className="text-sm text-[#8A8F98]">Keine Strecken für diese Suche.</li>
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
                className="group flex h-20 items-center gap-3 border-b border-[#131316]/10 border-l-[3px] py-3 pl-3 pr-2 transition-colors duration-150 hover:bg-[var(--track-hover-bg)]"
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <span className="truncate text-base font-medium transition-colors duration-150 group-hover:text-[var(--track-color)]">
                    {route.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {showPlainKm && (
                      <span className="font-mono text-sm tabular-nums text-[#8A8F98]">
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
