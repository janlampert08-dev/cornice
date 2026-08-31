import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    // Noch kein Supabase-Projekt verknüpft (.env.local fehlt) — Session-Refresh überspringen,
    // damit die App auch ohne Backend-Anbindung lauffähig bleibt.
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Nur die Response-Cookies setzen. Das Request-Objekt darf nicht gemutet werden.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    // Wichtig: getUser() aktualisiert den Session-Token bei Bedarf.
    await supabase.auth.getUser();
  } catch (err) {
    // Auf Stabilität achten: Fehler beim Kontakt zu Supabase dürfen die Request-Pipeline
    // nicht komplett brechen. Loggen und weitermachen.
    // eslint-disable-next-line no-console
    console.error("supabase auth.getUser failed:", err);
  }

  return supabaseResponse;
}
