import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { getPublicProfile } from "@/lib/profile";

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
  const profile = await getPublicProfile(id);

  if (!profile) notFound();

  const zeigtStatistiken = profile.zeigtPaesse || profile.zeigtHoehenmeter || profile.zeigtDistanz;
  const istPrivat =
    !profile.zeigtFahrzeuge && !zeigtStatistiken && profile.fahrten.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      <Header back="/" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 overflow-y-auto px-5 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-4">
          <Avatar
            url={profile.zeigtAvatar ? profile.avatarUrl : null}
            name={profile.displayName}
            size={64}
          />
          <h1 className="text-xl font-semibold">{profile.displayName ?? "Fahrer"}</h1>
        </div>

        {zeigtStatistiken && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-foreground/10 py-4 text-sm">
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
          </dl>
        )}

        {profile.zeigtFahrzeuge && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Fahrzeuge
            </h2>
            {profile.vehicles.length === 0 ? (
              <p className="text-sm text-muted">Keine Fahrzeuge hinterlegt.</p>
            ) : (
              <ul className="flex flex-col">
                {profile.vehicles.map((v) => (
                  <li
                    key={v.id}
                    className="border-b border-foreground/10 py-2 text-sm text-foreground"
                  >
                    {v.marke} {v.modell}
                    {v.baujahr && <span className="ml-2 text-muted">({v.baujahr})</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Gefahrene Strecken
          </h2>
          {profile.fahrten.length === 0 ? (
            <p className="text-sm text-muted">Noch keine öffentlichen Fahrten.</p>
          ) : (
            <ul className="flex flex-col">
              {profile.fahrten.map((f, i) => (
                <li key={`${f.route_id}-${f.datum}-${i}`}>
                  <Link
                    href={`/strecken/${f.route_id}`}
                    className="flex items-baseline justify-between border-b border-foreground/10 py-2 text-sm transition-colors duration-150 hover:text-accent"
                  >
                    <span>{f.route_name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {new Date(f.datum).toLocaleDateString("de-CH")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {istPrivat && <p className="text-sm text-muted">Dieses Profil ist privat.</p>}
      </main>
    </div>
  );
}
