# Cornice

Kuratierte Auto-/Motorrad-Fahrstrecken — primär Raum Zürich/Schweiz.

## Setup

1. Abhängigkeiten sind bereits installiert (`npm install`).
2. `.env.local` aus `.env.local.example` erstellen und befüllen:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
     aus einem Supabase-Projekt (Settings → API). Lokale Entwicklung per
     `supabase start` würde Docker voraussetzen, das hier nicht verfügbar ist —
     daher direkt gegen ein Cloud-Projekt (supabase.com) entwickeln.
   - `NEXT_PUBLIC_MAPBOX_TOKEN` von account.mapbox.com/access-tokens.
3. Schema anlegen: Inhalt von `supabase/migrations/0001_init.sql` im Supabase
   SQL Editor ausführen (oder via `npx supabase db push`, sobald das Projekt
   mit `npx supabase link` verknüpft ist).
4. `npm run dev` und `http://localhost:3000` öffnen.

## Projektstruktur

- `app/` — Next.js App Router (Seiten, Layout)
- `components/` — UI-Komponenten (z. B. `RouteMap.tsx`)
- `lib/` — Supabase-Clients, Konstanten, Hilfsfunktionen
- `types/` — Geteilte TypeScript-Typen (`database.ts` spiegelt das SQL-Schema)
- `supabase/migrations/` — SQL-Schema inkl. PostGIS und Row Level Security

## Design-Sprache

"Precision Rounded": Hintergrund `#FAFAFA`, Text `#131316`, Akzent `#3D5AFE`,
Sekundärtext `#8A8F98`, dazu Oberflächen-/Rahmen-/Statustokens
(`--color-surface`, `--color-border[-strong]`, `--color-danger/-success/-warning`)
und eine Radius-Skala (`--radius-sm/md/lg`) — siehe `app/globals.css`. Inter
für Fliesstext, IBM Plex Mono für tabellarische Zahlen (Ränge, km,
Höhenmeter). Schatten sind bewusst selten und nur für tatsächlich schwebende
Flächen reserviert (`--shadow-elevated`: Dropdowns, Dialoge, Live-Tracking-
Overlay) — ruhende Flächen bekommen weiterhin nur eine Haarlinie
(`--color-border`). Geteilte UI-Bausteine (Button, Card, Input, Dialog,
Skeleton, StatusPage) liegen in `components/ui/`.

## Bewusste Einschränkungen

 siehe
`route_completions` in `supabase/migrations/0001_init.sql`.
