import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function updateSubscription(customerId: string, updates: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("stripe_customer_id", customerId);
  if (error) console.error("[stripe-webhook] updateSubscription error:", error);
  else console.log("[stripe-webhook] updated:", customerId, JSON.stringify(updates));
}

function getPlan(priceId: string): string {
  if (priceId === Deno.env.get("STRIPE_PRICE_STARTER_MONTHLY")) return "starter_monthly";
  if (priceId === Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL"))  return "starter_annual";
  if (priceId === Deno.env.get("STRIPE_PRICE_ANNUAL"))          return "premium_annual";
  return "premium_monthly"; // STRIPE_PRICE_MONTHLY (Premium mensuel) par défaut
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "stripe-signature, content-type",
      },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Invalid signature:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("[stripe-webhook] event:", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await updateSubscription(session.customer as string, {
            subscription_status: "active",
            subscription_plan: getPlan(sub.items.data[0].price.id),
            subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id ?? "";
        await updateSubscription(sub.customer as string, {
          subscription_status: sub.status,
          subscription_plan: sub.status === "active" ? getPlan(priceId) : "free",
          subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await updateSubscription(sub.customer as string, {
          subscription_status: "canceled",
          subscription_plan: "free",
          subscription_current_period_end: null,
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await updateSubscription(invoice.customer as string, {
          subscription_status: "past_due",
        });
        break;
      }
      default:
        console.log("[stripe-webhook] unhandled:", event.type);
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
