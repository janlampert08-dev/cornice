"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitRating, type RatingFormState } from "@/lib/actions/ratings";
import type { RatingWithAuthor } from "@/lib/ratings";

const initialState: RatingFormState = { error: null };

export default function RatingSection({
  routeId,
  ratings,
  ownRating,
  canRate,
}: {
  routeId: string;
  ratings: RatingWithAuthor[];
  ownRating: { kommentar: string | null } | null;
  canRate: boolean;
}) {
  const action = submitRating.bind(null, routeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <section className="flex flex-col gap-4 border-t border-[#131316]/10 pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
          Kommentare
        </h2>
        {ratings.length > 0 && (
          <span className="font-mono text-sm tabular-nums text-[#8A8F98]">
            {ratings.length}
          </span>
        )}
      </div>

      {canRate && (
        <form
          action={formAction}
          className="flex flex-col gap-2 border-b border-[#131316]/10 pb-4"
        >
          <textarea
            name="kommentar"
            defaultValue={ownRating?.kommentar ?? ""}
            placeholder="Kommentar"
            rows={2}
            className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start border border-[#131316] px-3 py-1.5 text-sm font-medium hover:bg-[#131316] hover:text-[#FAFAFA] disabled:opacity-50"
          >
            {ownRating ? "Kommentar aktualisieren" : "Kommentieren"}
          </button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {ratings.map((r) => (
          <li key={r.id} className="text-sm">
            <Link
              href={`/fahrer/${r.user_id}`}
              className={`font-medium transition-colors duration-150 hover:text-[#3D5AFE] ${
                r.is_premium_badge ? "text-[#C9A227]" : ""
              }`}
            >
              {r.display_name ?? "Anonym"}
            </Link>
            {r.kommentar && <p className="mt-0.5 text-[#8A8F98]">{r.kommentar}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
