import Stripe from "stripe";

// Kein explizites apiVersion-Pinning — nutzt die im Stripe-Dashboard
// hinterlegte Standardversion des Kontos.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
