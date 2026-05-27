// ai-fowards — Edge Function Fowards IA (Gemini 2.5 Flash)
// Toutes les routes commencent par /ai-fowards/
// La clé Gemini n'est JAMAIS exposée côté client — elle est lue via Deno.env

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { FOWARDS_SYSTEM_PROMPT } from "./prompts.ts";
import type {
  ChatMode,
  DbConversation,
  DbMessage,
  DbUserQuota,
  GeminiContent,
  GeminiRequest,
  GeminiResponse,
  QuotaStatus,
} from "./types.ts";

const app = new Hono();

// ── Supabase admin client ─────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);
app.use("/*", logger());

// ── Constants ─────────────────────────────────────────────────────────────────
const NORMAL_DAILY_LIMIT     = 30;
const DIAGNOSTIC_BASE_LIMIT  = 1;
const DIAGNOSTIC_MAX_LIMIT   = 2;
const GEMINI_MODEL           = "gemini-2.5-flash";
const GEMINI_URL             = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Auth helper — vérifie le JWT et retourne l'userId ────────────────────────
async function getUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// ── Quota helpers ─────────────────────────────────────────────────────────────

async function getOrCreateQuota(userId: string): Promise<DbUserQuota> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: existing } = await supabaseAdmin
    .from("user_quotas")
    .select("*")
    .eq("user_id", userId)
    .eq("quota_date", today)
    .maybeSingle();

  if (existing) return existing as DbUserQuota;

  // Créer la ligne du jour
  const { data: created, error } = await supabaseAdmin
    .from("user_quotas")
    .insert({
      user_id: userId,
      quota_date: today,
      normal_messages_used: 0,
      diagnostics_used: 0,
      diagnostics_unlocked_via_post: 0,
    })
    .select()
    .single();

  if (error) {
    // Peut arriver en race condition (2 requêtes simultanées)
    const { data: retry } = await supabaseAdmin
      .from("user_quotas")
      .select("*")
      .eq("user_id", userId)
      .eq("quota_date", today)
      .single();
    return retry as DbUserQuota;
  }

  return created as DbUserQuota;
}

function buildQuotaStatus(quota: DbUserQuota): QuotaStatus {
  const diagnosticsLimit = Math.min(
    DIAGNOSTIC_BASE_LIMIT + quota.diagnostics_unlocked_via_post,
    DIAGNOSTIC_MAX_LIMIT,
  );
  return {
    normalUsed: quota.normal_messages_used,
    normalLimit: NORMAL_DAILY_LIMIT,
    normalRemaining: Math.max(0, NORMAL_DAILY_LIMIT - quota.normal_messages_used),
    diagnosticsUsed: quota.diagnostics_used,
    diagnosticsLimit,
    diagnosticsRemaining: Math.max(0, diagnosticsLimit - quota.diagnostics_used),
    diagnosticsUnlockedViaPost: quota.diagnostics_unlocked_via_post > 0,
    canSendNormal: quota.normal_messages_used < NORMAL_DAILY_LIMIT,
    canSendDiagnostic: quota.diagnostics_used < diagnosticsLimit,
  };
}

// ── Gemini call ───────────────────────────────────────────────────────────────

