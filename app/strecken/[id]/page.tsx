import { notFound } from "next/navigation";
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

const KATEGORIE_LABEL = Object.fromEntries(
  KATEGORIEN.map((k) => [k.value, k.label]),
) as Record<string, string>;

const SAISON_LABEL = { saisonal: "Saisonal (Winterschliessung)" };

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
    <div className="flex h-screen flex-col">
      <Header back="/" />
      <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div className="h-72 shrink-0 md:order-2 md:h-auto md:flex-1">
          <RouteDetailMap route={route} key={route.id} />
        </div>
        <div className="flex w-full flex-col gap-5 overflow-y-auto border-[#131316]/10 px-5 py-6 sm:px-6 sm:py-8 md:max-w-md md:border-r">
          <div>
            <p className="text-sm text-[#8A8F98]">
              {route.region}
              {route.ist_rundfahrt && " · Rundfahrt"}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
            <p className="mt-1 text-sm text-[#8A8F98]">
              {route.ist_rundfahrt ? `Start/Ziel: ${route.start_ort}` : `${route.start_ort} → ${route.ziel_ort}`}
            </p>
          </div>

          {route.ist_privat && user?.id === route.erstellt_von && (
            <div className="flex items-center justify-between gap-3 border border-[#131316]/20 bg-[#131316]/[0.03] px-3 py-2 text-sm">
              <span className="text-[#8A8F98]">Privat — nur du siehst diese Strecke.</span>
              <PublishRouteButton routeId={id} />
            </div>
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
                className="self-start border border-[#131316]/30 px-3 py-1.5 text-sm text-[#131316] hover:border-[#131316]"
              >
                Bearbeiten
              </Link>
            )}
          </div>

          {route.hoehenprofil && route.hoehenprofil.length > 1 && (
            <ElevationProfile punkte={route.hoehenprofil} />
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[#131316]/10 py-4 text-sm">
            <div>
              <dt className="text-[#8A8F98]">Länge</dt>
              <dd className="font-mono tabular-nums">{route.laenge_km} km</dd>
            </div>
            <div>
              <dt className="text-[#8A8F98]">Höhe</dt>
              <dd className="font-mono tabular-nums">
                {route.hoehe_m !== null ? `${route.hoehe_m} m` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[#8A8F98]">Max. Steigung</dt>
              <dd className="font-mono tabular-nums">
                {route.max_steigung_prozent !== null ? `${route.max_steigung_prozent}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[#8A8F98]">Kehren</dt>
              <dd className="font-mono tabular-nums">{route.kehren ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#8A8F98]">Ø Tempolimit</dt>
              <dd className="font-mono tabular-nums">
                {averageTempolimit(route.tempolimits) !== null
                  ? `${averageTempolimit(route.tempolimits)} km/h`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[#8A8F98]">Fahrzeit</dt>
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
              <dt className="text-[#8A8F98]">Wetter</dt>
              <dd className="font-mono tabular-nums">
                {weather ? (
                  <>
                    {weather.tempC}°C
                    <span className="ml-1.5 font-sans text-xs normal-case text-[#8A8F98]">
                      {weather.label}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[#8A8F98]">Rekord</dt>
              <dd className="font-mono tabular-nums">
                {record ? (
                  <div className="flex flex-col gap-0.5">
                    <span>{formatDuration(record.dauerSekunden)}</span>
                    <Link
                      href={`/fahrer/${record.userId}`}
                      className={`w-fit font-sans text-xs font-normal normal-case hover:text-[#3D5AFE] ${
                        record.isPremiumBadge ? "text-[#C9A227]" : "text-[#8A8F98]"
                      }`}
                    >
                      {record.name}
                    </Link>
                  </div>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {route.kategorien.map((k) => (
                <span
                  key={k}
                  className="border border-[#131316]/20 px-2 py-1 text-xs text-[#131316]"
                >
                  {KATEGORIE_LABEL[k] ?? k}
                </span>
              ))}
              {route.saison_status === "saisonal" && (
                <span className="text-sm text-[#8A8F98]">{SAISON_LABEL.saisonal}</span>
              )}
            </div>

            {route.charakter_text && (
              <p className="text-sm leading-relaxed text-[#131316]">{route.charakter_text}</p>
            )}
          </div>

          {user ? (
            <GefahrenSection
              route={route}
              vehicles={vehicles}
              personalBestSeconds={personalBestSeconds}
            />
          ) : (
            <p className="border-t border-[#131316]/10 pt-6 text-sm text-[#8A8F98]">
              Melde dich an, um diese Strecke als gefahren einzutragen und zu bewerten.
            </p>
          )}

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
