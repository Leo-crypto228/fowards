// ai-fowards — Edge Function Fowards IA V7 (Gemini 2.5 Flash)
// Toutes les routes commencent par /ai-fowards/
// La clé Gemini n'est JAMAIS exposée côté client — elle est lue via Deno.env

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { FOWARDS_SYSTEM_PROMPT } from "./prompts.ts";
import type {
  ChatMode,
  ChoicesBlock,
  DbConversation,
  DbMessage,
  DbUserProfilePage,
  DbUserQuota,
  GeminiContent,
  GeminiRequest,
  GeminiResponse,
  ProfilePage,
  ProfileUpdateBlock,
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
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);
app.use("/*", logger());

// ── Constants ─────────────────────────────────────────────────────────────────
const NORMAL_DAILY_LIMIT    = 30;
const DIAGNOSTIC_BASE_LIMIT = 1;
const DIAGNOSTIC_MAX_LIMIT  = 2;
const GEMINI_MODEL          = "gemini-2.5-flash";
const GEMINI_URL            = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── V7 startup log ────────────────────────────────────────────────────────────
console.log(`[V7] Prompt loaded: ${FOWARDS_SYSTEM_PROMPT.length} chars`);

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
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabaseAdmin
    .from("user_quotas")
    .select("*")
    .eq("user_id", userId)
    .eq("quota_date", today)
    .maybeSingle();

  if (existing) return existing as DbUserQuota;

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
    // Race condition : la ligne a été créée entre les deux requêtes
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

function buildQuotaStatus(quota: DbUserQuota, isPhase1Complete: boolean): QuotaStatus {
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
    canSendDiagnostic: isPhase1Complete && quota.diagnostics_used < diagnosticsLimit,
    isPhase1Complete,
  };
}

// ── Profile helpers ───────────────────────────────────────────────────────────

async function getOrCreateProfile(userId: string): Promise<DbUserProfilePage> {
  const { data: existing } = await supabaseAdmin
    .from("user_profile_page")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as DbUserProfilePage;

  const { data: created, error } = await supabaseAdmin
    .from("user_profile_page")
    .insert({
      user_id: userId,
      content_markdown: "",
      is_phase1_complete: false,
    })
    .select()
    .single();

  if (error) {
    // Race condition
    const { data: retry } = await supabaseAdmin
      .from("user_profile_page")
      .select("*")
      .eq("user_id", userId)
      .single();
    return retry as DbUserProfilePage;
  }

  return created as DbUserProfilePage;
}

function profileToPublic(profile: DbUserProfilePage): ProfilePage {
  return {
    contentMarkdown: profile.content_markdown,
    isPhase1Complete: profile.is_phase1_complete,
    phase1CompletedAt: profile.phase1_completed_at,
    lastUpdatedAt: profile.last_updated_at,
    aiUpdateCount: profile.ai_update_count,
    userUpdateCount: profile.user_update_count,
  };
}

// ── Helpers markdown profil (V8) ─────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SECTION_HEADERS: Record<string, string> = {
  identite:          "# 👤 Identité",
  business:          "# 💼 Business actuel",
  temps_dispo:       "# ⏰ Temps dispo",
  reve:              "# 🎯 Rêve",
  blocage_principal: "# 🧱 Blocage principal actuel",
  points_a_creuser:  "# 📌 Points à creuser plus tard",
  historique:        "# 📅 Historique des diagnostics & actions",
};

function generateInitialProfileMarkdown(sections: {
  identite: string;
  business: string;
  temps_dispo: string;
  reve: string;
  blocage_principal: string;
  points_a_creuser: string[];
}): string {
  const parts: string[] = [];
  if (sections.identite)          parts.push(`${SECTION_HEADERS.identite}\n${sections.identite}`);
  if (sections.business)          parts.push(`${SECTION_HEADERS.business}\n${sections.business}`);
  if (sections.temps_dispo)       parts.push(`${SECTION_HEADERS.temps_dispo}\n${sections.temps_dispo}`);
  if (sections.reve)              parts.push(`${SECTION_HEADERS.reve}\n${sections.reve}`);
  if (sections.blocage_principal) parts.push(`${SECTION_HEADERS.blocage_principal}\n${sections.blocage_principal}`);

  const pts = Array.isArray(sections.points_a_creuser) ? sections.points_a_creuser : [];
  if (pts.length > 0) {
    parts.push(`${SECTION_HEADERS.points_a_creuser}\n${pts.map((p) => `- ${p}`).join("\n")}`);
  }
  // Section historique vide mais présente pour les futurs diagnostics
  parts.push(`${SECTION_HEADERS.historique}\n`);
  return parts.join("\n\n");
}

