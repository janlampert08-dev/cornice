"use client";

import { useActionState } from "react";
import { updateVisibilitySettings, type ProfileActionState } from "@/lib/actions/profile";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";

const initialState: ProfileActionState = { error: null };

export interface VisibilityFlags {
  zeigtFahrzeuge: boolean;
  zeigtAvatar: boolean;
  zeigtPaesse: boolean;
  zeigtHoehenmeter: boolean;
  zeigtDistanz: boolean;
  zeigtFollowerListe: boolean;
}

const FIELDS: {
  name: keyof VisibilityFlags;
  formKey: string;
  label: string;
  description?: string;
}[] = [
  { name: "zeigtAvatar", formKey: "zeigt_avatar", label: "Profilbild zeigen" },
  { name: "zeigtFahrzeuge", formKey: "zeigt_fahrzeuge", label: "Fahrzeuge zeigen" },
  { name: "zeigtPaesse", formKey: "zeigt_paesse", label: "Anzahl befahrener Pässe zeigen" },
  { name: "zeigtHoehenmeter", formKey: "zeigt_hoehenmeter", label: "Gesammelte Höhenmeter zeigen" },
  { name: "zeigtDistanz", formKey: "zeigt_distanz", label: "GPS-getrackte Gesamtdistanz zeigen" },
  {
    name: "zeigtFollowerListe",
    formKey: "zeigt_follower_liste",
    label: "Follower-/Gefolgt-Liste zeigen",
    description: "Die Anzahl bleibt für andere immer sichtbar, unabhängig von dieser Einstellung.",
  },
];

// Kachel-Liste mit iOS-artigen Switches (components/ui/Switch.tsx) statt
// einer losen Spalte nativer Checkboxen — gleiches Card+divide-y-Muster wie
// andere Listen der App (z. B. Streckenvorschläge im selben Einstellungen-
// Bereich). Jeder Switch bleibt technisch eine unkontrollierte Checkbox
// (name/value/defaultChecked), submitted also weiterhin gesammelt über den
// einen "Speichern"-Button unten statt pro Zeile automatisch zu sichern.
export default function VisibilitySettings(flags: VisibilityFlags) {
  const [state, formAction, pending] = useActionState(updateVisibilitySettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card className="flex flex-col divide-y divide-border px-4">
        {FIELDS.map((field) => (
          <Switch
            key={field.formKey}
            name={field.formKey}
            value="true"
            defaultChecked={flags[field.name]}
            label={field.label}
            description={field.description}
          />
        ))}
      </Card>

      {/* Premium-Symbol-Einstellung vorerst deaktiviert, siehe
          components/PremiumCard.tsx. */}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {!state.error && state.success && !pending && (
        <p role="status" className="text-sm text-success">
          Gespeichert.
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Speichern…" : "Einstellungen speichern"}
      </Button>
    </form>
  );
}
