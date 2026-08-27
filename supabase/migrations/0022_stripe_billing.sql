-- Stripe-Abo-Anbindung: verknüpft einen Supabase-Nutzer mit seinem Stripe
-- Customer (gesetzt beim ersten Checkout, siehe lib/actions/billing.ts) und
-- erlaubt dem Webhook-Handler (app/api/stripe/webhook/route.ts), den
-- Premium-Status zu setzen — OHNE dass die App einen Supabase
-- Service-Role-Key braucht. Der Webhook hat keine eingeloggte Supabase-
-- Session (Server-zu-Server-Aufruf von Stripe), RLS würde ein normales
-- UPDATE also blockieren. set_premium_status läuft stattdessen mit
-- security definer (erhöhte Rechte), ist aber durch ein Secret abgesichert,
-- das nur der Webhook-Handler kennt (INTERNAL_WEBHOOK_SECRET, .env.local) —
-- ohne dieses Secret bewirkt ein Aufruf nichts. Die Funktion kann NUR den
-- Premium-Status per stripe_customer_id umschalten, sonst nichts.
alter table public.profiles
  add column stripe_customer_id text unique;

comment on column public.profiles.stripe_customer_id is
  'Stripe Customer ID, gesetzt beim ersten Checkout (lib/actions/billing.ts). Verknüpft Stripe-Webhook-Events mit dem Supabase-Nutzer.';

create function public.set_premium_status(
  p_stripe_customer_id text,
  p_ist_premium boolean,
  p_webhook_secret text
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_webhook_secret is distinct from '8699e9c87affc19071449573d22c2744fbbfc01d9aac291feb301c36545ec1d6' then
    raise exception 'invalid webhook secret';
  end if;

  update public.profiles
  set ist_premium = p_ist_premium
  where stripe_customer_id = p_stripe_customer_id;
end;
$$;

revoke all on function public.set_premium_status(text, boolean, text) from public;
grant execute on function public.set_premium_status(text, boolean, text) to anon, authenticated;
