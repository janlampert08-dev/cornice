"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { RouteTimeEntry } from "@/lib/leaderboard";
import { fieldClassName } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

const COLLAPSED_SIZE = 5;
const EXPANDED_SIZE = 10;

export default function TrackLeaderboardChooser({
  routes,
}: {
  routes: { id: string; name: string }[];
}) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [entries, setEntries] = useState<RouteTimeEntry[]>([]);
  // Wird nur innerhalb des Fetch-Callbacks gesetzt (nie synchron im
  // Effekt-Body) — "loading" ergibt sich daraus als abgeleiteter Wert,
  // statt ein eigener State zu sein, den der Effekt direkt setzen müsste.
  const [fetchedRouteId, setFetchedRouteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const loading = routeId !== "" && fetchedRouteId !== routeId;

  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;
    fetch(`/api/strecken/${routeId}/leaderboard`)
      .then((r) => r.json())
      .then((data: { entries?: RouteTimeEntry[] }) => {
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setFetchedRouteId(routeId);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setFetchedRouteId(routeId);
      });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const visible = entries.slice(0, expanded ? EXPANDED_SIZE : COLLAPSED_SIZE);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Streckenbestzeiten
        </h2>
        {routes.length > 0 && (
          <select
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setExpanded(false);
            }}
            className={fieldClassName("w-full sm:w-auto sm:max-w-[60%]")}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {routes.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Strecken vorhanden.</p>
      ) : entries.length === 0 ? (
        <p className={`text-sm text-muted transition-opacity ${loading ? "opacity-40" : ""}`}>
          Noch keine geteilten Zeiten für diese Strecke.
        </p>
      ) : (
        <>
          {/* Bleibt beim Streckenwechsel sichtbar (nur abgedunkelt), statt
              beim Laden kurz auf Platzhalter zu blitzen. */}
          <Card as="ol" className={cn("divide-y divide-border transition-opacity", loading && "opacity-40")}>
            {visible.map((entry, i) => (
              <li
                key={entry.completionId}
                className="flex items-baseline justify-between px-4 py-3 text-sm"
              >
                <span>
                  <span className="mr-2 font-mono text-muted tabular-nums">{i + 1}.</span>
                  <Link
                    href={`/fahrer/${entry.userId}`}
                    className="transition-colors duration-fast hover:text-accent"
                  >
                    {entry.name}
                  </Link>
                </span>
                <span className="font-mono tabular-nums text-accent">
                  {formatDuration(entry.dauerSekunden)}
                </span>
              </li>
            ))}
          </Card>
          {entries.length > COLLAPSED_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-start text-xs text-accent hover:underline"
            >
              {expanded ? "Weniger anzeigen" : "Top 10 anzeigen"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
