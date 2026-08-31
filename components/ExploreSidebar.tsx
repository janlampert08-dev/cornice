"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { Mountain } from "lucide-react";
import { KATEGORIEN } from "@/lib/constants";
import { routeShapePath } from "@/lib/routeShape";
import { withAlpha, type RouteSignature } from "@/lib/signature";
import type { Kategorie, RouteGeoJSON } from "@/types/database";
import { fieldClassName } from "@/components/ui/Input";
import { buttonVariants } from "@/components/ui/Button";

export default function ExploreSidebar({
  routes,
  loadError = false,
  searchQuery,
  onSearchChange,
  signatures,
  coverPhotos,
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
  coverPhotos: Map<string, string>;
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
    <div className="flex w-full flex-col gap-5 overflow-y-auto overscroll-y-contain border-border px-5 py-5 sm:px-6 sm:py-6 md:max-w-sm md:border-r lg:max-w-md xl:max-w-lg">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Strecke, Region oder Ort suchen…"
        className={fieldClassName()}
      />

      <div className="flex flex-col items-start gap-2 border-b border-border pb-6">
        <button
          onClick={onRequestLocation}
          disabled={locating}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
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
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-fast active:scale-95 ${
                active
                  ? "border-accent bg-accent text-background"
                  : "border-border text-foreground hover:border-border-strong"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-1">
        {routes.length === 0 && loadError && (
          <li className="text-sm text-danger">
            Strecken konnten nicht geladen werden. Bitte versuche es später erneut.
          </li>
        )}
        {routes.length === 0 && !loadError && (
          <li className="text-sm text-muted">Keine Strecken für diese Suche.</li>
        )}
        {routes.map((route) => {
          const signature = signatures.get(route.id);
          const shape = shapes.get(route.id);
          const coverUrl = coverPhotos.get(route.id);
          // Wenn das Signatur-Merkmal selbst die Länge ist (signature.label
          // lautet dann z.B. "24 km lang"), nicht zusätzlich eine separate
          // km-Zahl daneben zeigen — sonst steht dieselbe Länge zweimal da.
          const showPlainKm = signature?.key !== "laenge";
          // Fallback als Literal-Hex statt CSS-Variable: withAlpha() (siehe
          // lib/signature.ts) parst den Wert als #RRGGBB, ein var(...) würde
          // das brechen. Entspricht --color-muted im Light Mode; im Dark Mode
          // (#8F95A3) ein kaum wahrnehmbarer Unterschied — echte Auflösung
          // bräuchte eine JS-seitige Farbaufl. der CSS-Variable, außerhalb
          // des Scopes dieser Phase (lib/signature.ts bleibt unangetastet).
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
                className="group flex h-24 items-center gap-3 border-b border-border border-l-[3px] py-3 pr-2 pl-3 transition-colors duration-fast hover:bg-[var(--track-hover-bg)] active:bg-[var(--track-hover-bg)]"
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <span className="truncate text-base font-medium transition-colors duration-fast group-hover:text-[var(--track-color)]">
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
                        <Mountain
                          className="h-3 w-3 shrink-0"
                          style={{ color: signature.color }}
                          aria-hidden="true"
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

                {/* Coverfoto, wenn für diese Strecke eines vorliegt (siehe
                    getRouteCoverPhotos in lib/photos.ts); sonst Fallback auf
                    die bisherige SVG-Routenform auf getöntem Signaturfarb-
                    Hintergrund — kein Foto bedeutet nicht "kein Vorschaubild". */}
                <div
                  className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md"
                  style={{ backgroundColor: withAlpha(trackColor, 0.12) }}
                >
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover transition-opacity duration-fast group-hover:opacity-90"
                    />
                  ) : (
                    shape && (
                      <svg
                        viewBox="0 0 64 48"
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full opacity-80 transition-opacity duration-fast group-hover:opacity-100"
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
                    )
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
