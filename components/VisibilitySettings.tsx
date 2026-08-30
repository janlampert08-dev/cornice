"use client";

import { useActionState } from "react";
import { updateVisibilitySettings, type ProfileActionState } from "@/lib/actions/profile";

const initialState: ProfileActionState = { error: null };

export interface VisibilityFlags {
  zeigtFahrzeuge: boolean;
  zeigtAvatar: boolean;
  zeigtPaesse: boolean;
  zeigtHoehenmeter: boolean;
  zeigtDistanz: boolean;
  zeigtPremiumBadge: boolean;
}

const FIELDS: { name: keyof VisibilityFlags; formKey: string; label: string }[] = [
  { name: "zeigtAvatar", formKey: "zeigt_avatar", label: "Profilbild zeigen" },
  { name: "zeigtFahrzeuge", formKey: "zeigt_fahrzeuge", label: "Fahrzeuge zeigen" },
  { name: "zeigtPaesse", formKey: "zeigt_paesse", label: "Anzahl befahrener Pässe zeigen" },
  { name: "zeigtHoehenmeter", formKey: "zeigt_hoehenmeter", label: "Gesammelte Höhenmeter zeigen" },
  { name: "zeigtDistanz", formKey: "zeigt_distanz", label: "GPS-getrackte Gesamtdistanz zeigen" },
];

export default function VisibilitySettings({
  istPremium,
  ...flags
}: VisibilityFlags & { istPremium: boolean }) {
  const [state, formAction, pending] = useActionState(updateVisibilitySettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {FIELDS.map((field) => (
        <label key={field.formKey} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={field.formKey}
            value="true"
            defaultChecked={flags[field.name]}
          />
          {field.label}
        </label>
      ))}

      {istPremium && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="zeigt_premium_badge"
            value="true"
            defaultChecked={flags.zeigtPremiumBadge}
          />
          Premium-Symbol neben dem Namen zeigen
        </label>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-[#131316] bg-[#131316] shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Speichern…" : "Einstellungen speichern"}
      </button>
    </form>
  );
}
