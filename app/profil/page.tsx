import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import VehicleList from "@/components/VehicleList";
import DeleteProposalButton from "@/components/DeleteProposalButton";
import AvatarUpload from "@/components/AvatarUpload";
import RideVisibilityToggle from "@/components/RideVisibilityToggle";
import ShareRideButton from "@/components/ShareRideButton";
import PremiumCard from "@/components/PremiumCard";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format";
import type { Vehicle } from "@/types/database";

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
      .select("display_name, avatar_url, zeigt_fahrzeuge, ist_premium")
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
    <div className="flex h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 overflow-y-auto px-5 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <AvatarUpload avatarUrl={profile?.avatar_url ?? null} name={profile?.display_name ?? null} />
            <form action="/auth/abmelden" method="post" className="shrink-0">
              <button className="whitespace-nowrap text-sm text-[#8A8F98] hover:text-[#131316]">
                Abmelden
              </button>
            </form>
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {profile?.display_name ?? user.email}
            </h1>
            <p className="text-sm text-[#8A8F98]">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/strecken/neu"
              className="self-start border border-[#131316] px-3 py-1.5 text-sm font-medium text-[#131316] hover:bg-[#131316] hover:text-[#FAFAFA]"
            >
              + Strecke vorschlagen
            </Link>
            <Link
              href={`/fahrer/${user.id}`}
              className="self-start border border-[#131316]/30 px-3 py-1.5 text-sm text-[#131316] hover:border-[#131316]"
            >
              Öffentliches Profil ansehen
            </Link>
            <Link
              href="/profil/privatsphaere"
              className="self-start border border-[#131316]/30 px-3 py-1.5 text-sm text-[#131316] hover:border-[#131316]"
            >
              Privatsphäre-Einstellungen
            </Link>
          </div>
        </div>

        <PremiumCard istPremium={profile?.ist_premium ?? false} />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[#131316]/10 py-4 text-sm">
          <div>
            <dt className="text-[#8A8F98]">Pässe befahren</dt>
            <dd className="font-mono text-lg tabular-nums">{passCount}</dd>
          </div>
          <div>
            <dt className="text-[#8A8F98]">Höhenmeter gesammelt</dt>
            <dd className="font-mono text-lg tabular-nums">
              {hoehenmeter.toLocaleString("de-CH")} m
            </dd>
          </div>
          <div>
            <dt className="text-[#8A8F98]">Km gefahren</dt>
            <dd className="font-mono text-lg tabular-nums">
              {getrackteDistanzGesamt.toFixed(0)} km
            </dd>
          </div>
          <div>
            <dt className="text-[#8A8F98]">Anzahl Fahrten</dt>
            <dd className="font-mono text-lg tabular-nums">{trackedRides?.length ?? 0}</dd>
          </div>
        </dl>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
            Getrackte Fahrten
          </h2>
          {trackedRides && trackedRides.length > 0 ? (
            <ul className="flex flex-col">
              {trackedRides.map((ride) => {
                const avgKmh =
                  ride.dauer_sekunden > 0 ? ride.distanz_km / (ride.dauer_sekunden / 3600) : 0;
                return (
                  <li key={ride.id} className="border-b border-[#131316]/10 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/strecken/${ride.route_id}`}
                        className="flex min-w-0 flex-1 items-baseline justify-between text-sm transition-colors duration-150 hover:text-[#3D5AFE]"
                      >
                        <span className="truncate">
                          {ride.routes?.name ?? "Strecke"}
                          <span className="ml-2 text-xs text-[#8A8F98]">
                            {new Date(ride.datum).toLocaleDateString("de-CH")}
                          </span>
                        </span>
                        <span className="ml-2 shrink-0 font-mono tabular-nums text-[#8A8F98]">
                          {ride.distanz_km.toFixed(1)} km · {formatDuration(ride.dauer_sekunden)} ·{" "}
                          {avgKmh.toFixed(0)} km/h
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
                    {ride.notiz && (
                      <p className="mt-1 text-sm text-[#8A8F98]">{ride.notiz}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[#8A8F98]">Noch keine Fahrten aufgezeichnet.</p>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
              Fahrzeuge
            </h2>
            <Link href="/profil/fahrzeuge/neu" className="text-sm text-[#3D5AFE]">
              + Fahrzeug hinzufügen
            </Link>
          </div>
          <VehicleList vehicles={(vehicles as Vehicle[]) ?? []} />
        </section>

        {ownRoutes && ownRoutes.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
              Meine Streckenvorschläge
            </h2>
            <ul className="flex flex-col">
              {ownRoutes.map((route) => {
                const label = route.status_ok
                  ? "Bewilligt"
                  : route.ist_privat
                    ? "Privat"
                    : route.abgelehnt_am
                      ? "Abgelehnt"
                      : "Ausstehend";
                const color = route.status_ok
                  ? "text-[#3D5AFE]"
                  : route.abgelehnt_am
                    ? "text-red-600"
                    : "text-[#8A8F98]";
                return (
                  <li
                    key={route.id}
                    className="flex items-center justify-between gap-3 border-b border-[#131316]/10 py-2"
                  >
                    <Link
                      href={`/strecken/${route.id}`}
                      className="truncate transition-colors duration-150 hover:text-[#3D5AFE]"
                    >
                      {route.name}
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`text-sm font-medium ${color}`}>{label}</span>
                      {!route.status_ok && (
                        <Link
                          href={`/strecken/${route.id}/bearbeiten`}
                          className="text-xs text-[#8A8F98] hover:text-[#131316]"
                        >
                          Bearbeiten
                        </Link>
                      )}
                      {route.abgelehnt_am && <DeleteProposalButton routeId={route.id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
            Favoriten
          </h2>
          {favorites && favorites.length > 0 ? (
            <ul className="flex flex-col">
              {favorites.map((f) =>
                f.routes ? (
                  <li key={f.route_id}>
                    <Link
                      href={`/strecken/${f.route_id}`}
                      className="group flex items-baseline justify-between border-b border-[#131316]/10 py-2 transition-colors duration-150 hover:bg-[#3D5AFE]/[0.06]"
                    >
                      <span className="transition-colors duration-150 group-hover:text-[#3D5AFE]">
                        {f.routes.name}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-[#8A8F98]">
                        {f.routes.laenge_km} km
                      </span>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <p className="text-sm text-[#8A8F98]">Noch keine Favoriten gemerkt.</p>
          )}
        </section>

      </main>
    </div>
  );
}
