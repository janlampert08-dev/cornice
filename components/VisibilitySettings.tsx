"use client";

import { useActionState } from "react";
import { updateVisibilitySettings, type ProfileActionState } from "@/lib/actions/profile";
import Button from "@/components/ui/Button";

const initialState: ProfileActionState = { error: null };

export interface VisibilityFlags {
  zeigtFahrzeuge: boolean;
  zeigtAvatar: boolean;
  zeigtPaesse: boolean;
  zeigtHoehenmeter: boolean;
  zeigtDistanz: boolean;
}

const FIELDS: { name: keyof VisibilityFlags; formKey: string; label: string }[] = [
  { name: "zeigtAvatar", formKey: "zeigt_avatar", label: "Profilbild zeigen" },
  { name: "zeigtFahrzeuge", formKey: "zeigt_fahrzeuge", label: "Fahrzeuge zeigen" },
  { name: "zeigtPaesse", formKey: "zeigt_paesse", label: "Anzahl befahrener Pässe zeigen" },
  { name: "zeigtHoehenmeter", formKey: "zeigt_hoehenmeter", label: "Gesammelte Höhenmeter zeigen" },
  { name: "zeigtDistanz", formKey: "zeigt_distanz", label: "GPS-getrackte Gesamtdistanz zeigen" },
];

export default function VisibilitySettings(flags: VisibilityFlags) {
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
            className="h-4 w-4 accent-accent"
          />
          {field.label}
        </label>
      ))}

      {/* Premium-Symbol-Einstellung vorerst deaktiviert, siehe
          components/PremiumCard.tsx. */}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Speichern…" : "Einstellungen speichern"}
      </Button>
    </form>
  );
}
