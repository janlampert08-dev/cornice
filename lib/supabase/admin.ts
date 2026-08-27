import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-Role-Client — NUR für Server-zu-Server-Kontexte ohne eingeloggte
// Supabase-Session (aktuell: der Stripe-Webhook-Handler, app/api/stripe/webhook/route.ts).
// Umgeht RLS vollständig, deshalb niemals mit nutzergesteuerten Filtern/IDs
// aufrufen, ohne die Berechtigung vorher selbst zu prüfen (hier: Stripe hat
// die Event-Signatur bereits verifiziert). Ersetzt die frühere
// security-definer-RPC set_premium_status (0022), deren Secret im Klartext
// in der Migration lag und deren Ausführung an anon/authenticated vergeben
// war — siehe 0023_remove_set_premium_status_rpc.sql.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
