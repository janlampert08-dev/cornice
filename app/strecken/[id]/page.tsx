import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import RouteDetailMap from "@/components/RouteDetailMap";
import FavoriteButton from "@/components/FavoriteButton";
import RatingSection from "@/components/RatingSection";
import GefahrenSection from "@/components/GefahrenSection";
import RouteActionsMenu from "@/components/RouteActionsMenu";
import PublishRouteButton from "@/components/PublishRouteButton";
import ElevationProfile from "@/components/ElevationProfile";
import PhotoGallery from "@/components/PhotoGallery";
import { getRoute } from "@/lib/routes";
import { getRatings, getOwnRating } from "@/lib/ratings";
import { getPersonalBestSeconds } from "@/lib/completions";
import { getRoutePhotos } from "@/lib/photos";
import { isFavorite } from "@/lib/favorites";
import { isModerator } from "@/lib/moderation";
import { getRouteLeaderboard } from "@/lib/leaderboard";
import { fetchCurrentWeather } from "@/lib/weather";
import { createClient } from "@/lib/supabase/server";
import { KATEGORIEN } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { averageTempolimit, estimateRouteDurationMinutes, formatMinutes } from "@/lib/geo";
import type { Vehicle } from "@/types/database";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

const KATEGORIE_LABEL = Object.fromEntries(
  KATEGORIEN.map((k) => [k.value, k.label]),
) as Record<string, string>;

const SAISON_LABEL = { saisonal: "Saisonal (Winterschliessung)" };

// getRoute() ist mit React cache() memoisiert (lib/routes.ts) — derselbe
// Aufruf hier und in der Page unten kostet innerhalb desselben Requests
// nur eine DB-Abfrage.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const route = await getRoute(id);
  if (!route) return { title: "Strecke – Cornice" };

  return {
    title: `${route.name} – Cornice`,
    description:
      route.charakter_text ??
      `${route.region}: ${route.start_ort} → ${route.ziel_ort}, ${route.laenge_km.toFixed(0)} km`,
  };
}

export default async function StreckeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // getRoute() und auth.getUser() sind voneinander unabhängig (Routenabruf
  // braucht den Nutzer nicht, RLS entscheidet allein über die route_id) —
  // parallel statt nacheinander gestartet.
  const [route, {
    data: { user },
  }] = await Promise.all([getRoute(id), supabase.auth.getUser()]);

  if (!route) notFound();

  const [ratings, ownRating, favorite, vehicles, personalBestSeconds, photos, leaderboard, weather, moderator] =
    await Promise.all([
      getRatings(id),
      user ? getOwnRating(id, user.id) : Promise.resolve(null),
      user ? isFavorite(id, user.id) : Promise.resolve(false),
      user
        ? supabase
            .from("vehicles")
            .select("*")
            .eq("user_id", user.id)
            .then((r) => (r.data as Vehicle[]) ?? [])
        : Promise.resolve([] as Vehicle[]),
      user ? getPersonalBestSeconds(id, user.id) : Promise.resolve(null),
      getRoutePhotos(id),
      getRouteLeaderboard(id),
      fetchCurrentWeather(route.start_geojson.coordinates as [number, number]),
      user ? isModerator(user.id) : Promise.resolve(false),
    ]);
  const record = leaderboard[0] ?? null;

  return (
    <div className="flex h-dvh flex-col">
      <Header back="/" />
      <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div className="h-72 shrink-0 md:order-2 md:h-auto md:flex-1">
          <RouteDetailMap route={route} key={route.id} />
        </div>
        <div className="flex w-full flex-col gap-5 overflow-y-auto overscroll-y-contain border-border px-5 py-6 sm:px-6 sm:py-8 md:max-w-md md:border-r lg:max-w-lg xl:max-w-xl">
          <div>
            <p className="text-sm text-muted">
              {route.region}
              {route.ist_rundfahrt && " · Rundfahrt"}
            </p>
            <h1 className="text-display font-semibold tracking-tight">{route.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {route.ist_rundfahrt ? `Start/Ziel: ${route.start_ort}` : `${route.start_ort} → ${route.ziel_ort}`}
            </p>
          </div>

          {route.ist_privat && user?.id === route.erstellt_von && (
            <Card surface className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-muted">Privat — nur du siehst diese Strecke.</span>
              <PublishRouteButton routeId={id} />
            </Card>
          )}

          <div className="flex flex-wrap items-start gap-2">
            {user && <FavoriteButton routeId={id} initialFavorite={favorite} />}
            <RouteActionsMenu
              route={route}
              moderator={moderator}
              isOwner={!moderator && user?.id === route.erstellt_von && !route.status_ok}
            />
            {!moderator && user?.id === route.erstellt_von && !route.status_ok && (
              <Link
                href={`/strecken/${id}/bearbeiten`}
                className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}
              >
                Bearbeiten
              </Link>
            )}
          </div>

          {user ? (
            <GefahrenSection
              route={route}
              vehicles={vehicles}
              personalBestSeconds={personalBestSeconds}
            />
          ) : (
            <p className="border-t border-border pt-6 text-sm text-muted">
              Melde dich an, um diese Strecke als gefahren einzutragen und zu bewerten.
            </p>
          )}

          {route.hoehenprofil && route.hoehenprofil.length > 1 && (
            <ElevationProfile punkte={route.hoehenprofil} />
          )}

          <Card as="dl" className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 text-sm">
            <div>
              <dt className="text-muted">Länge</dt>
              <dd className="font-mono tabular-nums">{route.laenge_km} km</dd>
            </div>
            <div>
              <dt className="text-muted">Höhe</dt>
              <dd className="font-mono tabular-nums">
                {route.hoehe_m !== null ? `${route.hoehe_m} m` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Max. Steigung</dt>
              <dd className="font-mono tabular-nums">
                {route.max_steigung_prozent !== null ? `${route.max_steigung_prozent}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Kehren</dt>
              <dd className="font-mono tabular-nums">{route.kehren ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Ø Tempolimit</dt>
              <dd className="font-mono tabular-nums">
                {averageTempolimit(route.tempolimits) !== null
                  ? `${averageTempolimit(route.tempolimits)} km/h`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Fahrzeit</dt>
              <dd className="font-mono tabular-nums">
                ~
                {formatMinutes(
                  estimateRouteDurationMinutes(
                    route.laenge_km,
                    route.kategorien,
                    route.tempolimits,
                  ),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Wetter</dt>
              <dd className="font-mono tabular-nums">
                {weather ? (
                  <>
                    {weather.tempC}°C
                    <span className="ml-1.5 font-sans text-xs normal-case text-muted">
                      {weather.label}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Rekord</dt>
              <dd className="font-mono tabular-nums">
                {record ? (
                  <span className="inline-flex flex-wrap items-baseline gap-x-2">
                    {formatDuration(record.dauerSekunden)}
                    <Link
                      href={`/fahrer/${record.userId}`}
                      className="font-sans text-xs font-normal normal-case text-muted hover:text-accent"
                    >
                      {record.name}
                    </Link>
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {route.kategorien.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
                >
                  {KATEGORIE_LABEL[k] ?? k}
                </span>
              ))}
              {route.saison_status === "saisonal" && (
                <span className="text-sm text-muted">{SAISON_LABEL.saisonal}</span>
              )}
            </div>

            {route.charakter_text && (
              <p className="text-sm leading-relaxed text-foreground">{route.charakter_text}</p>
            )}
          </div>

          <PhotoGallery photos={photos} />

          <RatingSection
            routeId={id}
            ratings={ratings}
            ownRating={ownRating}
            canRate={!!user}
          />
        </div>
      </main>
    </div>
  );
}
