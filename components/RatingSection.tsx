"use client";

import { Fragment, useActionState } from "react";
import Link from "next/link";
import { submitRating, type RatingFormState } from "@/lib/actions/ratings";
import type { RatingWithAuthor } from "@/lib/ratings";
import TrophyBadge from "@/components/TrophyBadge";

const initialState: RatingFormState = { error: null };

export default function RatingSection({
  routeId,
  ratings,
  ownRating,
  canRate,
}: {
  routeId: string;
  ratings: RatingWithAuthor[];
  ownRating: { sterne: number; kommentar: string | null } | null;
  canRate: boolean;
}) {
  const action = submitRating.bind(null, routeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const average = ratings.length
    ? (ratings.reduce((sum, r) => sum + r.sterne, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <section className="flex flex-col gap-4 border-t border-[#131316]/10 pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
          Bewertungen
        </h2>
        {average && (
          <span className="font-mono text-sm tabular-nums">
            {average} ★ ({ratings.length})
          </span>
        )}
      </div>

      {canRate && (
        <form
          action={formAction}
          className="flex flex-col gap-2 border-b border-[#131316]/10 pb-4"
        >
          <div className="flex flex-row-reverse justify-end gap-1 text-xl">
            {[5, 4, 3, 2, 1].map((n) => (
              <Fragment key={n}>
                <input
                  type="radio"
                  id={`stern-${n}`}
                  name="sterne"
                  value={n}
                  defaultChecked={ownRating?.sterne === n}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`stern-${n}`}
                  className="cursor-pointer text-[#8A8F98] peer-checked:text-[#3D5AFE] hover:text-[#3D5AFE]"
                >
                  ★
                </label>
              </Fragment>
            ))}
          </div>
          <textarea
            name="kommentar"
            defaultValue={ownRating?.kommentar ?? ""}
            placeholder="Kommentar (optional)"
            rows={2}
            className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start border border-[#131316] px-3 py-1.5 text-sm font-medium hover:bg-[#131316] hover:text-[#FAFAFA] disabled:opacity-50"
          >
            {ownRating ? "Bewertung aktualisieren" : "Bewerten"}
          </button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {ratings.map((r) => (
          <li key={r.id} className="text-sm">
            <div className="flex items-baseline justify-between">
              <Link
                href={`/fahrer/${r.user_id}`}
                className="inline-flex items-center gap-1 font-medium transition-colors duration-150 hover:text-[#3D5AFE]"
              >
                {r.display_name ?? "Anonym"}
                {r.is_premium_badge && <TrophyBadge />}
              </Link>
              <span className="font-mono tabular-nums text-[#8A8F98]">{r.sterne} ★</span>
            </div>
            {r.kommentar && <p className="mt-0.5 text-[#8A8F98]">{r.kommentar}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
