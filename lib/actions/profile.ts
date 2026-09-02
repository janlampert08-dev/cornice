"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProfileActionState {
  error: string | null;
  success?: boolean;
}

export interface ProfileSearchResult {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// Namenssuche für die Profilsuche im Feed (components/ProfileSearch.tsx).
// display_name/avatar_url sind bereits öffentlich lesbar (RLS "Profile sind
// öffentlich lesbar" seit 0001_init.sql, Spalten-Grants in
// 0034_profiles_column_grant_hardening.sql) — dieselben Daten, die z. B. in
// Follower-Listen und Bestenlisten ohnehin für jeden sichtbar sind, hier nur
// zusätzlich per Namenssuche auffindbar statt nur beim Durchblättern.
export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  // ilike-Sonderzeichen im Nutzer-Input escapen, sonst könnten "%"/"_" selbst
  // als Wildcard statt als gesuchtes Literalzeichen wirken.
  const escaped = trimmed.replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, zeigt_avatar")
    .not("display_name", "is", null)
    .ilike("display_name", `%${escaped}%`)
    .order("display_name")
    .limit(8);

  return (data ?? []).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    avatarUrl: p.zeigt_avatar ? p.avatar_url : null,
  }));
}

export async function updateVisibilitySettings(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const { error } = await supabase
    .from("profiles")
    .update({
      zeigt_fahrzeuge: formData.get("zeigt_fahrzeuge") === "true",
      zeigt_avatar: formData.get("zeigt_avatar") === "true",
      zeigt_paesse: formData.get("zeigt_paesse") === "true",
      zeigt_hoehenmeter: formData.get("zeigt_hoehenmeter") === "true",
      zeigt_distanz: formData.get("zeigt_distanz") === "true",
      zeigt_follower_liste: formData.get("zeigt_follower_liste") === "true",
      // Premium-Feature (Gold-Badge) vorerst deaktiviert — bleibt aus.
      zeigt_premium_badge: false,
    })
    .eq("id", user.id);

  if (error) return { error: "Einstellungen konnten nicht gespeichert werden." };

  revalidatePath("/profil");
  revalidatePath("/profil/einstellungen");
  revalidatePath(`/fahrer/${user.id}`);
  revalidatePath("/leaderboards");
  return { error: null, success: true };
}

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export async function uploadAvatar(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const foto = formData.get("avatar") as File | null;
  if (!foto || foto.size === 0) return { error: "Bitte ein Foto auswählen." };
  if (!foto.type.startsWith("image/")) return { error: "Nur Bilddateien sind erlaubt." };
  if (foto.size > MAX_AVATAR_BYTES) return { error: "Foto ist zu gross (max. 4 MB)." };

  const ext = foto.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, foto, { upsert: true });
  if (uploadError) return { error: "Foto konnte nicht hochgeladen werden." };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-Buster, damit ein ersetztes Avatar sofort neu geladen wird (die
  // öffentliche URL bliebe sonst dieselbe und der Browser zeigt die alte
  // Cache-Version).
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) return { error: "Profil konnte nicht aktualisiert werden." };

  revalidatePath("/profil");
  revalidatePath(`/fahrer/${user.id}`);
  return { error: null };
}
