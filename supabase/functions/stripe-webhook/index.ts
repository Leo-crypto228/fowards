import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("API Stripe Secret")!, {
  apiVersion: "2024-04-10",
});

const webhookSecret = Deno.env.get("whsec Stripe")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PRICE_ID_MONTHLY = Deno.env.get("ID Fowards Premium Mensuel (24.99euro)")!;
const PRICE_ID_ANNUAL = Deno.env.get("ID Fowards premium Annuel (249.99euro)")!;

function getPlanFromPriceId(priceId: string): string {
  if (priceId === PRICE_ID_MONTHLY) return "premium_monthly";
  if (priceId === PRICE_ID_ANNUAL) return "premium_annual";
  return "free";
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;

        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price?.id ?? "";
          const plan = getPlanFromPriceId(priceId);
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: "active",
              subscription_plan: plan,
              subscription_current_period_end: periodEnd,
            })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId = sub.items.data[0]?.price?.id ?? "";
        const plan = getPlanFromPriceId(priceId);
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: sub.status,
            subscription_plan: plan,
            subscription_current_period_end: periodEnd,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "canceled",
            subscription_plan: "free",
            subscription_current_period_end: null,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Error processing webhook event:", err);
    return new Response("Internal server error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
