import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import VehicleList from "@/components/VehicleList";
import DeleteProposalButton from "@/components/DeleteProposalButton";
import AvatarUpload from "@/components/AvatarUpload";
import RideVisibilityToggle from "@/components/RideVisibilityToggle";
import ShareRideButton from "@/components/ShareRideButton";
import AchievementBadges from "@/components/AchievementBadges";
import ActivityHeatmap from "@/components/ActivityHeatmap";
// Premium-Feature vorerst deaktiviert, siehe components/PremiumCard.tsx.
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/anmelden");
  }

  // Alle voneinander unabhängigen Abfragen parallel statt nacheinander —
  // spart auf einer Seite mit sechs Queries einen entsprechend langen
  // Round-Trip-Wasserfall (vorher: jede Query wartete auf die vorherige,
  // obwohl keine von einer anderen abhängt).
  const [
    { data: profile },
    { data: vehicles },
    { data: completions },
    { data: trackedRides },
    { data: ownRoutes },
    { data: favorites },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, zeigt_fahrzeuge")
      .eq("id", user.id)
      .single(),
    // Explizit auf den eigenen Nutzer filtern statt allein auf RLS zu
    // vertrauen: die zweite SELECT-Policy "Fahrzeuge sichtbar wenn
    // freigegeben" (0015) erlaubt RLS-seitig auch fremde Fahrzeuge, deren
    // Besitzer zeigt_fahrzeuge aktiviert hat (fürs öffentliche Profil gedacht,
    // siehe lib/profile.ts) — ohne dieses .eq() würden beide Policies
    // per OR kombiniert und fremde freigegebene Fahrzeuge hier mit einfliessen.
    supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("route_completions")
      .select("route_id, routes(hoehe_m)")
      .eq("user_id", user.id)
      .returns<{ route_id: string; routes: { hoehe_m: number | null } | null }[]>(),
    supabase
      .from("route_completions")
      .select(
        "id, route_id, datum, dauer_sekunden, distanz_km, ist_oeffentlich, abdeckung_prozent, notiz, routes(name)",
      )
      .eq("user_id", user.id)
      .not("dauer_sekunden", "is", null)
      // Neueste zuerst — created_at als Tiebreaker, da datum nur ein Datum
      // (kein Zeitstempel) ist und mehrere Fahrten am selben Tag sonst in
      // unbestimmter Reihenfolge stünden.
      .order("datum", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          route_id: string;
          datum: string;
          dauer_sekunden: number;
          distanz_km: number;
          ist_oeffentlich: boolean;
          abdeckung_prozent: number;
          notiz: string | null;
          routes: { name: string } | null;
        }[]
      >(),
    supabase
      .from("routes")
      .select("id, name, status_ok, abgelehnt_am, ist_privat")
      .eq("erstellt_von", user.id)
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          name: string;
          status_ok: boolean;
          abgelehnt_am: string | null;
          ist_privat: boolean;
        }[]
      >(),
    supabase
      .from("favorites")
      .select("route_id, routes(id, name, region, laenge_km)")
      .eq("user_id", user.id)
      .order("erstellt_am", { ascending: false })
      .returns<
        {
          route_id: string;
          routes: { id: string; name: string; region: string; laenge_km: number } | null;
        }[]
      >(),
  ]);

  // Pro Strecke nur einmal zählen (auch bei mehrfacher Befahrung) — sonst
  // widersprechen sich passCount (dedupliziert) und hoehenmeter auf demselben
  // Screen; entspricht der Dedup-Logik in lib/profile.ts (öffentliches Profil).
  const hoeheProRoute = new Map<string, number>();
  for (const c of completions ?? []) {
    if (!hoeheProRoute.has(c.route_id)) hoeheProRoute.set(c.route_id, c.routes?.hoehe_m ?? 0);
  }
  const passCount = hoeheProRoute.size;
  const hoehenmeter = [...hoeheProRoute.values()].reduce((sum, h) => sum + h, 0);

  const getrackteDistanzGesamt = (trackedRides ?? []).reduce(
    (sum, r) => sum + r.distanz_km,
    0,
  );

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 overflow-y-auto px-5 py-8 sm:px-6 sm:py-10 lg:max-w-4xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <AvatarUpload avatarUrl={profile?.avatar_url ?? null} name={profile?.display_name ?? null} />
            <form action="/auth/abmelden" method="post" className="shrink-0">
              <button className="whitespace-nowrap text-sm text-muted transition-colors duration-fast hover:text-foreground">
                Abmelden
              </button>
            </form>
          </div>
          <div>
            <h1 className="text-display font-semibold">
              {profile?.display_name ?? user.email}
            </h1>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/strecken/neu"
              className={buttonVariants({ variant: "primary", size: "sm", className: "self-start" })}
            >
              + Strecke vorschlagen
            </Link>
            <Link
              href={`/fahrer/${user.id}`}
              className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}
            >
              Öffentliches Profil ansehen
            </Link>
            <Link
              href="/profil/privatsphaere"
              className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}
            >
              Privatsphäre-Einstellungen
            </Link>
          </div>
        </div>

        {/* Bento-Layout: Pässe/Höhenmeter als grössere Kacheln (die zwei
            Zahlen, die die eigene Fahrleidenschaft am besten zusammenfassen),
            Km/Fahrten kleinteiliger daneben — dl bleibt als semantischer
            Rahmen um alle dt/dd-Paare erhalten (siehe app/strecken/[id]/page.tsx
            für dasselbe Muster). */}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card surface className="flex flex-col justify-between gap-1 p-4">
            <dt className="text-sm text-muted">Pässe befahren</dt>
            <dd className="text-title font-mono font-semibold tabular-nums">{passCount}</dd>
          </Card>
          <Card surface className="flex flex-col justify-between gap-1 p-4">
            <dt className="text-sm text-muted">Höhenmeter gesammelt</dt>
            <dd className="text-title font-mono font-semibold tabular-nums">
              {hoehenmeter.toLocaleString("de-CH")} m
            </dd>
          </Card>
          <Card surface className="flex flex-col justify-between gap-1 p-4">
            <dt className="text-sm text-muted">Km gefahren</dt>
            <dd className="font-mono text-lg tabular-nums">{getrackteDistanzGesamt.toFixed(0)} km</dd>
          </Card>
          <Card surface className="flex flex-col justify-between gap-1 p-4">
            <dt className="text-sm text-muted">Anzahl Fahrten</dt>
            <dd className="font-mono text-lg tabular-nums">{trackedRides?.length ?? 0}</dd>
          </Card>
        </dl>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Auszeichnungen
          </h2>
          <AchievementBadges
            passCount={passCount}
            hoehenmeter={hoehenmeter}
            fahrtenCount={trackedRides?.length ?? 0}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Aktivität</h2>
          <ActivityHeatmap dates={(trackedRides ?? []).map((r) => r.datum)} />
        </section>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
                Getrackte Fahrten
              </h2>
              {trackedRides && trackedRides.length > 0 ? (
                <Card as="ul" className="divide-y divide-border">
                  {trackedRides.map((ride) => {
                    const avgKmh =
                      ride.dauer_sekunden > 0
                        ? ride.distanz_km / (ride.dauer_sekunden / 3600)
                        : 0;
                    return (
                      <li key={ride.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/strecken/${ride.route_id}`}
                            className="flex min-w-0 flex-1 items-baseline justify-between text-sm transition-colors duration-fast hover:text-accent"
                          >
                            <span className="truncate">
                              {ride.routes?.name ?? "Strecke"}
                              <span className="ml-2 text-xs text-muted">
                                {new Date(ride.datum).toLocaleDateString("de-CH")}
                              </span>
                            </span>
                            <span className="ml-2 shrink-0 font-mono tabular-nums text-muted">
                              {ride.distanz_km.toFixed(1)} km · {formatDuration(ride.dauer_sekunden)}{" "}
                              · {avgKmh.toFixed(0)} km/h
                            </span>
                          </Link>
                          <div className="flex shrink-0 items-center gap-3">
                            <ShareRideButton
                              routeId={ride.route_id}
                              distanceKm={ride.distanz_km}
                              durationSeconds={ride.dauer_sekunden}
                              date={ride.datum}
                            />
                            <RideVisibilityToggle
                              completionId={ride.id}
                              isPublic={ride.ist_oeffentlich}
                              coveragePercent={ride.abdeckung_prozent}
                            />
                          </div>
                        </div>
                        {ride.notiz && <p className="mt-1 text-sm text-muted">{ride.notiz}</p>}
                      </li>
                    );
                  })}
                </Card>
              ) : (
                <p className="text-sm text-muted">Noch keine Fahrten aufgezeichnet.</p>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
                Favoriten
              </h2>
              {favorites && favorites.length > 0 ? (
                <Card as="ul" className="divide-y divide-border">
                  {favorites.map((f) =>
                    f.routes ? (
                      <li key={f.route_id}>
                        <Link
                          href={`/strecken/${f.route_id}`}
                          className="group flex items-baseline justify-between px-4 py-3 transition-colors duration-fast hover:bg-surface"
                        >
                          <span className="transition-colors duration-fast group-hover:text-accent">
                            {f.routes.name}
                          </span>
                          <span className="font-mono text-sm tabular-nums text-muted">
                            {f.routes.laenge_km} km
                          </span>
                        </Link>
                      </li>
                    ) : null,
                  )}
                </Card>
              ) : (
                <p className="text-sm text-muted">Noch keine Favoriten gemerkt.</p>
              )}
            </section>
          </div>

          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
                  Fahrzeuge
                </h2>
                <Link
                  href="/profil/fahrzeuge/neu"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  + Fahrzeug hinzufügen
                </Link>
              </div>
              <VehicleList vehicles={(vehicles as Vehicle[]) ?? []} />
            </section>

            {ownRoutes && ownRoutes.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
                  Meine Streckenvorschläge
                </h2>
                <Card as="ul" className="divide-y divide-border">
                  {ownRoutes.map((route) => {
                    const label = route.status_ok
                      ? "Bewilligt"
                      : route.ist_privat
                        ? "Privat"
                        : route.abgelehnt_am
                          ? "Abgelehnt"
                          : "Ausstehend";
                    const color = route.status_ok
                      ? "text-accent"
                      : route.abgelehnt_am
                        ? "text-danger"
                        : "text-muted";
                    return (
                      <li
                        key={route.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <Link
                          href={`/strecken/${route.id}`}
                          className="truncate transition-colors duration-fast hover:text-accent"
                        >
                          {route.name}
                        </Link>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className={`text-sm font-medium ${color}`}>{label}</span>
                          {!route.status_ok && (
                            <Link
                              href={`/strecken/${route.id}/bearbeiten`}
                              className="text-xs text-muted hover:text-foreground"
                            >
                              Bearbeiten
                            </Link>
                          )}
                          {route.abgelehnt_am && <DeleteProposalButton routeId={route.id} />}
                        </div>
                      </li>
                    );
                  })}
                </Card>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