function appendDiagnosticEntry(
  currentMarkdown: string,
  entry: { date: string; sujet: string; diagnostic_resume: string; action_decidee: string; status: string },
): string {
  const statusMap: Record<string, string> = { en_cours: "⏳ En cours", fait: "✅ Fait", abandonne: "❌ Abandonné" };
  const newEntry = [
    `## ${entry.date} — ${entry.sujet}`,
    `- Diagnostic : ${entry.diagnostic_resume}`,
    `- Action décidée : ${entry.action_decidee}`,
    `- Status : ${statusMap[entry.status] ?? entry.status}`,
  ].join("\n");

  const histoHeader = SECTION_HEADERS.historique;
  if (currentMarkdown.includes(histoHeader)) {
    return currentMarkdown.replace(histoHeader, `${histoHeader}\n${newEntry}`);
  }
  return currentMarkdown + `\n\n${histoHeader}\n${newEntry}`;
}

function updateActionStatus(
  currentMarkdown: string,
  actionDate: string,
  newStatus: string,
  resultatReporte?: string,
): string {
  const statusMap: Record<string, string> = { en_cours: "⏳ En cours", fait: "✅ Fait", abandonne: "❌ Abandonné" };
  const displayStatus = statusMap[newStatus] ?? newStatus;
  const resultatLine = resultatReporte ? `\n- Résultat : ${resultatReporte}` : "";
  // Remplace le status dans l'entrée identifiée par la date
  const entryRegex = new RegExp(
    `(## ${escapeRegex(actionDate)} —[^\\n]*\\n(?:-[^\\n]*\\n)*?)-\\s*Status\\s*:[^\\n]*`,
    "m",
  );
  const updated = currentMarkdown.replace(entryRegex, `$1- Status : ${displayStatus}${resultatLine}`);
  if (updated === currentMarkdown) {
    console.warn(`[profile-update] action_status_update: entry for ${actionDate} not found`);
  }
  return updated;
}

function replaceSection(currentMarkdown: string, sectionName: string, newContent: string): string {
  const header = SECTION_HEADERS[sectionName];
  if (!header) {
    console.warn(`[profile-update] replaceSection: unknown section "${sectionName}"`);
    return currentMarkdown;
  }
  // Remplace tout le contenu entre ce header et le prochain header "# ..."
  const regex = new RegExp(`${escapeRegex(header)}\\n[\\s\\S]*?(?=\\n# |$)`, "m");
  if (regex.test(currentMarkdown)) {
    return currentMarkdown.replace(regex, `${header}\n${newContent}`);
  }
  // Section absente → ajouter avant l'historique ou en fin de document
  const histoPos = currentMarkdown.indexOf(SECTION_HEADERS.historique);
  if (histoPos !== -1) {
    return (
      currentMarkdown.slice(0, histoPos) +
      `${header}\n${newContent}\n\n` +
      currentMarkdown.slice(histoPos)
    );
  }
  return currentMarkdown + `\n\n${header}\n${newContent}`;
}

// ── Appliquer un <profile-update> en BDD — V8 ────────────────────────────────

async function applyProfileUpdate(
  userId: string,
  update: ProfileUpdateBlock,
  currentProfile: DbUserProfilePage,
): Promise<{ isPhase1JustCompleted: boolean }> {
  const now = new Date().toISOString();
  const isPhase1JustCompleted =
    update.type === "initial_profile_complete" && !currentProfile.is_phase1_complete;

  let newMarkdown = currentProfile.content_markdown ?? "";

  switch (update.type) {
    case "initial_profile_complete":
      newMarkdown = generateInitialProfileMarkdown(update.sections);
      break;
    case "diagnostic_completed":
      newMarkdown = appendDiagnosticEntry(newMarkdown, update.diagnostic_entry);
      break;
    case "action_status_update":
      newMarkdown = updateActionStatus(newMarkdown, update.action_date, update.new_status, update.resultat_reporte);
      break;
    case "section_correction":
      newMarkdown = replaceSection(newMarkdown, update.section, update.new_content);
      break;
  }

  const patch: Partial<DbUserProfilePage> = {
    content_markdown: newMarkdown,
    last_updated_by: "ai",
    last_updated_at: now,
    ai_update_count: (currentProfile.ai_update_count ?? 0) + 1,
  };

  if (isPhase1JustCompleted) {
    patch.is_phase1_complete = true;
    patch.phase1_completed_at = now;
  }

  const { error } = await supabaseAdmin
    .from("user_profile_page")
    .update(patch)
    .eq("user_id", userId);

  if (error) console.error("[profile-update] UPSERT error:", JSON.stringify(error));
  else console.log(`[profile-update] Applied type=${update.type}, isPhase1JustCompleted=${isPhase1JustCompleted}`);

  return { isPhase1JustCompleted };
}

