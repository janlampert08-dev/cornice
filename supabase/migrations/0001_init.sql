-- Cornice — initiales Datenbankschema
-- Aktiviert PostGIS und legt alle Kern-Tabellen inkl. RLS-Policies an.

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- profiles (1:1 zu auth.users, damit display_name öffentlich abrufbar ist)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profile sind öffentlich lesbar"
  on public.profiles for select
  using (true);

create policy "Nutzer können ihr eigenes Profil bearbeiten"
  on public.profiles for update
  using (auth.uid() = id);

-- Legt bei jeder Neuregistrierung automatisch ein Profil an.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  typ text not null check (typ in ('auto', 'motorrad')),
  marke text not null,
  modell text not null,
  getriebe text not null check (getriebe in ('manuell', 'automatik')),
  baujahr int check (baujahr between 1900 and 2100),
  created_at timestamptz not null default now()
);

create index vehicles_user_id_idx on public.vehicles (user_id);

alter table public.vehicles enable row level security;

create policy "Nutzer sehen nur eigene Fahrzeuge"
  on public.vehicles for select
  using (auth.uid() = user_id);

create policy "Nutzer verwalten eigene Fahrzeuge"
  on public.vehicles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- routes
-- ---------------------------------------------------------------------------
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  start_ort text not null,
  ziel_ort text not null,
  start_coord geography(Point, 4326) not null,
  ziel_coord geography(Point, 4326) not null,
  geometry geography(LineString, 4326) not null,
  hoehe_m numeric,
  laenge_km numeric not null check (laenge_km > 0),
  max_steigung_prozent numeric,
  kehren int,
  kategorien text[] not null default '{}',
  saison_status text not null default 'ganzjaehrig' check (saison_status in ('ganzjaehrig', 'saisonal')),
  status_ok boolean not null default false,
  charakter_text text,
  erstellt_von uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint kategorien_gueltig check (
    kategorien <@ array['kurvig', 'scenic', 'passstrasse', 'freie_fahrt']::text[]
  )
);

-- Räumliche Indizes für Umkreis-/Distanzabfragen ("Strecken in meiner Nähe").
create index routes_start_coord_idx on public.routes using gist (start_coord);
create index routes_geometry_idx on public.routes using gist (geometry);
create index routes_kategorien_idx on public.routes using gin (kategorien);

alter table public.routes enable row level security;

create policy "Freigegebene Strecken sind öffentlich lesbar"
  on public.routes for select
  using (status_ok = true or erstellt_von = auth.uid());

create policy "Angemeldete Nutzer können Strecken vorschlagen"
  on public.routes for insert
  to authenticated
  with check (erstellt_von = auth.uid() and status_ok = false);

create policy "Nutzer können eigene unverifizierte Strecken bearbeiten"
  on public.routes for update
  using (erstellt_von = auth.uid() and status_ok = false);

-- ---------------------------------------------------------------------------
-- route_ratings
-- ---------------------------------------------------------------------------
create table public.route_ratings (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sterne int not null check (sterne between 1 and 5),
  kommentar text,
  erstellt_am timestamptz not null default now(),
  unique (route_id, user_id)
);

create index route_ratings_route_id_idx on public.route_ratings (route_id);

alter table public.route_ratings enable row level security;

create policy "Bewertungen sind öffentlich lesbar"
  on public.route_ratings for select
  using (true);

create policy "Nutzer verwalten eigene Bewertungen"
  on public.route_ratings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (user_id, route_id)
);

alter table public.favorites enable row level security;

create policy "Nutzer verwalten eigene Favoriten"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- route_completions
-- Bewusst KEINE Zeitmessung/Dauer pro Fahrt — nur Nachweis "gefahren" + Datum
-- für Profilstatistiken (Anzahl Pässe, gesammelte Höhenmeter).
-- ---------------------------------------------------------------------------
create table public.route_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  fahrzeug_id uuid references public.vehicles (id) on delete set null,
  datum date not null default current_date,
  foto_url text,
  created_at timestamptz not null default now()
);

create index route_completions_user_id_idx on public.route_completions (user_id);
create index route_completions_route_id_idx on public.route_completions (route_id);

alter table public.route_completions enable row level security;

create policy "Nutzer sehen eigene Fahrten"
  on public.route_completions for select
  using (auth.uid() = user_id);

create policy "Nutzer verwalten eigene Fahrten"
  on public.route_completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
