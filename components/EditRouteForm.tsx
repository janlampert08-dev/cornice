"use client";

import { useActionState, useState } from "react";
import { KATEGORIEN } from "@/lib/constants";
import type { UpdateRouteState } from "@/lib/actions/routes";
import type { RouteGeoJSON } from "@/types/database";

const initialState: UpdateRouteState = { error: null };

type UpdateAction = (
  routeId: string,
  prevState: UpdateRouteState,
  formData: FormData,
) => Promise<UpdateRouteState>;

export default function EditRouteForm({
  route,
  action,
  adminMode = false,
}: {
  route: RouteGeoJSON;
  action: UpdateAction;
  adminMode?: boolean;
}) {
  const boundAction = action.bind(null, route.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [startOrt, setStartOrt] = useState(route.start_ort);

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold">
          {adminMode ? "Strecke bearbeiten (Moderation)" : "Vorschlag bearbeiten"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {adminMode
            ? "Der Streckenverlauf selbst kann hier nicht geändert werden. Änderungen sind sofort für alle sichtbar."
            : "Der Streckenverlauf selbst kann hier nicht geändert werden — bei Problemen mit der Route lieber neu vorschlagen. Nach dem Speichern geht der Vorschlag erneut zur Prüfung."}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          defaultValue={route.name}
          className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Region
        <input
          name="region"
          required
          defaultValue={route.region}
          className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Start-Ort
          <input
            name="start_ort"
            required
            value={startOrt}
            onChange={(e) => setStartOrt(e.target.value)}
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>
        {route.ist_rundfahrt ? (
          <input type="hidden" name="ziel_ort" value={startOrt} />
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            Ziel-Ort
            <input
              name="ziel_ort"
              required
              defaultValue={route.ziel_ort}
              className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
            />
          </label>
        )}
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-muted">Kategorien</legend>
        {KATEGORIEN.map((k) => (
          <label key={k.value} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="kategorien"
              value={k.value}
              defaultChecked={route.kategorien.includes(k.value)}
            />
            {k.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Charakter (optional)
        <textarea
          name="charakter_text"
          rows={3}
          defaultValue={route.charakter_text ?? ""}
          className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Speichern…" : "Speichern"}
      </button>
    </form>
  );
}