// ── Gemini call ───────────────────────────────────────────────────────────────

async function callGemini(
  history: GeminiContent[],
  userMessageWithContext: string,
): Promise<{ text: string; tokensInput: number; tokensOutput: number }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY manquante côté serveur");

  const contents: GeminiContent[] = [
    ...history,
    { role: "user", parts: [{ text: userMessageWithContext }] },
  ];

  const body: GeminiRequest = {
    system_instruction: {
      parts: [{ text: FOWARDS_SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 1,    // Obligatoire pour Gemini 2.5 Flash (thinking mode)
      maxOutputTokens: 8192,
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
    // On remonte le vrai message Gemini pour faciliter le debug
    let geminiMsg = `Gemini ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      geminiMsg = errJson?.error?.message ?? errJson?.error ?? geminiMsg;
    } catch { geminiMsg = errText.slice(0, 300) || geminiMsg; }
    throw new Error(geminiMsg);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: réponse vide");

  const tokensInput  = data.usageMetadata?.promptTokenCount     ?? 0;
  const tokensOutput = data.usageMetadata?.candidatesTokenCount ?? 0;
  console.log(`[Gemini] tokens: prompt=${tokensInput}, output=${tokensOutput}`);

  return { text, tokensInput, tokensOutput };
}

// ── Triple parsing — extrait les 3 types de blocs de la réponse Gemini ────────
// AUCUN de ces blocs ne doit être visible par l'utilisateur

const RE_FOWARDS_DATA   = /<fowards-data>([\s\S]*?)<\/fowards-data>/g;
const RE_PROFILE_UPDATE = /<profile-update>([\s\S]*?)<\/profile-update>/g;
// Capture type="single" ou type="multi" + contenu pipe-séparé
const RE_CHOICES        = /<choices\s+type="(single|multi)">([\s\S]*?)<\/choices>/g;

interface ParsedResponse {
  cleanContent: string;
  forwardsData: Record<string, unknown> | null;
  profileUpdate: ProfileUpdateBlock | null;
  choices: ChoicesBlock | null;
}

function parseGeminiResponse(raw: string): ParsedResponse {
  let cleanContent = raw;
  let forwardsData: Record<string, unknown> | null = null;
  let profileUpdate: ProfileUpdateBlock | null = null;
  let choices: ChoicesBlock | null = null;

  // 1. <fowards-data>
  const fdMatches = [...raw.matchAll(RE_FOWARDS_DATA)];
  if (fdMatches.length > 0) {
    try { forwardsData = JSON.parse(fdMatches[0][1].trim()); } catch (e) {
      console.error("[fowards-data] JSON parse error:", e);
    }
  }
  cleanContent = cleanContent.replace(RE_FOWARDS_DATA, "");
  RE_FOWARDS_DATA.lastIndex = 0;

  // 2. <profile-update>
  const puMatches = [...raw.matchAll(RE_PROFILE_UPDATE)];
  if (puMatches.length > 0) {
    try { profileUpdate = JSON.parse(puMatches[0][1].trim()) as ProfileUpdateBlock; } catch (e) {
      console.error("[profile-update] JSON parse error:", e);
    }
  }
  cleanContent = cleanContent.replace(RE_PROFILE_UPDATE, "");
  RE_PROFILE_UPDATE.lastIndex = 0;

  // 3. <choices type="single|multi">opt1 | opt2 | ...</choices>
  const choiceMatches = [...raw.matchAll(RE_CHOICES)];
  if (choiceMatches.length > 0) {
    const choiceType = choiceMatches[0][1] as "single" | "multi";
    const rawOptions = choiceMatches[0][2];
    const options = rawOptions.split("|").map((o) => o.trim()).filter(Boolean);
    if (options.length > 0) choices = { type: choiceType, choices: options };
  }
  cleanContent = cleanContent.replace(RE_CHOICES, "");
  RE_CHOICES.lastIndex = 0;

  return {
    cleanContent: cleanContent.trim(),
    forwardsData,
    profileUpdate,
    choices,
  };
}

// ── Construire le contexte utilisateur injecté dans le message — V8 ──────────

function buildUserContext(profile: DbUserProfilePage, _mode: ChatMode): string {
  if (!profile.is_phase1_complete) {
    const partialContent = profile.content_markdown.trim();
    if (!partialContent) {
      // Toute première fois — aucune info collectée
      return "[FIRST_TIME_USER]";
    }
    // Phase 1 en cours — profil partiellement rempli
    return (
      `[FIRST_TIME_USER]\n[PHASE_1_IN_PROGRESS]\n` +
      `[USER_PROFILE_PAGE - WORK IN PROGRESS]\n${partialContent}\n[/USER_PROFILE_PAGE]`
    );
  }

  // Returning user avec profil Phase 1 complet
  const profileContent = profile.content_markdown.trim();
  if (!profileContent) return "[RETURNING_USER]";
  return `[RETURNING_USER]\n[USER_PROFILE_PAGE]\n${profileContent}\n[/USER_PROFILE_PAGE]`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /ai-fowards/ping
app.get("/ai-fowards/ping", (c) => c.json({ ok: true }));

// ── GET /quota-status ─────────────────────────────────────────────────────────
app.get("/ai-fowards/quota-status", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  try {
    const [quota, profile] = await Promise.all([
      getOrCreateQuota(userId),
      getOrCreateProfile(userId),
    ]);
    return c.json(buildQuotaStatus(quota, profile.is_phase1_complete));
  } catch (err) {
    console.error("[quota-status] error:", err);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// ── GET /ai-fowards/profile — retourne la page profil IA de l'user ────────────
app.get("/ai-fowards/profile", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  try {
    const profile = await getOrCreateProfile(userId);
    return c.json(profileToPublic(profile));
  } catch (err) {
    console.error("[profile GET] error:", err);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// ── PUT /ai-fowards/profile — l'user édite son profil manuellement ────────────
app.put("/ai-fowards/profile", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  let body: { contentMarkdown: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Corps invalide" }, 400);
  }

  if (typeof body.contentMarkdown !== "string") {
    return c.json({ error: "contentMarkdown requis" }, 400);
  }

  // Limite raisonnable pour éviter les abus
  if (body.contentMarkdown.length > 20000) {
    return c.json({ error: "Profil trop long (max 20 000 caractères)" }, 400);
  }

  try {
    const existing = await getOrCreateProfile(userId);
    const now = new Date().toISOString();

    await supabaseAdmin
      .from("user_profile_page")
      .update({
        content_markdown: body.contentMarkdown,
        last_updated_by: "user",
        last_updated_at: now,
        user_update_count: (existing.user_update_count ?? 0) + 1,
      })
      .eq("user_id", userId);

    return c.json({ success: true });
  } catch (err) {
    console.error("[profile PUT] error:", err);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// ── GET /conversations ────────────────────────────────────────────────────────
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

// ── GET /conversations/:id ────────────────────────────────────────────────────
app.get("/ai-fowards/conversations/:id", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Non authentifié" }, 401);

  const conversationId = c.req.param("id");

  try {
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

// ── POST /chat ────────────────────────────────────────────────────────────────
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

  // ── Quota + profil en parallèle ────────────────────────────────────────────
  const [quota, profile] = await Promise.all([
    getOrCreateQuota(userId),
    getOrCreateProfile(userId),
  ]);
  const quotaStatus = buildQuotaStatus(quota, profile.is_phase1_complete);

  // ── Vérification quota ─────────────────────────────────────────────────────
  if (mode === "normal" && !quotaStatus.canSendNormal) {
    return c.json({
      error: `Quota atteint : ${NORMAL_DAILY_LIMIT} messages normaux/jour. Reviens demain !`,
      quotaExceeded: true,
      quota: quotaStatus,
    }, 429);
  }

  if (mode === "diagnostic") {
    if (!profile.is_phase1_complete) {
      return c.json({
        error: "Le diagnostic est disponible uniquement après avoir complété le bilan initial (Phase 1).",
        quotaExceeded: false,
        quota: quotaStatus,
      }, 403);
    }
    if (!quotaStatus.canSendDiagnostic) {
      const hint = quotaStatus.diagnosticsUnlockedViaPost
        ? "Tu as déjà utilisé tes 2 diagnostics aujourd'hui. Reviens demain !"
        : "Publie un post de progression (≥50 caractères) pour débloquer un 2ème diagnostic.";
      return c.json({
        error: `Quota diagnostic atteint. ${hint}`,
        quotaExceeded: true,
        quota: quotaStatus,
      }, 429);
    }
  }

  try {
    // ── Créer ou récupérer la conversation ────────────────────────────────────
    let convId = conversationId;

    if (!convId) {
      const title = message.trim().slice(0, 60) + (message.trim().length > 60 ? "…" : "");
      const { data: newConv, error: createErr } = await supabaseAdmin
        .from("conversations")
        .insert({ user_id: userId, title, last_message_at: new Date().toISOString() })
        .select("id")
        .single();

      if (createErr) throw createErr;
      convId = newConv.id;
    } else {
      const { data: existingConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("id", convId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingConv) return c.json({ error: "Conversation introuvable" }, 404);
    }

    // ── Historique Gemini (max 40 messages) ───────────────────────────────────
    const { data: historyRows } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40);

    const geminiHistory: GeminiContent[] = (historyRows ?? []).map(
      (row: Pick<DbMessage, "role" | "content">) => ({
        role: row.role === "user" ? "user" : "model",
        parts: [{ text: row.content }],
      }),
    );

    // ── Injection contexte V7 (profil + mode) dans le message ─────────────────
    const userContext = buildUserContext(profile, mode);
    const modePrefix = mode === "diagnostic" ? "[MODE: DIAGNOSTIC]" : "[MODE: NORMAL]";
    const messageWithContext = `${userContext}\n\n${modePrefix} ${message.trim()}`;

    // ── Appel Gemini ──────────────────────────────────────────────────────────
    const { text: rawAiResponse, tokensInput, tokensOutput } = await callGemini(geminiHistory, messageWithContext);

    // ── Triple parsing (fowards-data, profile-update, choices) ────────────────
    const { cleanContent, forwardsData, profileUpdate, choices } = parseGeminiResponse(rawAiResponse);

    // ── Appliquer le <profile-update> si présent ──────────────────────────────
    let isPhase1JustCompleted = false;
    if (profileUpdate) {
      const result = await applyProfileUpdate(userId, profileUpdate, profile);
      isPhase1JustCompleted = result.isPhase1JustCompleted;
      console.log(`[profile-update] type=${profileUpdate.type}, phase1JustCompleted=${isPhase1JustCompleted}`);
    }

    // ── Sauvegarder les messages ───────────────────────────────────────────────
    const now = new Date().toISOString();

    console.log("[Bug1] Inserting messages — convId:", convId, "userId:", userId, "mode:", mode);
    const { error: msgInsertErr } = await supabaseAdmin.from("messages").insert([
      {
        conversation_id: convId,
        user_id: userId,
        role: "user",
        content: message.trim(), // On sauvegarde le message brut (sans le contexte injecté)
        mode,
        fowards_data: null,
        tokens_input: null,
        tokens_output: null,
        created_at: now,
      },
      {
        conversation_id: convId,
        user_id: userId,
        role: "assistant",
        content: cleanContent,
        mode,
        fowards_data: forwardsData,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        created_at: new Date(Date.now() + 1).toISOString(),
      },
    ]);
    if (msgInsertErr) console.error("[Bug1] Messages insert ERROR:", JSON.stringify(msgInsertErr));
    else console.log("[Bug1] Messages inserted OK");

    // ── Mettre à jour la conversation ──────────────────────────────────────────
    const lastPreview = cleanContent.replace(/\n+/g, " ").slice(0, 120);
    const newMsgCount = (historyRows?.length ?? 0) + 2;
    const convUpdate: Record<string, unknown> = {
      last_message_at: now,
      message_count: newMsgCount,
      last_message_preview: lastPreview,
    };
    if (mode === "diagnostic") convUpdate.has_final_diagnostic = true;

    console.log("[Bug1] Updating conversation — convId:", convId, "fields:", JSON.stringify(convUpdate));
    const { error: convUpdateErr } = await supabaseAdmin
      .from("conversations")
      .update(convUpdate)
      .eq("id", convId);
    if (convUpdateErr) console.error("[Bug1] Conversation update ERROR:", JSON.stringify(convUpdateErr));
    else console.log("[Bug1] Conversation updated OK");

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

    // ── Quota final mis à jour ────────────────────────────────────────────────
    const finalPhase1Complete = isPhase1JustCompleted || profile.is_phase1_complete;
    const updatedQuota = await getOrCreateQuota(userId);

    return c.json({
      conversationId: convId,
      message: cleanContent,
      forwardsData: forwardsData ?? null,
      choices: choices ?? null,
      mode,
      isPhase1JustCompleted,
      quota: buildQuotaStatus(updatedQuota, finalPhase1Complete),
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
