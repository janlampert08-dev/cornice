import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Gauge, Mountain, Route as RouteIcon, Ruler } from "lucide-react";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import KudosButton from "@/components/KudosButton";
import ElevationProfile from "@/components/ElevationProfile";
import CompletionMap from "@/components/CompletionMap";
import CompletionPhoto from "@/components/CompletionPhoto";
import { getCompletionDetail } from "@/lib/completions";
import { getRoute } from "@/lib/routes";
import { getKudosForCompletions } from "@/lib/kudos";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format";
import Card from "@/components/ui/Card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const completion = await getCompletionDetail(id, user?.id ?? null);
  if (!completion) return { title: "Fahrt – Cornice" };

  const route = await getRoute(completion.routeId);
  return { title: route ? `${route.name} – Fahrt von ${completion.displayName ?? "Fahrer"} – Cornice` : "Fahrt – Cornice" };
}

// Custom Detailseite pro Aufzeichnung (Strava-artig: Strecke + Stats +
// Kudos auf einer eigenen, teilbaren URL) statt nur als Listenzeile im
// Profil sichtbar. Zugriff: öffentliche Fahrten sind für jeden Betrachter
// (auch anonym) offen, private nur für den Besitzer selbst — siehe
// getCompletionDetail (lib/completions.ts) für die zwei Zugriffspfade.
export default async function FahrtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const completion = await getCompletionDetail(id, user?.id ?? null);
  if (!completion) notFound();

  const route = await getRoute(completion.routeId);
  if (!route) notFound();

  const kudosByCompletion = completion.istOeffentlich
    ? await getKudosForCompletions([completion.id], user?.id ?? null)
    : null;
  const kudos = kudosByCompletion?.get(completion.id) ?? null;

  const avgKmh =
    completion.dauerSekunden && completion.dauerSekunden > 0 && completion.distanzKm
      ? completion.distanzKm / (completion.dauerSekunden / 3600)
      : null;

  return (
    <div className="flex h-dvh flex-col">
      <Header back={completion.isOwner ? "/profil" : `/fahrer/${completion.userId}`} />
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-6 sm:py-10">
          <div className="flex items-center gap-3">
            <Avatar url={completion.avatarUrl} name={completion.displayName} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {completion.isOwner ? "Deine Fahrt" : (completion.displayName ?? "Fahrer")}
              </p>
              <p className="text-xs text-muted">
                {new Date(completion.datum).toLocaleDateString("de-CH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            {!completion.isOwner && user && (
              <KudosButton
                completionId={completion.id}
                initialCount={kudos?.count ?? 0}
                initialGiven={kudos?.givenByMe ?? false}
              />
            )}
          </div>

          <div>
            <p className="text-sm text-muted">{route.region}</p>
            <Link href={`/strecken/${route.id}`} className="group inline-flex items-baseline gap-1.5">
              <h1 className="text-display font-semibold tracking-tight group-hover:text-accent">
                {route.name}
              </h1>
            </Link>
            <p className="mt-1 text-sm text-muted">
              {route.ist_rundfahrt ? `Start/Ziel: ${route.start_ort}` : `${route.start_ort} → ${route.ziel_ort}`}
            </p>
          </div>

          <Card className="h-64 overflow-hidden sm:h-80">
            <CompletionMap route={route} />
          </Card>

          {completion.fotoUrl && (
            <CompletionPhoto
              completionId={completion.id}
              fotoUrl={completion.fotoUrl}
              canRemove={completion.isOwner}
            />
          )}

          {/* Bento-Stats — dasselbe Muster wie app/strecken/[id]/page.tsx und
              app/profil/page.tsx: Distanz/Zeit als betonte Kacheln, Rest
              kleinteiliger daneben. */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card surface className="flex flex-col justify-between gap-1 p-4">
              <dt className="flex items-center gap-1.5 text-sm text-muted">
                <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                Distanz
              </dt>
              <dd className="text-title font-mono font-semibold tabular-nums">
                {(completion.distanzKm ?? route.laenge_km).toFixed(1)} km
              </dd>
            </Card>
            <Card surface className="flex flex-col justify-between gap-1 p-4">
              <dt className="flex items-center gap-1.5 text-sm text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Zeit
              </dt>
              <dd className="text-title font-mono font-semibold tabular-nums">
                {completion.dauerSekunden !== null ? formatDuration(completion.dauerSekunden) : "—"}
              </dd>
            </Card>
            <Card surface className="flex flex-col justify-between gap-1 p-4">
              <dt className="flex items-center gap-1.5 text-sm text-muted">
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                Ø Tempo
              </dt>
              <dd className="font-mono tabular-nums">{avgKmh !== null ? `${avgKmh.toFixed(0)} km/h` : "—"}</dd>
            </Card>
            <Card surface className="flex flex-col justify-between gap-1 p-4">
              <dt className="flex items-center gap-1.5 text-sm text-muted">
                <Mountain className="h-3.5 w-3.5" aria-hidden="true" />
                Höhe
              </dt>
              <dd className="font-mono tabular-nums">{route.hoehe_m !== null ? `${route.hoehe_m} m` : "—"}</dd>
            </Card>
          </dl>

          {route.hoehenprofil && route.hoehenprofil.length > 1 && (
            <ElevationProfile punkte={route.hoehenprofil} />
          )}

          {completion.isOwner && (
            <Card surface className="flex flex-col gap-3 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Nur für dich sichtbar
                </span>
                <span className={`text-xs font-medium ${completion.istOeffentlich ? "text-accent" : "text-muted"}`}>
                  {completion.istOeffentlich ? "Öffentlich geteilt" : "Privat"}
                </span>
              </div>
              {completion.vehicle && (
                <p className="flex items-center gap-1.5 text-foreground">
                  <RouteIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  {completion.vehicle.marke} {completion.vehicle.modell}
                </p>
              )}
              {completion.abdeckungProzent !== null && (
                <p className="text-muted">Streckenabdeckung: {completion.abdeckungProzent}%</p>
              )}
              {completion.notiz && <p className="text-foreground">{completion.notiz}</p>}
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
