"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import dynamic from "next/dynamic";
import { GripHorizontal } from "lucide-react";
import ExploreSidebar from "@/components/ExploreSidebar";
import Skeleton from "@/components/ui/Skeleton";
import { haversineKm } from "@/lib/geo";
import { matchesSearch } from "@/lib/search";
import { computeSignatures } from "@/lib/signature";
import { applyAdvancedFilters, EMPTY_ADVANCED_FILTERS, type AdvancedFilters } from "@/lib/exploreFilters";
import type { Kategorie, RouteGeoJSON } from "@/types/database";

// mapbox-gl ist eine schwere Abhängigkeit (WebGL, eigenes CSS) — dynamisch
// geladen, damit Suchfeld/Streckenliste interaktiv werden, ohne auf den
// Kartencode zu warten, statt beides in einem Chunk zu bündeln. ssr:false,
// da mapbox-gl direkten DOM-/WebGL-Zugriff braucht.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

// Bottom-Sheet-Massse (Mobile). PEEK entspricht ungefähr der bisherigen
// festen Kartenhöhe (h-64 = 256px) plus Platz für den Ziehgriff; EXPANDED_GAP
// lässt oben immer einen Streifen Karte sichtbar, damit der Kontext (wo bin
// ich?) beim voll aufgezogenen Sheet nicht verloren geht.
const SHEET_PEEK_PX = 272;
const SHEET_EXPANDED_GAP_PX = 96;
const DRAG_TAP_THRESHOLD_PX = 6;

