import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { plan, success_url, cancel_url } = body;
    console.log("[checkout] plan:", plan, "user:", user.id, "email:", user.email);

    if (!plan || !["monthly", "annual"].includes(plan)) {
      return new Response(JSON.stringify({ error: "Invalid plan. Use 'monthly' or 'annual'." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Vérifier que les secrets sont bien chargés
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceMonthly = Deno.env.get("STRIPE_PRICE_MONTHLY");
    const priceAnnual = Deno.env.get("STRIPE_PRICE_ANNUAL");
    console.log("[checkout] secrets check — key:", stripeKey ? "ok" : "MISSING", "monthly:", priceMonthly ?? "MISSING", "annual:", priceAnnual ?? "MISSING");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY manquant dans les secrets Supabase");
    if (!priceMonthly) throw new Error("STRIPE_PRICE_MONTHLY manquant dans les secrets Supabase");
    if (!priceAnnual) throw new Error("STRIPE_PRICE_ANNUAL manquant dans les secrets Supabase");

    // Récupérer ou créer le customer Stripe
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) console.warn("[checkout] profile query error:", profileErr.message);
    console.log("[checkout] profile found:", !!profile, "customerId:", profile?.stripe_customer_id ?? "none");

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      console.log("[checkout] creating Stripe customer for", user.email);
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      console.log("[checkout] customer created:", customerId);

      // Upsert pour gérer le cas où la row n'existe pas encore
      const { error: upsertErr } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: user.id, stripe_customer_id: customerId }, { onConflict: "id" });
      if (upsertErr) console.warn("[checkout] upsert error:", upsertErr.message);
    }

    const priceId = plan === "monthly" ? priceMonthly : priceAnnual;
    console.log("[checkout] using priceId:", priceId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${success_url || "https://fowards.net/premium/success"}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || "https://fowards.net/premium",
      locale: "fr",
      metadata: { supabase_user_id: user.id },
      allow_promotion_codes: true,
    });

    console.log("[checkout] session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[checkout] FATAL ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
