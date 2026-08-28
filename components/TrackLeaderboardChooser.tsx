"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { RouteTimeEntry } from "@/lib/leaderboard";

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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
          Streckenbestzeiten
        </h2>
        {routes.length > 0 && (
          <select
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setExpanded(false);
            }}
            className="w-full border border-[#131316]/30 bg-transparent px-2 py-1 text-sm outline-none focus:border-[#3D5AFE] sm:w-auto sm:max-w-[60%]"
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
        <p className="text-sm text-[#8A8F98]">Noch keine Strecken vorhanden.</p>
      ) : entries.length === 0 ? (
        <p className={`text-sm text-[#8A8F98] transition-opacity ${loading ? "opacity-40" : ""}`}>
          Noch keine geteilten Zeiten für diese Strecke.
        </p>
      ) : (
        <>
          {/* Bleibt beim Streckenwechsel sichtbar (nur abgedunkelt), statt
              beim Laden kurz auf Platzhalter zu blitzen. */}
          <ol className={`flex flex-col transition-opacity ${loading ? "opacity-40" : ""}`}>
            {visible.map((entry, i) => (
              <li
                key={entry.completionId}
                className="flex items-baseline justify-between border-b border-[#131316]/10 py-2 text-sm"
              >
                <span>
                  <span className="mr-2 font-mono text-[#8A8F98] tabular-nums">{i + 1}.</span>
                  <Link
                    href={`/fahrer/${entry.userId}`}
                    className={`transition-colors duration-150 hover:text-[#3D5AFE] ${
                      entry.isPremiumBadge ? "text-[#C9A227]" : ""
                    }`}
                  >
                    {entry.name}
                  </Link>
                </span>
                <span className="font-mono tabular-nums text-[#3D5AFE]">
                  {formatDuration(entry.dauerSekunden)}
                </span>
              </li>
            ))}
          </ol>
          {entries.length > COLLAPSED_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-start text-xs text-[#3D5AFE] hover:underline"
            >
              {expanded ? "Weniger anzeigen" : "Top 10 anzeigen"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
