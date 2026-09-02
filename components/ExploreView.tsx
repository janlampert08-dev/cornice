"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ExploreSidebar from "@/components/ExploreSidebar";
import DragSheet from "@/components/ui/DragSheet";
import Skeleton from "@/components/ui/Skeleton";
import { haversineKm } from "@/lib/geo";
import { matchesSearch } from "@/lib/search";
import { computeSignatures } from "@/lib/signature";
import {
  applyAdvancedFilters,
  parseExploreSearchParams,
  serializeExploreSearchParams,
  type AdvancedFilters,
  type ExploreFiltersState,
} from "@/lib/exploreFilters";
import type { Kategorie, RouteGeoJSON } from "@/types/database";

// URL-Sync für den Suchtext wird debounced (siehe searchInput-Effekt unten),
// damit nicht jeder Tastendruck einen router.replace() (und damit einen
// RSC-Request) auslöst — die Eingabe selbst (searchInput) bleibt davon
// unbenommen sofort responsiv, nur der Query-String hinkt bis zu diesem
// Delay hinterher.
const SEARCH_URL_SYNC_DEBOUNCE_MS = 300;

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

export default function ExploreView({
  routes,
  loadError = false,
}: {
  routes: RouteGeoJSON[];
  loadError?: boolean;
}) {
  // Kategorie-Chips und erweiterte Filter leben nicht mehr in eigenem
  // useState, sondern werden bei jedem Render direkt aus der URL gelesen
  // (searchParams) — die URL ist hier die "single source of truth". So
  // bleibt die Auswahl beim Zurück-/Vorwärtsnavigieren, Neuladen und beim
  // Zurückkehren von der Routendetailseite erhalten (statt beim Verlassen
  // der Komponente verloren zu gehen), und der Zustand lässt sich als Link
  // teilen. router.replace() (nicht push()) hält die Browser-History dabei
  // sauber, siehe updateUrl().
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlFilters = useMemo(() => parseExploreSearchParams(searchParams), [searchParams]);
  const { selectedKategorien, advancedFilters } = urlFilters;

  const updateUrl = useCallback(
    (next: ExploreFiltersState) => {
      const qs = serializeExploreSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // Der Suchtext braucht dagegen eigenen React-State: das Eingabefeld muss
  // bei jedem Tastendruck sofort reagieren, während der URL-Sync (s.u.)
  // debounced erfolgt. Initialwert kommt aus der URL (Lazy-Init), damit ein
  // Reload/Zurücknavigieren mit vorhandenem ?q=… den Suchtext wiederherstellt.
  const [searchInput, setSearchInput] = useState(() => urlFilters.searchQuery);
  // Merkt sich, mit welchem URL-Wert searchInput zuletzt abgeglichen wurde,
  // um externe Änderungen (Browser-Zurück/Vorwärts auf eine URL mit
  // anderem ?q=…) von den eigenen (debounced) Schreibvorgängen zu
  // unterscheiden. Der Abgleich passiert bewusst während des Renders statt
  // in einem useEffect — React "Adjusting state when a prop changes"-Muster
  // — da setState synchron in einem Effekt Render-Kaskaden auslöst
  // (react-hooks/set-state-in-effect).
  const [syncedSearchQuery, setSyncedSearchQuery] = useState(() => urlFilters.searchQuery);
  if (urlFilters.searchQuery !== syncedSearchQuery) {
    setSyncedSearchQuery(urlFilters.searchQuery);
    setSearchInput(urlFilters.searchQuery);
  }

  // Schreibt den Suchtext debounced in die URL, ohne die Kategorie-/
  // Advanced-Filter-Teile der URL anzufassen — urlFilters ist hier absichtlich
  // Abhängigkeit, damit ein zwischenzeitlicher Chip-/Filter-Wechsel den
  // ausstehenden Timeout mit dem aktuellen restlichen Zustand neu aufsetzt,
  // statt ihn mit einer veralteten Momentaufnahme zu überschreiben.
  useEffect(() => {
    if (searchInput === urlFilters.searchQuery) return;
    const timeout = setTimeout(() => {
      updateUrl({ ...urlFilters, searchQuery: searchInput });
    }, SEARCH_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput, urlFilters, updateUrl]);

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);

  // Bottom-Sheet-Container (nur < md relevant — ab md greift die feste
  // Liste-links/Karte-rechts-Aufteilung unverändert, siehe Klassen unten).
  // Die eigentliche Drag-/Tap-Mechanik steckt in DragSheet.tsx, wiederverwendet
  // auf der Routendetailseite (app/strecken/[id]/page.tsx).
  const containerRef = useRef<HTMLElement>(null);

  const onToggleKategorie = useCallback(
    (kategorie: Kategorie) => {
      const next = urlFilters.selectedKategorien.includes(kategorie)
        ? urlFilters.selectedKategorien.filter((k) => k !== kategorie)
        : [...urlFilters.selectedKategorien, kategorie];
      updateUrl({ ...urlFilters, selectedKategorien: next });
    },
    [urlFilters, updateUrl],
  );

  // Bug 2: eigener Reset nur für die Kategorie-Chips, unabhängig vom
  // "Filter zurücksetzen" von AdvancedFiltersPanel (das nur km/Höhe/Saison
  // betrifft) — Suchtext bleibt bewusst unangetastet, jede Filtergruppe
  // setzt nur sich selbst zurück.
  const onResetKategorien = useCallback(() => {
    updateUrl({ ...urlFilters, selectedKategorien: [] });
  }, [urlFilters, updateUrl]);

  const onAdvancedFiltersChange = useCallback(
    (filters: AdvancedFilters) => {
      updateUrl({ ...urlFilters, advancedFilters: filters });
    },
    [urlFilters, updateUrl],
  );

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
    // searchInput statt des (debounced) URL-Werts: die Liste soll bei jedem
    // Tastendruck sofort reagieren, nicht erst nach dem URL-Sync-Delay.
    let filtered = searchInput.trim()
      ? routes.filter((r) => matchesSearch(r, searchInput))
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
  }, [routes, searchInput, selectedKategorien, advancedFilters, userLocation]);

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
          zuziehbar zwischen Peek- und Vollhöhe (siehe DragSheet.tsx).
          Ab md: display:contents statt eigener Box — der Wrapper selbst
          verschwindet aus dem Rendering, ExploreSidebar rutscht direkt als
          Flex-Kind in main hoch und übernimmt dort exakt wie vorher die
          Liste-links/Karte-rechts-Aufteilung über ihre eigenen
          w-full/max-w-*-Klassen. */}
      <DragSheet
        containerRef={containerRef}
        peekPx={SHEET_PEEK_PX}
        expandedGapPx={SHEET_EXPANDED_GAP_PX}
        handleLabels={{ expand: "Liste ausklappen", collapse: "Liste einklappen" }}
      >
        <ExploreSidebar
          routes={visibleRoutes}
          loadError={loadError}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          signatures={signatures}
          userLocation={userLocation}
          locating={locating}
          locationError={locationError}
          onRequestLocation={requestLocation}
          onHoverRoute={setHoveredRouteId}
          selectedKategorien={selectedKategorien}
          onToggleKategorie={onToggleKategorie}
          onResetKategorien={onResetKategorien}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={onAdvancedFiltersChange}
        />
      </DragSheet>
    </main>
  );
}
