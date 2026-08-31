import { redirect } from "next/navigation";
import Header from "@/components/Header";
import VisibilitySettings from "@/components/VisibilitySettings";
import { createClient } from "@/lib/supabase/server";

export default async function PrivatsphaerePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("zeigt_fahrzeuge, zeigt_avatar, zeigt_paesse, zeigt_hoehenmeter, zeigt_distanz")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-dvh flex-col">
      <Header back="/profil" />
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-display font-semibold">Privatsphäre</h1>
          <p className="mt-1 text-sm text-muted">
            Legt fest, was andere Nutzer auf deinem öffentlichen Profil sehen. Standardmässig ist
            alles aus. Ob eine einzelne Fahrt öffentlich ist, entscheidest du separat im
            Fazit-Screen beim Speichern oder per Symbol bei &bdquo;Getrackte Fahrten&ldquo; in
            deinem Profil.
          </p>
        </div>

        <VisibilitySettings
          zeigtFahrzeuge={profile?.zeigt_fahrzeuge ?? false}
          zeigtAvatar={profile?.zeigt_avatar ?? false}
          zeigtPaesse={profile?.zeigt_paesse ?? false}
          zeigtHoehenmeter={profile?.zeigt_hoehenmeter ?? false}
          zeigtDistanz={profile?.zeigt_distanz ?? false}
        />
        </main>
      </div>
    </div>
  );
}
