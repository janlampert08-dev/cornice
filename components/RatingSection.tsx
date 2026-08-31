"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitRating, type RatingFormState } from "@/lib/actions/ratings";
import type { RatingWithAuthor } from "@/lib/ratings";
import { Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

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
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Kommentare
        </h2>
        {ratings.length > 0 && (
          <span className="font-mono text-sm tabular-nums text-muted">
            {ratings.length}
          </span>
        )}
      </div>

      {canRate && (
        <form action={formAction} className="flex flex-col gap-2 border-b border-border pb-4">
          <Textarea
            name="kommentar"
            defaultValue={ownRating?.kommentar ?? ""}
            placeholder="Kommentar"
            rows={2}
          />
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
            {ownRating ? "Kommentar aktualisieren" : "Kommentieren"}
          </Button>
        </form>
      )}

      {ratings.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Kommentare.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ratings.map((r) => (
            <li key={r.id} className="text-sm">
              <Link
                href={`/fahrer/${r.user_id}`}
                className="font-medium transition-colors duration-fast hover:text-accent"
              >
                {r.display_name ?? "Anonym"}
              </Link>
              {r.kommentar && <p className="mt-0.5 text-muted">{r.kommentar}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
