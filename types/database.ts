// Handgeschriebene Typen passend zum Schema in supabase/migrations/0001_init.sql.
// Sobald ein Supabase-Projekt verknüpft ist, können diese durch
// `npx supabase gen types typescript --linked` ersetzt/aktualisiert werden.

export type FahrzeugTyp = "auto" | "motorrad";
export type Getriebe = "manuell" | "automatik";
export type Kategorie = "kurvig" | "scenic" | "passstrasse" | "freie_fahrt";
export type SaisonStatus = "ganzjaehrig" | "saisonal";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoLineString {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat][]
}

// Ein Tempolimit-Abschnitt entlang einer Strecke, bezogen auf die
// kumulierte Distanz ab Start (km_von/km_bis). "bekannt: false" markiert
// Abschnitte ohne OSM-maxspeed-Tag, für die ein Ausserorts-Standardwert
// (80 km/h in der Schweiz) angenommen wurde.
export interface TempolimitSegment {
  km_von: number;
  km_bis: number;
  kmh: number;
  bekannt: boolean;
  // true nur für Abschnitte innerhalb Kanton Zürich, die mit dem amtlichen
  // "Signalisierte Geschwindigkeit"-Datensatz (GDS 102) abgeglichen wurden.
  amtlich?: boolean;
}

// Ein Punkt des Höhenprofil-Diagramms (kumulierte Distanz ab Start, Meter ü. M.).
export interface HoehenprofilPunkt {
  km: number;
  m: number;
}

export interface Vehicle {
  id: string;
  user_id: string;
  typ: FahrzeugTyp;
  marke: string;
  modell: string;
  getriebe: Getriebe;
  baujahr: number | null;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  region: string;
  start_ort: string;
  ziel_ort: string;
  start_coord: GeoPoint;
  ziel_coord: GeoPoint;
  geometry: GeoLineString;
  hoehe_m: number | null;
  laenge_km: number;
  max_steigung_prozent: number | null;
  kehren: number | null;
  kategorien: Kategorie[];
  saison_status: SaisonStatus;
  status_ok: boolean;
  abgelehnt_am: string | null;
  charakter_text: string | null;
  tempolimits: TempolimitSegment[] | null;
  hoehenprofil: HoehenprofilPunkt[] | null;
  erstellt_von: string | null;
  // Premium-Feature (siehe 0021_premium_und_private_strecken.sql): private
  // Strecke ohne Moderationspflicht, nur für den Ersteller sichtbar, bis
  // explizit veröffentlicht.
  ist_privat: boolean;
  created_at: string;
}

// Zeilenform von public.routes_geojson (siehe 0002_routes_geojson_view.sql) —
// dieselben Felder wie Route, aber die geography-Spalten als GeoJSON statt WKB.
export interface RouteGeoJSON {
  id: string;
  name: string;
  region: string;
  start_ort: string;
  ziel_ort: string;
  start_geojson: GeoPoint;
  ziel_geojson: GeoPoint;
  geometry_geojson: GeoLineString;
  hoehe_m: number | null;
  laenge_km: number;
  max_steigung_prozent: number | null;
  kehren: number | null;
  kategorien: Kategorie[];
  saison_status: SaisonStatus;
  status_ok: boolean;
  charakter_text: string | null;
  tempolimits: TempolimitSegment[] | null;
  hoehenprofil: HoehenprofilPunkt[] | null;
  ist_rundfahrt: boolean;
  erstellt_von: string | null;
  created_at: string;
  ist_privat: boolean;
}

export interface RouteRating {
  id: string;
  route_id: string;
  user_id: string;
  // Sterne-Bewertung entfernt (siehe 0025_ratings_ohne_sterne.sql) — Spalte
  // bleibt in der DB für evtl. schon vorhandene Alt-Daten, wird von der App
  // aber nicht mehr geschrieben oder angezeigt.
  sterne: number | null;
  kommentar: string | null;
  erstellt_am: string;
}