async function callGemini(history: GeminiContent[], userMessageWithMode: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY manquante côté serveur");

  // Construire le tableau contents : historique + message courant
  const contents: GeminiContent[] = [
    ...history,
    { role: "user", parts: [{ text: userMessageWithMode }] },
  ];

  const body: GeminiRequest = {
    system_instruction: {
      parts: [{ text: FOWARDS_SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Gemini] Error response:", res.status, errText);
    throw new Error(`Gemini API erreur ${res.status}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: réponse vide");

  console.log(
    `[Gemini] tokens: prompt=${data.usageMetadata?.promptTokenCount ?? "?"}, output=${data.usageMetadata?.candidatesTokenCount ?? "?"}`,
  );

  return text;
}

// ── Parse <fowards-data> depuis la réponse Gemini ────────────────────────────

const FOWARDS_DATA_RE = /<fowards-data>([\s\S]*?)<\/fowards-data>/;

function extractForwardsData(rawResponse: string): {
  cleanContent: string;
  forwardsData: Record<string, unknown> | null;
} {
  const match = FOWARDS_DATA_RE.exec(rawResponse);
  if (!match) {
    return { cleanContent: rawResponse.trim(), forwardsData: null };
  }

  try {
    const forwardsData = JSON.parse(match[1].trim());
    const cleanContent = rawResponse.replace(FOWARDS_DATA_RE, "").trim();
    return { cleanContent, forwardsData };
  } catch (e) {
    console.error("[fowards-data] JSON parse error:", e);
    const cleanContent = rawResponse.replace(FOWARDS_DATA_RE, "").trim();
    return { cleanContent, forwardsData: null };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /ai-fowards/ping
app.get("/ai-fowards/ping", (c) => c.json({ ok: true }));

// ── GET /quota-status — retourne le statut de quota du jour ──────────────────
app.get("/ai-fowards/quota-status", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  try {
    const quota = await getOrCreateQuota(userId);
    return c.json(buildQuotaStatus(quota));
  } catch (err) {
    console.error("[quota-status] error:", err);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// ── GET /conversations — liste des conversations de l'user ───────────────────
app.get("/ai-fowards/conversations", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  try {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select("id, title, last_message_at, created_at")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return c.json({ conversations: data ?? [] });
  } catch (err) {
    console.error("[conversations] error:", err);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// ── GET /conversations/:id — messages d'une conversation ─────────────────────
app.get("/ai-fowards/conversations/:id", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  const conversationId = c.req.param("id");

  try {
    // Vérifier que la conversation appartient à l'user
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (convErr) throw convErr;
    if (!conv) return c.json({ error: "Conversation introuvable" }, 404);

    const { data: messages, error: msgErr } = await supabaseAdmin
      .from("messages")
      .select("id, role, content, mode, fowards_data, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr) throw msgErr;

    return c.json({ conversation: conv, messages: messages ?? [] });
  } catch (err) {
    console.error("[conversations/:id] error:", err);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// ── DELETE /conversations/:id ─────────────────────────────────────────────────
app.delete("/ai-fowards/conversations/:id", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  const conversationId = c.req.param("id");

  try {
    const { error } = await supabaseAdmin
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (error) throw error;
    return c.json({ success: true });
  } catch (err) {
    console.error("[delete conversation] error:", err);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// ── POST /chat — envoyer un message et obtenir une réponse IA ────────────────
app.post("/ai-fowards/chat", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  let body: {
    conversationId?: string;
    message: string;
    mode: ChatMode;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Corps de requête invalide" }, 400);
  }

  const { conversationId, message, mode } = body;

  if (!message?.trim()) return c.json({ error: "Message vide" }, 400);
  if (mode !== "normal" && mode !== "diagnostic") {
    return c.json({ error: "Mode invalide (normal | diagnostic)" }, 400);
  }

  // ── Vérification quota ──────────────────────────────────────────────────────
  const quota = await getOrCreateQuota(userId);
  const quotaStatus = buildQuotaStatus(quota);

  if (mode === "normal" && !quotaStatus.canSendNormal) {
    return c.json({
      error: `Quota atteint : ${NORMAL_DAILY_LIMIT} messages normaux/jour. Reviens demain !`,
      quotaExceeded: true,
      quota: quotaStatus,
    }, 429);
  }

  if (mode === "diagnostic" && !quotaStatus.canSendDiagnostic) {
    const hint = quotaStatus.diagnosticsUnlockedViaPost
      ? "Tu as déjà utilisé tes 2 diagnostics aujourd'hui. Reviens demain !"
      : "Publie un post de progression (≥50 caractères) pour débloquer un 2ème diagnostic.";
    return c.json({
      error: `Quota diagnostic atteint. ${hint}`,
      quotaExceeded: true,
      quota: quotaStatus,
    }, 429);
  }

  try {
    // ── Créer ou récupérer la conversation ─────────────────────────────────────
    let convId = conversationId;

    if (!convId) {
      // Nouvelle conversation : créer
      const title = message.trim().slice(0, 60) + (message.trim().length > 60 ? "…" : "");
      const { data: newConv, error: createErr } = await supabaseAdmin
        .from("conversations")
        .insert({ user_id: userId, title, last_message_at: new Date().toISOString() })
        .select("id")
        .single();

      if (createErr) throw createErr;
      convId = newConv.id;
    } else {
      // Vérifier que la conversation appartient à l'user
      const { data: existingConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("id", convId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingConv) return c.json({ error: "Conversation introuvable" }, 404);
    }

    // ── Récupérer l'historique pour Gemini (max 40 messages) ───────────────────
    const { data: historyRows } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40);

    const geminiHistory: GeminiContent[] = (historyRows ?? []).map((row: Pick<DbMessage, "role" | "content">) => ({
      role: row.role === "user" ? "user" : "model",
      parts: [{ text: row.content }],
    }));

    // ── Injection du préfixe de mode côté serveur ─────────────────────────────
    const modePrefix = mode === "diagnostic" ? "[MODE: DIAGNOSTIC]" : "[MODE: NORMAL]";
    const messageWithMode = `${modePrefix} ${message.trim()}`;

    // ── Appel Gemini ──────────────────────────────────────────────────────────
    const rawAiResponse = await callGemini(geminiHistory, messageWithMode);

    // ── Parser les données <fowards-data> (jamais envoyées brutes au client) ───
    const { cleanContent, forwardsData } = extractForwardsData(rawAiResponse);

    // ── Sauvegarder les messages en BDD (transaction simulée en 2 inserts) ─────
    const now = new Date().toISOString();

    await supabaseAdmin.from("messages").insert([
      {
        conversation_id: convId,
        user_id: userId,
        role: "user",
        content: message.trim(),
        mode,
        fowards_data: null,
        created_at: now,
      },
      {
        conversation_id: convId,
        user_id: userId,
        role: "assistant",
        content: cleanContent,
        mode,
        fowards_data: forwardsData,
        created_at: new Date(Date.now() + 1).toISOString(), // +1ms pour conserver l'ordre
      },
    ]);

    // ── Mettre à jour last_message_at ──────────────────────────────────────────
    await supabaseAdmin
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", convId);

    // ── Incrémenter quota ──────────────────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    if (mode === "normal") {
      await supabaseAdmin
        .from("user_quotas")
        .update({ normal_messages_used: quota.normal_messages_used + 1 })
        .eq("user_id", userId)
        .eq("quota_date", today);
    } else {
      await supabaseAdmin
        .from("user_quotas")
        .update({ diagnostics_used: quota.diagnostics_used + 1 })
        .eq("user_id", userId)
        .eq("quota_date", today);
    }

    // ── Quota mis à jour ──────────────────────────────────────────────────────
    const updatedQuota = await getOrCreateQuota(userId);

    return c.json({
      conversationId: convId,
      message: cleanContent,
      forwardsData: forwardsData ?? null,
      mode,
      quota: buildQuotaStatus(updatedQuota),
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return c.json({
      error: err instanceof Error ? err.message : "Erreur serveur lors de l'appel IA",
    }, 500);
  }
});

// ── Serve ─────────────────────────────────────────────────────────────────────
Deno.serve(app.fetch);
