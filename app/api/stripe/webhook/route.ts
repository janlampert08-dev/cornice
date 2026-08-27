import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Kein eingeloggter Supabase-Nutzer hier (Server-zu-Server-Aufruf von
// Stripe) — die Stripe-Signaturprüfung unten (constructEvent) ist die
// eigentliche Authentifizierung dieses Requests. Der Premium-Status wird
// deshalb direkt über den Service-Role-Client gesetzt (RLS-Bypass, aber nur
// serverseitig und nur erreichbar über diesen bereits verifizierten
// Request) statt über die frühere set_premium_status-RPC, deren Secret im
// Klartext in einer Migration lag und per anon/authenticated aufrufbar war.
async function setPremium(customerId: string, istPremium: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ist_premium: istPremium })
    .eq("stripe_customer_id", customerId);
  if (error) console.error("setPremium failed", error);
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && typeof session.customer === "string") {
        await setPremium(session.customer, true);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      if (typeof subscription.customer === "string") {
        const active = subscription.status === "active" || subscription.status === "trialing";
        await setPremium(subscription.customer, active);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (typeof subscription.customer === "string") {
        await setPremium(subscription.customer, false);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
