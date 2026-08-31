import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import KudosButton from "@/components/KudosButton";
import FollowButton from "@/components/FollowButton";
import { getPublicProfile } from "@/lib/profile";
import { getKudosForCompletions } from "@/lib/kudos";
import { isFollowing } from "@/lib/follows";
import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) return { title: "Fahrer – Cornice" };
  return { title: `${profile.displayName ?? "Fahrer"} – Cornice` };
}

export default async function FahrerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // getPublicProfile() und auth.getUser() sind voneinander unabhängig
  // (das Profil selbst braucht den Betrachter nicht) — parallel gestartet.
  const [profile, {
    data: { user: viewer },
  }] = await Promise.all([getPublicProfile(id), supabase.auth.getUser()]);

  if (!profile) notFound();

  const kudosByCompletion = await getKudosForCompletions(
    profile.fahrten.map((f) => f.completion_id),
    viewer?.id ?? null,
  );

  // Kein Folgen-Button auf dem eigenen Profil, und nur für eingeloggte
  // Betrachter — dieselbe Bedingung wie beim Kudos-Button oben.
  const showFollow = !!viewer && viewer.id !== id;
  const alreadyFollowing =
    viewer && viewer.id !== id ? await isFollowing(viewer.id, id) : false;

  const zeigtStatistiken = profile.zeigtPaesse || profile.zeigtHoehenmeter || profile.zeigtDistanz;
  const istPrivat =
    !profile.zeigtFahrzeuge && !zeigtStatistiken && profile.fahrten.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      <Header back="/" />
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-8 sm:px-6 sm:py-10 lg:max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              url={profile.zeigtAvatar ? profile.avatarUrl : null}
              name={profile.displayName}
              size={64}
            />
            <h1 className="text-display font-semibold">{profile.displayName ?? "Fahrer"}</h1>
          </div>
          {showFollow && <FollowButton targetUserId={id} initialFollowing={alreadyFollowing} />}
        </div>

        {zeigtStatistiken && (
          <Card as="dl" className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 text-sm sm:grid-cols-3">
            {profile.zeigtPaesse && (
              <div>
                <dt className="text-muted">Pässe befahren</dt>
                <dd className="font-mono text-lg tabular-nums">{profile.passCount}</dd>
              </div>
            )}
            {profile.zeigtHoehenmeter && (
              <div>
                <dt className="text-muted">Höhenmeter gesammelt</dt>
                <dd className="font-mono text-lg tabular-nums">
                  {profile.hoehenmeter.toLocaleString("de-CH")} m
                </dd>
              </div>
            )}
            {profile.zeigtDistanz && (
              <div>
                <dt className="text-muted">GPS-getrackte Distanz</dt>
                <dd className="font-mono text-lg tabular-nums">
                  {profile.distanzKm.toFixed(0)} km
                </dd>
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          {profile.zeigtFahrzeuge && (
            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
                Fahrzeuge
              </h2>
              {profile.vehicles.length === 0 ? (
                <p className="text-sm text-muted">Keine Fahrzeuge hinterlegt.</p>
              ) : (
                <Card as="ul" className="divide-y divide-border">
                  {profile.vehicles.map((v) => (
                    <li key={v.id} className="px-4 py-3 text-sm text-foreground">
                      {v.marke} {v.modell}
                      {v.baujahr && <span className="ml-2 text-muted">({v.baujahr})</span>}
                    </li>
                  ))}
                </Card>
              )}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
              Gefahrene Strecken
            </h2>
            {profile.fahrten.length === 0 ? (
              <p className="text-sm text-muted">Noch keine öffentlichen Fahrten.</p>
            ) : (
              <Card as="ul" className="divide-y divide-border">
                {profile.fahrten.map((f) => {
                  const kudos = kudosByCompletion.get(f.completion_id);
                  return (
                    <li key={f.completion_id} className="flex items-center gap-2 px-4 py-3">
                      <Link
                        href={`/fahrten/${f.completion_id}`}
                        className="flex min-w-0 flex-1 items-baseline justify-between text-sm transition-colors duration-fast hover:text-accent"
                      >
                        <span className="truncate">{f.route_name}</span>
                        <span className="ml-2 shrink-0 font-mono text-xs tabular-nums text-muted">
                          {new Date(f.datum).toLocaleDateString("de-CH")}
                        </span>
                      </Link>
                      {viewer && (
                        <KudosButton
                          completionId={f.completion_id}
                          initialCount={kudos?.count ?? 0}
                          initialGiven={kudos?.givenByMe ?? false}
                        />
                      )}
                    </li>
                  );
                })}
              </Card>
            )}
          </section>
        </div>

        {istPrivat && <p className="text-sm text-muted">Dieses Profil ist privat.</p>}
        </main>
      </div>
    </div>
  );
}
