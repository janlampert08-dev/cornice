import Link from "next/link";
import Header from "@/components/Header";
import TrackLeaderboardChooser from "@/components/TrackLeaderboardChooser";
import { getGlobalLeaderboards, type LeaderboardEntry } from "@/lib/leaderboard";
import { getRoutes } from "@/lib/routes";

function LeaderboardSection({
  title,
  entries,
  unit,
  format = (v) => v.toLocaleString("de-CH"),
}: {
  title: string;
  entries: LeaderboardEntry[];
  unit: string;
  format?: (value: number) => string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Einträge.</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry, i) => (
            <li
              key={entry.userId}
              className="flex items-baseline justify-between border-b border-foreground/10 py-2 text-sm"
            >
              <span>
                <span className="mr-2 font-mono text-muted tabular-nums">{i + 1}.</span>
                <Link
                  href={`/fahrer/${entry.userId}`}
                  className="transition-colors duration-150 hover:text-accent"
                >
                  {entry.name}
                </Link>
              </span>
              <span className="font-mono tabular-nums text-muted">
                {format(entry.value)} {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function LeaderboardsPage() {
  const [{ meisteFahrten, meisteHoehenmeter, meisteKm }, { routes }] = await Promise.all([
    getGlobalLeaderboards(),
    getRoutes(),
  ]);

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 overflow-y-auto px-5 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-xl font-semibold">Bestenlisten</h1>
          <p className="mt-1 text-sm text-muted">
            Nach Distanz, Höhenmetern und Anzahl aufgezeichneter Fahrten. Streckenbestzeiten unten
            zeigen nur Fahrten, die freiwillig dafür geteilt wurden.
          </p>
        </div>

        <LeaderboardSection title="Meiste Fahrten" entries={meisteFahrten} unit="Fahrten" />
        <LeaderboardSection
          title="Meiste Höhenmeter"
          entries={meisteHoehenmeter}
          unit="m"
          format={(v) => Math.round(v).toLocaleString("de-CH")}
        />
        <LeaderboardSection
          title="Meiste km gefahren"
          entries={meisteKm}
          unit="km"
          format={(v) => v.toFixed(0)}
        />

        <TrackLeaderboardChooser
          routes={routes.map((r) => ({ id: r.id, name: r.name }))}
        />
      </main>
    </div>
  );
}