export default function ExploreView({
  routes,
  loadError = false,
  coverPhotos,
}: {
  routes: RouteGeoJSON[];
  loadError?: boolean;
  coverPhotos: Map<string, string>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [selectedKategorien, setSelectedKategorien] = useState<Kategorie[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);

  // Bottom-Sheet-Zustand (nur < md relevant — ab md greift die feste
  // Liste-links/Karte-rechts-Aufteilung unverändert, siehe Klassen unten).
  const containerRef = useRef<HTMLElement>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  const sheetHeight = sheetExpanded ? "calc(100% - " + SHEET_EXPANDED_GAP_PX + "px)" : `${SHEET_PEEK_PX}px`;

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
      const currentHeight = sheetExpanded ? containerHeight - SHEET_EXPANDED_GAP_PX : SHEET_PEEK_PX;
      dragRef.current = { startY: e.clientY, startHeight: currentHeight, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [sheetExpanded],
  );

  const onHandlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaY = drag.startY - e.clientY;
    if (Math.abs(deltaY) > DRAG_TAP_THRESHOLD_PX) drag.moved = true;

    const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
    const maxHeight = containerHeight - SHEET_EXPANDED_GAP_PX;
    const next = Math.min(Math.max(drag.startHeight + deltaY, SHEET_PEEK_PX), maxHeight);
    setDragHeight(next);
  }, []);

  const onHandlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (!drag) return;

      // Reiner Tap (kaum Bewegung) schaltet um, statt am aktuellen Zustand
      // festzuhalten — sonst müsste man aus der Peek-Position immer ziehen.
      if (!drag.moved) {
        setSheetExpanded((current) => !current);
        setDragHeight(null);
        return;
      }

      const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
      const maxHeight = containerHeight - SHEET_EXPANDED_GAP_PX;
      const current = dragHeight ?? drag.startHeight;
      const midpoint = (SHEET_PEEK_PX + maxHeight) / 2;
      setSheetExpanded(current > midpoint);
      setDragHeight(null);
    },
    [dragHeight],
  );

  const onToggleKategorie = useCallback((kategorie: Kategorie) => {
    setSelectedKategorien((current) =>
      current.includes(kategorie)
        ? current.filter((k) => k !== kategorie)
        : [...current, kategorie],
    );
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.longitude, position.coords.latitude]);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Standortzugriff wurde verweigert."
            : "Standort konnte nicht ermittelt werden.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // Über den gesamten (ungefilterten) Bestand berechnet, damit das
  // Signatur-Merkmal und seine Farbe je Strecke stabil bleiben — eine
  // Textsuche schränkt nur die sichtbare Auswahl ein, ohne die Perzentile
  // (und damit Merkmale/Farben) der übrigen Strecken zu verschieben.
  const signatures = useMemo(() => computeSignatures(routes), [routes]);
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    signatures.forEach((sig, id) => map.set(id, sig.color));
    return map;
  }, [signatures]);

  const visibleRoutes = useMemo(() => {
    let filtered = searchQuery.trim()
      ? routes.filter((r) => matchesSearch(r, searchQuery))
      : routes;

    // Eine Strecke passt, sobald sie mindestens eines der ausgewählten Tags
    // trägt (ODER-Verknüpfung) — Strecken haben meist nur 1-2 Kategorien, eine
    // UND-Verknüpfung würde die Auswahl bei mehreren aktiven Tags zu stark
    // einschränken.
    if (selectedKategorien.length > 0) {
      filtered = filtered.filter((r) =>
        r.kategorien.some((k) => selectedKategorien.includes(k)),
      );
    }

    filtered = applyAdvancedFilters(filtered, advancedFilters);

    if (!userLocation) return filtered;

    return [...filtered].sort(
      (a, b) =>
        haversineKm(userLocation, a.start_geojson.coordinates) -
        haversineKm(userLocation, b.start_geojson.coordinates),
    );
  }, [routes, searchQuery, selectedKategorien, advancedFilters, userLocation]);

  return (
    <main ref={containerRef} className="relative flex flex-1 flex-col overflow-hidden md:flex-row">
      <div
        className="absolute inset-0 md:static md:order-2 md:h-auto md:flex-1"
        role="img"
        aria-label="Kartenansicht der Strecken — die vollständige Liste steht in der Seitenleiste."
      >
        <RouteMap
          routes={visibleRoutes}
          userLocation={userLocation}
          colors={colors}
          hoveredRouteId={hoveredRouteId}
        />
      </div>

      {/* Mobile: Bottom-Sheet über der Karte, per Ziehgriff auf- und
          zuziehbar zwischen Peek- und Vollhöhe (siehe Konstanten oben).
          Ab md: zurück zur ursprünglichen Liste-links/Karte-rechts-Aufteilung,
          keine der Sheet-Positionierungsklassen greift dort mehr. */}
      <div
        // Ab md: display:contents statt eigener Box — der Wrapper selbst
        // verschwindet aus dem Rendering, ExploreSidebar rutscht direkt als
        // Flex-Kind in main hoch und übernimmt dort exakt wie vorher die
        // Liste-links/Karte-rechts-Aufteilung über ihre eigenen
        // w-full/max-w-*-Klassen. Ein einfaches md:static hätte hier nicht
        // gereicht: die feste Höhe/Position wären als Box-Eigenschaften
        // erhalten geblieben und hätten die Desktop-Breite verzerrt.
        className={`absolute inset-x-0 bottom-0 z-10 flex h-[var(--sheet-h)] flex-col overflow-hidden rounded-t-lg border-t border-border bg-background shadow-overlay md:contents ${
          dragHeight === null ? "transition-[height] duration-base ease-standard" : ""
        }`}
        style={{ "--sheet-h": dragHeight !== null ? `${dragHeight}px` : sheetHeight } as CSSProperties}
      >
        <div
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          role="button"
          tabIndex={0}
          aria-label={sheetExpanded ? "Liste einklappen" : "Liste ausklappen"}
          aria-expanded={sheetExpanded}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setSheetExpanded((current) => !current);
          }}
          className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded-t-lg py-2 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset md:hidden"
        >
          <GripHorizontal className="h-5 w-5 text-muted" aria-hidden="true" />
        </div>
        <ExploreSidebar
          routes={visibleRoutes}
          loadError={loadError}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          signatures={signatures}
          coverPhotos={coverPhotos}
          userLocation={userLocation}
          locating={locating}
          locationError={locationError}
          onRequestLocation={requestLocation}
          onHoverRoute={setHoveredRouteId}
          selectedKategorien={selectedKategorien}
          onToggleKategorie={onToggleKategorie}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
        />
      </div>
    </main>
  );
}
