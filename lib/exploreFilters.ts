import type { RouteGeoJSON } from "@/types/database";

export interface AdvancedFilters {
  minKm: number | null;
  maxKm: number | null;
  minHoehe: number | null;
  maxHoehe: number | null;
  nurGanzjaehrig: boolean;
}

export const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {
  minKm: null,
  maxKm: null,
  minHoehe: null,
  maxHoehe: null,
  nurGanzjaehrig: false,
};

export function countActiveFilters(f: AdvancedFilters): number {
  return (
    Number(f.minKm !== null) +
    Number(f.maxKm !== null) +
    Number(f.minHoehe !== null) +
    Number(f.maxHoehe !== null) +
    Number(f.nurGanzjaehrig)
  );
}

// Alle Filter UND-verknüpft — jeder engt eine andere Eigenschaft ein, im
// Gegensatz zur ODER-Verknüpfung der Kategorie-Chips (lib/search.ts bzw.
// ExploreView.tsx), die dieselbe Eigenschaft (Kategorie) mehrfach abdecken.
export function applyAdvancedFilters(routes: RouteGeoJSON[], f: AdvancedFilters): RouteGeoJSON[] {
  let filtered = routes;
  if (f.minKm !== null) filtered = filtered.filter((r) => r.laenge_km >= f.minKm!);
  if (f.maxKm !== null) filtered = filtered.filter((r) => r.laenge_km <= f.maxKm!);
  if (f.minHoehe !== null) filtered = filtered.filter((r) => (r.hoehe_m ?? 0) >= f.minHoehe!);
  if (f.maxHoehe !== null) filtered = filtered.filter((r) => (r.hoehe_m ?? 0) <= f.maxHoehe!);
  if (f.nurGanzjaehrig) filtered = filtered.filter((r) => r.saison_status === "ganzjaehrig");
  return filtered;
}
