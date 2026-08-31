import Link from "next/link";
import { Trophy } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { RouteTimeEntry } from "@/lib/leaderboard";
import Card from "@/components/ui/Card";

// Gold/Silber/Bronze — Icon statt reiner Farbe für die Top 3, damit der Rang
// nicht ausschliesslich über Farbe vermittelt wird (Barrierefreiheit).
const MEDAL_COLORS = ["#D4AF37", "#A8A9AD", "#CD7F32"];

export default function RouteLeaderboardPreview({ entries }: { entries: RouteTimeEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Bestzeiten</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          Noch keine geteilten Bestzeiten für diese Strecke.
        </p>
      ) : (
        <Card as="ol" className="divide-y divide-border">
          {entries.map((entry, i) => (
            <li key={entry.completionId} className="flex items-center gap-3 px-4 py-3 text-sm">
              {i < 3 ? (
                <span className="flex w-4 shrink-0 justify-center">
                  <Trophy className="h-4 w-4" style={{ color: MEDAL_COLORS[i] }} aria-hidden="true" />
                  <span className="sr-only">Platz {i + 1}</span>
                </span>
              ) : (
                <span className="w-4 shrink-0 text-center font-mono text-xs text-muted">{i + 1}.</span>
              )}
              <Link
                href={`/fahrer/${entry.userId}`}
                className="min-w-0 flex-1 truncate transition-colors duration-fast hover:text-accent"
              >
                {entry.name}
              </Link>
              <span className="shrink-0 font-mono tabular-nums text-muted">
                {formatDuration(entry.dauerSekunden)}
              </span>
            </li>
          ))}
        </Card>
      )}
    </div>
  );
}