export interface Favorite {
  user_id: string;
  route_id: string;
  erstellt_am: string;
}

export interface RouteCompletion {
  id: string;
  user_id: string;
  route_id: string;
  fahrzeug_id: string | null;
  datum: string;
  foto_url: string | null;
  // Beide optional und rein privat — nur gesetzt, wenn der Nutzer den Timer
  // beim Live-Tracking aktiv eingeschaltet hat. Kein Vergleich zwischen Nutzern.
  dauer_sekunden: number | null;
  distanz_km: number | null;
  // Opt-in pro Fahrt (siehe 0017_pro_fahrt_sichtbarkeit.sql) — entscheidet im
  // Fazit-Screen bzw. nachträglich im Profil, ob diese Fahrt auf
  // Bestenlisten/öffentlichem Profil erscheint. Standardmässig false.
  ist_oeffentlich: boolean;
  // Deckungsgrad (0-100) ggü. der offiziellen Streckengeometrie, siehe
  // 0019_streckenabdeckung.sql. Unterhalb von COVERAGE_THRESHOLD_PERCENT
  // (lib/routeCoverage.ts) kann ist_oeffentlich nicht true sein.
  abdeckung_prozent: number;
  // Optionale persönliche Notiz (max. 280 Zeichen), rein privat, siehe
  // 0020_fahrt_notiz.sql.
  notiz: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  is_moderator: boolean;
  zeigt_fahrzeuge: boolean;
  // Vier unabhängige Opt-ins fürs öffentliche Profil, siehe
  // 0018_granulare_profil_sichtbarkeit.sql. Die Sichtbarkeit einzelner
  // Fahrten selbst läuft separat über route_completions.ist_oeffentlich.
  zeigt_avatar: boolean;
  zeigt_paesse: boolean;
  zeigt_hoehenmeter: boolean;
  zeigt_distanz: boolean;
  avatar_url: string | null;
  // Siehe 0021_premium_und_private_strecken.sql. ist_premium ist vorerst
  // manuell gesetzt (kein Zahlungsanbieter angebunden).
  ist_premium: boolean;
  zeigt_premium_badge: boolean;
  created_at: string;
}

// Zeilenform von public.public_fahrten (siehe 0015/0018/0030/0032) — stark
// eingeschränkte, öffentliche Sicht auf gefahrene Strecken fürs öffentliche
// Profil, den Community-Feed (app/feed/page.tsx) und die Fahrt-
// Detailseite (app/fahrten/[id]/page.tsx).
export interface PublicFahrt {
  user_id: string;
  route_id: string;
  route_name: string;
  region: string;
  laenge_km: number;
  distanz_km: number | null;
  datum: string;
  completion_id: string;
  // Ab 0030_follows_and_feed.sql. avatar_url ist bereits serverseitig auf
  // null gesetzt, wenn der Fahrer zeigt_avatar nicht aktiviert hat.
  display_name: string | null;
  avatar_url: string | null;
  // Ab 0032_public_fahrten_dauer.sql — bei öffentlichen Fahrten schon
  // länger über route_leaderboard/leaderboard_completions offengelegt.
  dauer_sekunden: number | null;
  // Ab 0034_public_fahrten_foto.sql — für die Fotos-Sektion auf der
  // Fahrt-Detailseite (app/fahrten/[id]/page.tsx). Schon länger über
  // route_photos auf der Streckenseite öffentlich sichtbar.
  foto_url: string | null;
}

// Zeilenform von public.route_photos — nur die für eine öffentliche
// Foto-Galerie nötigen, unkritischen Felder (kein user_id, kein fahrzeug_id).
export interface RoutePhoto {
  id: string;
  route_id: string;
  foto_url: string;
  datum: string;
  display_name: string | null;
}

// Minimales Database-Interface für den generischen Supabase-Client-Typparameter.
// Wird in Phase 2/3 durch generierte Typen ersetzt.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
