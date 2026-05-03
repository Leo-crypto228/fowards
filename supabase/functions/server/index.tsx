import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";


const app = new Hono();

// ── Supabase admin client ─────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Resend client for emails ──────────────────────────────────────────────────
const resend = new Resend(Deno.env.get("Resend_API_KEY_Fowards")!);

const PROFILE_BUCKET  = "make-218684af-profile-images";
const POST_IMG_BUCKET = "make-218684af-post-images";
const COMMUNITY_IMG_BUCKET = "make-218684af-community-images";

// Idempotent bucket creation (public so URLs never expire)
(async () => {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const names = buckets?.map((b: { name: string }) => b.name) ?? [];
    if (!names.includes(PROFILE_BUCKET)) {
      await supabaseAdmin.storage.createBucket(PROFILE_BUCKET, { public: true });
      console.log(`Bucket ${PROFILE_BUCKET} créé.`);
    }
    if (!names.includes(POST_IMG_BUCKET)) {
      await supabaseAdmin.storage.createBucket(POST_IMG_BUCKET, { public: true });
      console.log(`Bucket ${POST_IMG_BUCKET} créé.`);
    }
    if (!names.includes(COMMUNITY_IMG_BUCKET)) {
      await supabaseAdmin.storage.createBucket(COMMUNITY_IMG_BUCKET, { public: true });
      console.log(`Bucket ${COMMUNITY_IMG_BUCKET} créé.`);
    }
  } catch (err) {
    console.error("Erreur init bucket:", err);
  }
})();

// CORS doit être le PREMIER middleware (avant logger) pour gérer correctement
// les requêtes OPTIONS preflight — sinon le browser reçoit "Failed to fetch".
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);
app.use("*", logger(console.log));

// ── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Helper : créer une notification sociale ────────────────────────────────────
async function createSocialNotif(params: {
  userId: string;       // destinataire
  type: string;         // "like" | "comment" | "follow"
  senderId: string;     // expéditeur
  postId?: string;
  commentId?: string;
}): Promise<void> {
  try {
    if (!params.userId || !params.senderId || params.userId === params.senderId) return;
    const notifId = genId();
    const notif = {
      id: notifId,
      userId: params.userId,
      type: params.type,
      senderId: params.senderId,
      postId: params.postId || null,
      commentId: params.commentId || null,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`ff:notif:${notifId}`, JSON.stringify(notif));
    const notifIds: string[] = JSON.parse((await kv.get(`ff:notifs:user:${params.userId}`)) || "[]");
    notifIds.unshift(notifId);
    if (notifIds.length > 100) notifIds.splice(100);
    await kv.set(`ff:notifs:user:${params.userId}`, JSON.stringify(notifIds));
  } catch (e) {
    console.log("createSocialNotif error:", e);
  }
}

// ── Goal duration helpers ─────────────────────────────────────────────────────

const DURATION_DAYS_MAP: Record<string, number> = {
  "1_semaine": 7, "1_mois": 30, "3_mois": 90,
  "6_mois": 180, "1_an": 365, "2_ans": 730, "plus": 1000,
};

function getDurationDays(dt: string): number { return DURATION_DAYS_MAP[dt] ?? 90; }
/** Coefficient de normalisation par durée (objectifs longs progressent plus lentement) */
function getDurationCoeff(days: number): number {
  if (days <= 30) return 1.0;   // court terme   ≤ 30j
  if (days <= 90) return 0.7;   // moyen terme   31–90j
  if (days <= 365) return 0.5;  // long terme    91–365j
  return 0.3;                   // très long     >365j
}
/**
 * progress_max = duration_days × 10 × coeff_durée
 * ↳ 1 action "avancée" par jour pendant toute la durée = exactement 100%.
 * Ex: 3 mois (90j, coeff 0.7) → 90×10×0.7=630. Avancée/j=7pts → 90 jours → 100%.
 */
function getProgressMax(days: number): number {
  const coeff = getDurationCoeff(days);
  return Math.max(1, Math.round(days * 10 * coeff));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoalObj = Record<string, any> & {
  id: string; title: string; description: string;
  progress: number; // = Math.round(progress_percentage * 100), peut dépasser 100
  status: string; createdAt: string; updatedAt: string; completedAt?: string;
  duration_type: string; duration_days: number;
  progress_score: number;      // points accumulés
  progress_max: number;        // score cible = duration_days × FACTEUR_BASE
  progress_percentage: number; // progress_score / progress_max, peut dépasser 1.0
};

/** Migration d'un ancien objectif (sans champs durée/score) vers le nouveau modèle */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateGoalObj(g: Record<string, any>): GoalObj {
  if (g.duration_type === undefined) {
    g.duration_type = "3_mois";
    g.duration_days = 90;
    g.progress_max = getProgressMax(90);
    const prevPct = ((g.progress as number) || 0) / 100;
    g.progress_score = Math.round(prevPct * (g.progress_max as number));
    g.progress_percentage = prevPct;
    // progress reste inchangé (compat backward)
  }
  return g as GoalObj;
}

/**
 * Détecte le type d'action depuis le texte et retourne les points de base.
 * Retourne -1 si une complétion explicite est détectée.
 * Actions : avancée +10 | travail +6 | apprentissage +4 | échec expliqué +7 | partiel +10→+20
 * Fallback : tout texte > 40 chars = minimum 3 pts (l'effort de partager compte)
 */
function detectActionScore(text: string, rawTextLength: number): number {
  const COMPLETION = [
    "j'ai fini","j'ai terminé","objectif atteint","c'est fait","mission accomplie",
    "j'ai accompli","c'est terminé","objectif rempli","j'ai réussi mon objectif",
    "je l'ai fait","objectif accompli","j'ai réussi","j'ai completé","j'ai complété",
    "100%","c'est fini","i finished","done","completed","achieved",
    "mon objectif est atteint","mon objectif est terminé",
  ];
  if (COMPLETION.some((w) => text.includes(w))) return -1; // signal complétion explicite

  const countW = (words: string[]) => words.filter((w) => text.includes(w)).length;

  // Avancée concrète → +10
  const avCount = countW([
    "avancé","avancée","avance","milestone","réalisé","réussi","fini","terminé",
    "atteint","complété","déployé","livré","validé","construit","lancé","publié",
    "créé","développé","codé","écrit","sorti","finalisé","mis en ligne","mergé",
    "shipper","shipped","fait","j'ai fait","on a fait","j'ai pu","j'ai réussi à",
    "couru","marché","nagé","joué","entraîné","musclé","progressé","accompli",
    "signé","gagné","obtenu","décroché","vendu","envoyé",
  ]);
  // Travail en cours → +6
  const trCount = countW([
    "travaillé","bossé","working","work","session","sprint","focalisé",
    "deepwork","deep work","focus","effort","boulot","codé","codage",
    "travaux","je travaille","en train","en cours","continue","continué",
    "je continue","je me suis mis","j'ai commencé","débuté","entamé",
    "j'ai passé","passé du temps","heures dessus","sur le projet",
  ]);
  // Apprentissage → +4
  const apCount = countW([
    "appris","découvert","compris","étudié","lu","exploré","formation",
    "cours","tutoriel","lecture","regardé","regarder","suivi","suivre",
    "vu un","lu un","visionné","documentation","doc","ressource","vidéo",
    "podcast","bouquin","livre","recherche","testé",
  ]);
  // Échec expliqué (si texte suffisamment long = effort de réflexion) → +7
  const ecCount = countW([
    "raté","bloqué","échoué","difficile","échec","problème","bug","erreur",
    "obstacle","galère","pas réussi","n'a pas","n'ai pas","trop dur",
    "compliqué","frustrant","décevant","ça n'a pas",
  ]);
  // Partiel → +10 à +20
  const paCount = countW([
    "partiellement","presque","à moitié","en partie","mi-chemin","progressé",
    "presque fini","presque terminé","à 50%","à 70%","à 80%","à 90%",
    "bien avancé","très avancé","bonne avancée",
  ]);

  let pts = 0;
  if (avCount > 0) pts = Math.max(pts, 10);                               // avancée → +10
  if (trCount > 0) pts = Math.max(pts, 6);                                // travail → +6
  if (apCount > 0) pts = Math.max(pts, 4);                                // apprentissage → +4
  if (ecCount > 0 && rawTextLength > 60) pts = Math.max(pts, 7);         // échec expliqué → +7
  if (paCount > 0) pts = Math.max(pts, Math.min(20, 10 + paCount * 3));  // partiel → +10 à +20

  // Fallback : tout texte de plus de 40 chars = minimum 3 pts (l'effort de partager compte)
  if (pts === 0 && rawTextLength >= 40) pts = 3;

  return pts;
}

/** Normalise un username : lowercase, sans accents, ASCII seulement */
function normalizeUsername(raw: string): string {
  const nfd = raw.normalize("NFD");
  let clean = "";
  for (let i = 0; i < nfd.length; i++) {
    const cp = nfd.codePointAt(i) ?? 0;
    if (cp >= 0x0300 && cp <= 0x036f) continue; // diacritique → skip
    if (cp < 128) clean += nfd[i];               // ASCII → garder
  }
  return clean.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_-]/g, "");
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/make-server-218684af/health", (c) => c.json({ status: "ok" }));

// ── Auto-migration user-numbers (idempotent au démarrage) ───────────────────
// Assign rétroactivement ff:user-number aux utilisateurs créés avant ce système.
(async () => {
  try {
    const migDone = await kv.get("ff:migration:user-numbers-v1");
    if (migDone) return; // Déjà fait
    const rawProfiles = await kv.getByPrefix("ff:profile:");
    const profiles: Array<{ username: string; createdAt: string }> = [];
    for (const raw of rawProfiles) {
      try {
        const p = JSON.parse(raw);
        // Ignorer les profils fictifs (seeded) qui n'ont pas de supabaseId
        if (p.username && p.createdAt && p.supabaseId) {
          profiles.push({ username: String(p.username).toLowerCase(), createdAt: String(p.createdAt) });
        }
      } catch { /* skip */ }
    }
    if (profiles.length === 0) return;
    profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const currentCount = parseInt((await kv.get("ff:user-count")) || "0");
    if (currentCount > 0) {
      await kv.set("ff:migration:user-numbers-v1", "done");
      return; // Le compteur existe déjà, la migration a probablement déjà eu lieu
    }
    await kv.set("ff:user-count", String(profiles.length));
    for (let i = 0; i < profiles.length; i++) {
      const { username } = profiles[i];
      const userNum = i + 1;
      const existing = await kv.get(`ff:user-number:${username}`);
      if (!existing) {
        await kv.set(`ff:user-number:${username}`, String(userNum));
        if (userNum <= 500)  await awardFcoin(username, "rare_early",   true); // silent
        if (userNum <= 1000) await awardFcoin(username, "rare_pioneer",  true); // silent
      }
    }
    await kv.set("ff:migration:user-numbers-v1", "done");
    console.log(`[init] Migration user-numbers: ${profiles.length} utilisateurs réels numérotés.`);
  } catch (e) {
    console.log("[init] Erreur migration user-numbers (ignorée):", e);
  }
})();

// ── Sécurité upload : validation MIME réelle + taille ─────────────────────────
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg:  "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
};

/** Vérifie les magic bytes du fichier (pas seulement l'extension) et retourne le MIME réel. */
function detectMimeFromBytes(bytes: Uint8Array): string | null {
  // JPEG : FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
  // WebP : RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** Génère un nom de fichier aléatoire UUID (aucune référence au nom d'utilisateur). */
function safeFileName(mime: string): string {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const rand = crypto.randomUUID().replace(/-/g, "");
  return `${rand}.${ext}`;
}

/** Validation complète : taille, extension autorisée, MIME bytes réels. */
async function validateUpload(file: File): Promise<
  { ok: true; bytes: Uint8Array; mime: string } | { ok: false; error: string }
> {
  if (file.size === 0) return { ok: false, error: "Fichier vide." };
  if (file.size > MAX_UPLOAD_BYTES)
    return { ok: false, error: `Fichier trop volumineux (max 5 MB, reçu ${(file.size / 1024 / 1024).toFixed(1)} MB).` };

  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ALLOWED_MIME[rawExt])
    return { ok: false, error: `Extension non autorisée (.${rawExt}). Formats acceptés : JPG, PNG, WEBP.` };

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const realMime = detectMimeFromBytes(bytes);
  if (!realMime)
    return { ok: false, error: "Contenu du fichier invalide ou non reconnu. Seuls JPG, PNG et WEBP sont acceptés." };

  // Cohérence extension ↔ MIME réel (évite renommage .svg → .jpg)
  const declaredMime = ALLOWED_MIME[rawExt];
  if (realMime !== declaredMime)
    return { ok: false, error: `Incohérence détectée : le fichier prétend être .${rawExt} mais son contenu ne correspond pas. Upload refusé.` };

  return { ok: true, bytes, mime: realMime };
}

// ── Upload image de post → Supabase Storage (public bucket) ──────────────────
app.post("/make-server-218684af/upload-image", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!file || typeof file === "string") {
      return c.json({ error: "Fichier requis (champ 'file')" }, 400);
    }

    const validation = await validateUpload(file as File);
    if (!validation.ok) {
      console.log("Upload post image refusé:", validation.error);
      return c.json({ error: validation.error }, 400);
    }
    const { bytes, mime } = validation;

    const fileName = safeFileName(mime);
    const { error: upErr } = await supabaseAdmin.storage
      .from(POST_IMG_BUCKET)
      .upload(fileName, bytes, { contentType: mime, upsert: false });

    if (upErr) {
      console.error("Erreur upload image post:", upErr);
      return c.json({ error: `Erreur upload: ${upErr.message}` }, 500);
    }

    const { data: urlData } = supabaseAdmin.storage.from(POST_IMG_BUCKET).getPublicUrl(fileName);
    console.log(`Image post uploadée: ${fileName} (${mime}), url=${urlData.publicUrl}`);
    return c.json({ success: true, url: urlData.publicUrl });
  } catch (err) {
    console.error("Erreur upload-image:", err);
    return c.json({ error: `Échec upload: ${err}` }, 500);
  }
});

// ── Upload image communauté (avatar ou bannière) ──────────────────────────────
app.post("/make-server-218684af/upload-community-image", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!file || typeof file === "string") {
      return c.json({ error: "Fichier requis (champ 'file')" }, 400);
    }

    const validation = await validateUpload(file as File);
    if (!validation.ok) {
      console.log("Upload community image refusé:", validation.error);
      return c.json({ error: validation.error }, 400);
    }
    const { bytes, mime } = validation;

    const fileName = safeFileName(mime);
    const { error: upErr } = await supabaseAdmin.storage
      .from(COMMUNITY_IMG_BUCKET)
      .upload(fileName, bytes, { contentType: mime, upsert: false });

    if (upErr) {
      console.error("Erreur upload community image:", upErr);
      return c.json({ error: `Erreur upload: ${upErr.message}` }, 500);
    }

    const { data: urlData } = supabaseAdmin.storage.from(COMMUNITY_IMG_BUCKET).getPublicUrl(fileName);
    console.log(`Community image uploadée: ${fileName} (${mime}), url=${urlData.publicUrl}`);
    return c.json({ success: true, url: urlData.publicUrl });
  } catch (err) {
    console.error("Erreur upload-community-image:", err);
    return c.json({ error: `Échec upload: ${err}` }, 500);
  }
});

// ── POST /communities — Créer une communauté ──────────────────────────────────
app.post("/make-server-218684af/communities", async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, mentality, mentalityWord, avatar, banner, tags, visibility, rules, createdBy } = body;
    if (!name || !mentality || !createdBy) {
      return c.json({ error: "name, mentality et createdBy sont requis." }, 400);
    }
    const id = genId();
    const community = {
      id,
      name: name.trim(),
      description: (description ?? "").trim(),
      mentality,
      mentalityWord: (mentalityWord ?? "").trim(),
      avatar: avatar ?? "",
      banner: banner ?? "",
      tags: tags ?? [],
      visibility: visibility ?? "public",
      rules: (rules ?? "").trim(),
      createdBy,
      members: 1,
      streak: 0,
      constance: 0,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`ff:community:${id}`, JSON.stringify(community));
    // Enregistrer le créateur comme membre automatiquement
    await kv.set(`ff:community-member:${id}:${createdBy}`, JSON.stringify({ userId: createdBy, joinedAt: new Date().toISOString(), isCreator: true }));
    // Mettre à jour l'index global
    const idxRaw = await kv.get("ff:community-idx");
    const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    idx.unshift(id);
    await kv.set("ff:community-idx", JSON.stringify(idx));
    console.log(`Communauté créée: id=${id}, name=${name}, by=${createdBy}, tags=${JSON.stringify(tags)}`);
    return c.json({ success: true, community });
  } catch (err) {
    return c.json({ error: `Échec création communauté: ${err}` }, 500);
  }
});

// ── GET /communities — Lister toutes les communautés ─────────────────────────
app.get("/make-server-218684af/communities", async (c) => {
  try {
    const idxRaw = await kv.get("ff:community-idx");
    const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    const communities = [];
    for (const id of idx) {
      const raw = await kv.get(`ff:community:${id}`);
      if (raw) communities.push(JSON.parse(raw));
    }
    return c.json({ communities, total: communities.length });
  } catch (err) {
    return c.json({ error: `Échec récupération communautés: ${err}` }, 500);
  }
});

// ── GET /communities/:id — Récupérer une communauté par ID ───────────────────
app.get("/make-server-218684af/communities/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const raw = await kv.get(`ff:community:${id}`);
    if (!raw) return c.json({ error: "Communauté introuvable." }, 404);
    return c.json({ community: JSON.parse(raw) });
  } catch (err) {
    return c.json({ error: `Échec récupération communauté: ${err}` }, 500);
  }
});

// ── PUT /communities/:id — Modifier une communauté (créateur uniquement) ──────
app.put("/make-server-218684af/communities/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { name, description, mentality, mentalityWord, avatar, banner, tags, visibility, rules, requestedBy } = body;
    if (!name || !mentality || !requestedBy) {
      return c.json({ error: "name, mentality et requestedBy sont requis." }, 400);
    }
    const raw = await kv.get(`ff:community:${id}`);
    if (!raw) return c.json({ error: "Communauté introuvable." }, 404);
    const existing = JSON.parse(raw);
    if (existing.createdBy !== requestedBy) {
      return c.json({ error: "Seul le créateur peut modifier cette communauté." }, 403);
    }
    const updated = {
      ...existing,
      name: name.trim(),
      description: (description ?? "").trim(),
      mentality,
      mentalityWord: (mentalityWord ?? existing.mentalityWord ?? "").trim(),
      avatar: avatar ?? existing.avatar,
      banner: banner ?? existing.banner,
      tags: tags ?? existing.tags ?? [],
      visibility: visibility ?? existing.visibility ?? "public",
      rules: (rules ?? "").trim(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`ff:community:${id}`, JSON.stringify(updated));
    console.log(`Communauté modifiée: id=${id}, by=${requestedBy}`);
    return c.json({ success: true, community: updated });
  } catch (err) {
    return c.json({ error: `Échec modification communauté: ${err}` }, 500);
  }
});

// ── DELETE /communities/:id — Supprimer une communauté (créateur uniquement) ──
app.delete("/make-server-218684af/communities/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { requestedBy } = body;
    if (!requestedBy) {
      return c.json({ error: "requestedBy est requis." }, 400);
    }
    const raw = await kv.get(`ff:community:${id}`);
    if (!raw) return c.json({ error: "Communauté introuvable." }, 404);
    const existing = JSON.parse(raw);
    if (existing.createdBy !== requestedBy) {
      return c.json({ error: "Seul le créateur peut supprimer cette communauté." }, 403);
    }

    // 1. Supprimer la communauté elle-même
    await kv.del(`ff:community:${id}`);

    // 2. Retirer de l'index global
    const idxRaw = await kv.get("ff:community-idx");
    const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    await kv.set("ff:community-idx", JSON.stringify(idx.filter((i) => i !== id)));

    // 3. Nettoyer les entrées membres (best-effort)
    try {
      const memberEntries = await kv.getByPrefix(`ff:community-member:${id}:`);
      for (const entry of memberEntries) {
        if (entry) {
          const parsed = JSON.parse(entry);
          if (parsed.userId) {
            await kv.del(`ff:community-member:${id}:${parsed.userId}`);
          }
        }
      }
    } catch (e) {
      console.log(`Nettoyage membres communauté ${id} - erreur ignorée:`, e);
    }

    console.log(`Communauté supprimée: id=${id}, by=${requestedBy}`);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec suppression communauté: ${err}` }, 500);
  }
});

// ── GET /onboarding/suggested-profiles — Vrais profils réels pour l'onboarding ─
app.get("/make-server-218684af/onboarding/suggested-profiles", async (c) => {
  try {
    const exclude = c.req.query("exclude") || "";
    const rawProfiles = await kv.getByPrefix("ff:profile:");
    const profiles: Array<{
      handle: string; name: string; objective: string; streak: number; avatar: string;
    }> = [];
    for (const raw of rawProfiles) {
      if (!raw) continue;
      try {
        const p = JSON.parse(raw);
        // Seulement les vrais comptes (avec supabaseId) et onboarding terminé
        if (!p.supabaseId || !p.onboardingDone) continue;
        if (p.username === exclude) continue;
        profiles.push({
          handle:    p.username || "",
          name:      p.name || p.username || "",
          objective: p.objective || "",
          streak:    p.streak || 0,
          avatar:    p.avatar || "",
        });
      } catch { /* skip */ }
    }
    // Mélange aléatoire + limite 20
    for (let i = profiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
    }
    return c.json({ profiles: profiles.slice(0, 20) });
  } catch (err) {
    return c.json({ error: `Échec suggested-profiles: ${err}` }, 500);
  }
});

// ── GET /onboarding/suggested-communities — Vraies communautés pour l'onboarding ─
app.get("/make-server-218684af/onboarding/suggested-communities", async (c) => {
  try {
    const idxRaw = await kv.get("ff:community-idx");
    const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    const communities: Array<{
      id: string; name: string; description: string; members: number; emoji: string; avatar: string;
    }> = [];
    for (const id of idx) {
      const raw = await kv.get(`ff:community:${id}`);
      if (!raw) continue;
      try {
        const comm = JSON.parse(raw);
        const memberEntries = await kv.getByPrefix(`ff:community-member:${id}:`);
        const memberCount = memberEntries.filter(Boolean).length;
        communities.push({
          id:          comm.id || id,
          name:        comm.name || "",
          description: comm.description || "",
          members:     memberCount,
          emoji:       comm.emoji || "🌟",
          avatar:      comm.avatar || "",
        });
      } catch { /* skip */ }
    }
    return c.json({ communities });
  } catch (err) {
    return c.json({ error: `Échec suggested-communities: ${err}` }, 500);
  }
});

// ── GET /community-notifications/:communityId — Statut notification utilisateur
app.get("/make-server-218684af/community-notifications/:communityId", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const val = await kv.get(`ff:comm-notif:${userId}:${communityId}`);
    return c.json({ enabled: val === "1" });
  } catch (err) {
    return c.json({ error: `Échec récupération notification: ${err}` }, 500);
  }
});

// ── PUT /community-notifications/:communityId — Basculer notification ─────────
app.put("/make-server-218684af/community-notifications/:communityId", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const key = `ff:comm-notif:${userId}:${communityId}`;
    const current = await kv.get(key);
    const newState = current === "1" ? "0" : "1";
    await kv.set(key, newState);
    console.log(`Notification communauté ${communityId}: user=${userId}, enabled=${newState === "1"}`);
    return c.json({ success: true, enabled: newState === "1" });
  } catch (err) {
    return c.json({ error: `Échec toggle notification: ${err}` }, 500);
  }
});

// ── PUT /communities/:id/join — Rejoindre une communauté ─────────────────────
app.put("/make-server-218684af/communities/:id/join", async (c) => {
  try {
    const id = c.req.param("id");
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const raw = await kv.get(`ff:community:${id}`);
    if (!raw) return c.json({ error: "Communauté introuvable." }, 404);
    const memberKey = `ff:community-member:${id}:${userId}`;
    const alreadyMember = await kv.get(memberKey);
    if (!alreadyMember) {
      await kv.set(memberKey, JSON.stringify({ userId, joinedAt: new Date().toISOString() }));
      const community = JSON.parse(raw);
      community.members = (community.members || 1) + 1;
      await kv.set(`ff:community:${id}`, JSON.stringify(community));
      console.log(`User ${userId} a rejoint la communauté ${id}`);
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec join communauté: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// POSTS
// ═══════════════════════════════════════════════════════════════════��════════

app.post("/make-server-218684af/posts", async (c) => {
  try {
    const body = await c.req.json();
    const { user, streak, progress, hashtags, username } = body;
    if (!progress?.description?.trim()) return c.json({ error: "Contenu requis." }, 400);
    if (!progress?.type)               return c.json({ error: "Type requis." }, 400);
    if (!user?.name)                   return c.json({ error: "Utilisateur requis." }, 400);

    const id = genId();
    const createdAt = new Date().toISOString();
    const resolvedUsername = normalizeUsername(username || user.name);

    const post = {
      id, user: { name: user.name, avatar: user.avatar || "", objective: user.objective || "", followers: user.followers || 0 },
      streak: streak || 0,
      progress: { type: progress.type, description: progress.description.trim(), timestamp: "À l'instant" },
      hashtags: hashtags || [], image: body.image || null, verified: false,
      relevantCount: 0, commentsCount: 0, sharesCount: 0, viewsCount: 0,
      isNew: true, createdAt, username: resolvedUsername,
    };

    await kv.set(`ff:post:${id}`, JSON.stringify(post));
    const allIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");
    allIds.unshift(id);
    if (allIds.length > 500) allIds.splice(500);
    await kv.set("ff:posts:all", JSON.stringify(allIds));
    const userIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${resolvedUsername}`)) || "[]");
    userIds.unshift(id);
    await kv.set(`ff:posts:user:${resolvedUsername}`, JSON.stringify(userIds));

    // Progression + activité journalière
    await logActivity(resolvedUsername, "post", { postId: id });
    await addProgressScore(resolvedUsername, 5);
    await checkAndAwardFcoins(resolvedUsername);

    // ── Analyse IA du post → micro-progression de l'objectif actif ───────────
    try {
      const gRaw2 = await kv.get(`ff:goals:${resolvedUsername}`);
      if (gRaw2) {
        // Migration automatique au nouveau modèle durée/score
        const goals2: GoalObj[] = (JSON.parse(gRaw2) as Record<string, unknown>[]).map(migrateGoalObj);
        // Priorité : objectif sélectionné par l'utilisateur, sinon premier en_cours
        const selectedId2 = await kv.get(`ff:goals-selected:${resolvedUsername}`);
        const g2 = (selectedId2 ? goals2.find((x) => x.id === selectedId2) : null)
          ?? goals2.find((x) => x.status !== "accompli")
          ?? goals2[0];
        if (g2 && g2.status !== "accompli") {
          const postTextLow = (progress.description || "").toLowerCase();
          // Détection d'action via le même système que progress-report
          const actionScore = detectActionScore(postTextLow, (progress.description || "").length);
          if (actionScore > 0) {
            const coeff = getDurationCoeff(g2.duration_days);
            // Posts = contribution légère (max 5 pts de base) pour éviter inflation
            const finalScore = Math.round(Math.min(5, actionScore) * coeff);
            if (finalScore > 0) {
              const prevScore = g2.progress_score;
              const prevPct = g2.progress;
              g2.progress_score = prevScore + finalScore;
              g2.progress_percentage = g2.progress_score / g2.progress_max;
              g2.progress = Math.round(g2.progress_percentage * 100); // peut dépasser 100
              g2.updatedAt = new Date().toISOString();
              await kv.set(`ff:goals:${resolvedUsername}`, JSON.stringify(goals2));
              const pRaw2 = await kv.get(`ff:profile:${resolvedUsername}`);
              if (pRaw2) { const p2 = JSON.parse(pRaw2); p2.progressPct = g2.progress; await kv.set(`ff:profile:${resolvedUsername}`, JSON.stringify(p2)); }
              console.log(`Post goal-boost: user=${resolvedUsername}, +${finalScore}pts, score ${prevScore}→${g2.progress_score} (${prevPct}%→${g2.progress}%)`);
            }
          }
        }
      }
    } catch (e) { console.log("Erreur analyse post goal:", e); }

    console.log(`Post créé: id=${id}, user=${resolvedUsername}`);
    return c.json({ success: true, post });
  } catch (err) {
    console.log("Erreur création post:", err);
    return c.json({ error: `Échec création post: ${err}` }, 500);
  }
});

app.get("/make-server-218684af/posts", async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
    const allIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");
    const posts = [];
    // Charger un peu plus que limit pour compenser les manquants, puis trier
    for (const id of allIds.slice(0, Math.min(allIds.length, limit * 2))) {
      const raw = await kv.get(`ff:post:${id}`);
      if (raw) {
        const post = JSON.parse(raw);
        if (post.createdAt) post.progress.timestamp = relativeTime(post.createdAt);
        posts.push(post);
      }
    }
    // Tri décroissant par createdAt (garantit l'ordre même si l'index KV est désynchronisé)
    posts.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return c.json({ posts: posts.slice(0, limit), total: allIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération posts: ${err}` }, 500);
  }
});

app.get("/make-server-218684af/posts/user/:username", async (c) => {
  try {
    const username = c.req.param("username");
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
    const userIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
    const posts = [];
    for (const id of userIds.slice(0, Math.min(userIds.length, limit * 2))) {
      const raw = await kv.get(`ff:post:${id}`);
      if (raw) {
        const post = JSON.parse(raw);
        if (post.createdAt) post.progress.timestamp = relativeTime(post.createdAt);
        posts.push(post);
      }
    }
    // Tri décroissant par createdAt
    posts.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return c.json({ posts: posts.slice(0, limit), total: userIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération posts user: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════�����══════════════════════════════
// ACTIONS SUR LES POSTS (signalement, préférences, pertinence)
// ═══════════════════════════════════════════════════════════════════════════

// POST /post-actions/report-inappropriate — Signale + analyse + supprime si vraiment inapproprié
app.post("/make-server-218684af/post-actions/report-inappropriate", async (c) => {
  try {
    const { postId, reporterId } = await c.req.json();
    if (!postId || !reporterId) return c.json({ error: "postId et reporterId requis." }, 400);

    // Éviter les doublons de signalement
    const reportKey = `ff:report:${postId}:${reporterId}`;
    const alreadyReported = await kv.get(reportKey);
    if (alreadyReported) return c.json({ success: true, alreadyReported: true, deleted: false });
    await kv.set(reportKey, "1");

    // Incrémenter le compteur de signalements
    const countKey = `ff:report-count:${postId}`;
    const count = parseInt((await kv.get(countKey)) || "0") + 1;
    await kv.set(countKey, String(count));

    // Récupérer le post pour analyse
    const raw = await kv.get(`ff:post:${postId}`);
    if (!raw) return c.json({ success: true, deleted: false, reason: "post_not_found" });
    const post = JSON.parse(raw);
    const content = (post.progress?.description || "").toLowerCase();

    // ── Analyse heuristique stricte du contenu inapproprié ─────────────────
    // Gravité HAUTE : haine, violence directe, contenu sexuel explicite, illégal
    const HIGH_SEVERITY = [
      "sale arabe","sale noir","sale juif","sale blanc","sale asiat","nique les",
      "mort aux","à mort les","exterminer","génocide","sous-homme","sous-humain",
      "je vais te tuer","je vais te buter","je vais te crever","menace de mort",
      "te faire du mal","attentat","bombe humaine",
      "pédophilie","pédopornographie","contenu pédophile",
      "vente de drogue","acheter cocaïne","acheter héroïne","armes illégales",
      "trafic d'armes","trafic de drogue",
    ];
    // Gravité MOYENNE : insultes graves, incitation
    const MED_SEVERITY = [
      "connard","enculé","va te faire foutre","fils de pute",
      "incitation à la haine","racisme assumé","homophobie déclarée",
    ];

    const highScore = HIGH_SEVERITY.filter((w) => content.includes(w)).length;
    const medScore  = MED_SEVERITY.filter((w) => content.includes(w)).length;

    // 1 mot haute gravité OU 3+ mots moyens OU 5+ signalements → suppression
    const shouldDelete = highScore >= 1 || medScore >= 3 || count >= 5;

    if (shouldDelete) {
      await kv.del(`ff:post:${postId}`);
      const allIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");
      await kv.set("ff:posts:all", JSON.stringify(allIds.filter((i) => i !== postId)));
      const authorUsername = post.username;
      if (authorUsername) {
        const userIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${authorUsername}`)) || "[]");
        await kv.set(`ff:posts:user:${authorUsername}`, JSON.stringify(userIds.filter((i) => i !== postId)));
      }
      await kv.set(`ff:post-deleted:${postId}`, JSON.stringify({ reason: "inappropriate", deletedAt: new Date().toISOString(), highScore, medScore, reportCount: count }));
      console.log(`Post ${postId} supprimé pour contenu inapproprié (high=${highScore}, med=${medScore}, reports=${count})`);
      return c.json({ success: true, deleted: true, reason: highScore >= 1 ? "high_severity" : medScore >= 3 ? "med_severity" : "report_threshold" });
    }

    return c.json({ success: true, deleted: false, reportCount: count });
  } catch (err) {
    console.log("Erreur report-inappropriate:", err);
    return c.json({ error: `Échec signalement: ${err}` }, 500);
  }
});

// POST /post-actions/reduce-author — Voir moins de posts de cet auteur dans le feed
app.post("/make-server-218684af/post-actions/reduce-author", async (c) => {
  try {
    const { userId, authorUsername } = await c.req.json();
    if (!userId || !authorUsername) return c.json({ error: "userId et authorUsername requis." }, 400);
    await kv.set(`ff:user-pref:${userId}:reduce:${authorUsername}`, "1");
    console.log(`Préférence: ${userId} voit moins de ${authorUsername}`);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec préférence auteur: ${err}` }, 500);
  }
});

// POST /post-actions/not-relevant — Marquer un post comme non pertinent pour l'utilisateur
app.post("/make-server-218684af/post-actions/not-relevant", async (c) => {
  try {
    const { userId, postId } = await c.req.json();
    if (!userId || !postId) return c.json({ error: "userId et postId requis." }, 400);
    await kv.set(`ff:post-feedback:${userId}:${postId}`, "not_relevant");
    const nrKey = `ff:post-notrelevant:${postId}`;
    const nr = parseInt((await kv.get(nrKey)) || "0") + 1;
    await kv.set(nrKey, String(nr));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec non-pertinent: ${err}` }, 500);
  }
});

app.delete("/make-server-218684af/posts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const raw = await kv.get(`ff:post:${id}`);
    if (!raw) return c.json({ error: "Post introuvable." }, 404);
    const post = JSON.parse(raw);
    await kv.del(`ff:post:${id}`);
    const allIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");
    await kv.set("ff:posts:all", JSON.stringify(allIds.filter((i) => i !== id)));
    const userIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${post.username}`)) || "[]");
    await kv.set(`ff:posts:user:${post.username}`, JSON.stringify(userIds.filter((i) => i !== id)));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec suppression post: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// COMMENTAIRES
// ═══════════════════════════════════════════════════════════��════════════════

// POST /comments — Créer un commentaire
app.post("/make-server-218684af/comments", async (c) => {
  try {
    const body = await c.req.json();
    const { postId, userId, content, commentType, author, avatar } = body;

    if (!postId)   return c.json({ error: "postId requis." }, 400);
    if (!content?.trim()) return c.json({ error: "Contenu requis." }, 400);
    if (!userId)   return c.json({ error: "userId requis." }, 400);

    const id = genId();
    const createdAt = new Date().toISOString();

    const comment = {
      id,
      postId,
      userId,
      author: author || userId,
      avatar: avatar || "",
      content: content.trim(),
      commentType: commentType || null, // "Conseil" | "Encouragement" | "Réaction" | "Motivant" | "Je soutiens" | "J'adore" | "Pertinent"
      reactionCounts: { "Pertinent": 0, "Motivant": 0, "J'adore": 0, "Je soutiens": 0 },
      repliesCount: 0,
      createdAt,
    };

    await kv.set(`ff:comment:${id}`, JSON.stringify(comment));

    // Index par post
    const postCommentIds: string[] = JSON.parse((await kv.get(`ff:comments:post:${postId}`)) || "[]");
    postCommentIds.unshift(id);
    await kv.set(`ff:comments:post:${postId}`, JSON.stringify(postCommentIds));

    // Index par user
    const userCommentIds: string[] = JSON.parse((await kv.get(`ff:comments:user:${userId}`)) || "[]");
    userCommentIds.unshift(id);
    await kv.set(`ff:comments:user:${userId}`, JSON.stringify(userCommentIds));

    // Incrémenter commentsCount du post (supporte ff:post ET ff:comm-post)
    const postRaw = await kv.get(`ff:post:${postId}`);
    if (postRaw) {
      const post = JSON.parse(postRaw);
      post.commentsCount = (post.commentsCount || 0) + 1;
      await kv.set(`ff:post:${postId}`, JSON.stringify(post));
    } else {
      // Essayer le format community-post
      const commPostRaw = await kv.get(`ff:comm-post:${postId}`);
      if (commPostRaw) {
        const commPost = JSON.parse(commPostRaw);
        commPost.repliesCount = (commPost.repliesCount || 0) + 1;
        await kv.set(`ff:comm-post:${postId}`, JSON.stringify(commPost));
        console.log(`repliesCount incrémenté pour comm-post:${postId}`);
      }
    }

    // ── Mettre à jour analytics.commentsCount + historique journalier ──
    const analyticsRaw = await kv.get(`ff:analytics:${postId}`);
    const analytics = analyticsRaw
      ? JSON.parse(analyticsRaw)
      : { postId, viewsCount: 0, reactionsCount: 0, commentsCount: 0, history: [] };
    analytics.commentsCount = (analytics.commentsCount || 0) + 1;
    const today = new Date().toISOString().slice(0, 10);
    if (!analytics.history) analytics.history = [];
    const todayEntry = analytics.history.find(
      (h: { date: string; views: number; reactions: number; comments: number }) => h.date === today
    );
    if (todayEntry) { todayEntry.comments = (todayEntry.comments || 0) + 1; }
    else { analytics.history.push({ date: today, views: 0, reactions: 0, comments: 1 }); }
    if (analytics.history.length > 7) analytics.history = analytics.history.slice(-7);
    await kv.set(`ff:analytics:${postId}`, JSON.stringify(analytics));

    // Progression
    await logActivity(userId, "comment", { postId });
    await addProgressScore(userId, 2);
    const cmtCnt = parseInt((await kv.get(`ff:comment-count:${userId}`)) || "0") + 1;
    await kv.set(`ff:comment-count:${userId}`, String(cmtCnt));
    await checkAndAwardFcoins(userId);

    // Loguer received_comment pour l'auteur du post (anneau rouge auteur)
    try {
      const postForAuthor = await kv.get(`ff:post:${postId}`);
      if (postForAuthor) {
        const postObj = JSON.parse(postForAuthor);
        const authorUsername = postObj.username;
        if (authorUsername && authorUsername !== userId) {
          await logActivity(authorUsername, "received_comment", { postId, commentId: id });
          // Notification commentaire
          await createSocialNotif({ userId: authorUsername, type: "comment", senderId: userId, postId, commentId: id });
        }
      }
    } catch (e) { console.log("received_comment log error:", e); }

    console.log(`Commentaire créé: id=${id}, post=${postId}, user=${userId}, type=${commentType}`);
    return c.json({ success: true, comment });
  } catch (err) {
    console.log("Erreur création commentaire:", err);
    return c.json({ error: `Échec création commentaire: ${err}` }, 500);
  }
});

// GET /comments/post/:postId — Commentaires d'un post
app.get("/make-server-218684af/comments/post/:postId", async (c) => {
  try {
    const postId = c.req.param("postId");
    const limit = parseInt(c.req.query("limit") || "100", 10);
    const requestingUser = c.req.query("userId") || "";

    const commentIds: string[] = JSON.parse((await kv.get(`ff:comments:post:${postId}`)) || "[]");
    const comments = [];

    for (const id of commentIds.slice(0, limit)) {
      const raw = await kv.get(`ff:comment:${id}`);
      if (!raw) continue;
      const comment = JSON.parse(raw);
      if (comment.createdAt) comment.timestamp = relativeTime(comment.createdAt);

      // Réaction de l'utilisateur courant
      if (requestingUser) {
        const reactionRaw = await kv.get(`ff:reaction:${id}:${requestingUser}`);
        comment.myReaction = reactionRaw ? JSON.parse(reactionRaw).reactionType : null;
      } else {
        comment.myReaction = null;
      }

      comments.push(comment);
    }

    // Tri: Conseil en premier (par reactions.Pertinent desc), puis reste
    const conseil = comments.filter((c) => c.commentType === "Conseil")
      .sort((a, b) => (b.reactionCounts?.Pertinent || 0) - (a.reactionCounts?.Pertinent || 0));
    const others = comments.filter((c) => c.commentType !== "Conseil")
      .sort((a, b) => (b.reactionCounts?.Pertinent || 0) - (a.reactionCounts?.Pertinent || 0));

    console.log(`GET comments/post/${postId} — ${comments.length} commentaires`);
    return c.json({ comments: [...conseil, ...others], total: commentIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération commentaires: ${err}` }, 500);
  }
});

// GET /comments/user/:userId — Commentaires d'un utilisateur
app.get("/make-server-218684af/comments/user/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const commentIds: string[] = JSON.parse((await kv.get(`ff:comments:user:${userId}`)) || "[]");
    const comments = [];
    for (const id of commentIds.slice(0, limit)) {
      const raw = await kv.get(`ff:comment:${id}`);
      if (raw) {
        const comment = JSON.parse(raw);
        if (comment.createdAt) comment.timestamp = relativeTime(comment.createdAt);
        comments.push(comment);
      }
    }
    return c.json({ comments, total: commentIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération commentaires user: ${err}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// RÉPONSES AUX COMMENTAIRES
// ═══════════════════════════════════════════════════════════════════════════

// POST /comments/:commentId/replies
app.post("/make-server-218684af/comments/:commentId/replies", async (c) => {
  try {
    const commentId = c.req.param("commentId");
    const body = await c.req.json();
    const { userId, content, author, avatar } = body;

    if (!content?.trim()) return c.json({ error: "Contenu requis." }, 400);
    if (!userId)          return c.json({ error: "userId requis." }, 400);

    // V��rifier que le commentaire parent existe
    const parentRaw = await kv.get(`ff:comment:${commentId}`);
    if (!parentRaw) return c.json({ error: "Commentaire introuvable." }, 404);

    const id = genId();
    const createdAt = new Date().toISOString();

    const reply = {
      id,
      commentId,
      userId,
      author: author || userId,
      avatar: avatar || "",
      content: content.trim(),
      createdAt,
    };

    await kv.set(`ff:reply:${id}`, JSON.stringify(reply));

    // Index des réponses par commentaire
    const replyIds: string[] = JSON.parse((await kv.get(`ff:replies:comment:${commentId}`)) || "[]");
    replyIds.push(id); // chronologique
    await kv.set(`ff:replies:comment:${commentId}`, JSON.stringify(replyIds));

    // Incrémenter repliesCount du commentaire parent
    const parent = JSON.parse(parentRaw);
    parent.repliesCount = (parent.repliesCount || 0) + 1;
    await kv.set(`ff:comment:${commentId}`, JSON.stringify(parent));

    // Loguer la réponse (anneau rouge)
    await logActivity(userId, "reply", { commentId });

    console.log(`Réponse créée: id=${id}, comment=${commentId}, user=${userId}`);
    return c.json({ success: true, reply });
  } catch (err) {
    console.log("Erreur création réponse:", err);
    return c.json({ error: `Échec création réponse: ${err}` }, 500);
  }
});

// GET /comments/:commentId/replies
app.get("/make-server-218684af/comments/:commentId/replies", async (c) => {
  try {
    const commentId = c.req.param("commentId");
    const replyIds: string[] = JSON.parse((await kv.get(`ff:replies:comment:${commentId}`)) || "[]");
    const replies = [];
    for (const id of replyIds) {
      const raw = await kv.get(`ff:reply:${id}`);
      if (raw) {
        const reply = JSON.parse(raw);
        if (reply.createdAt) reply.timestamp = relativeTime(reply.createdAt);
        replies.push(reply);
      }
    }
    return c.json({ replies, total: replies.length });
  } catch (err) {
    return c.json({ error: `Échec récupération réponses: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RÉACTIONS AUX COMMENTAIRES
// ════════════════════════════════════════════════════════════════════════════

// POST /comments/:commentId/reactions — Ajouter ou modifier une réaction (toggle si identique)
app.post("/make-server-218684af/comments/:commentId/reactions", async (c) => {
  try {
    const commentId = c.req.param("commentId");
    const body = await c.req.json();
    const { userId, reactionType } = body;

    if (!userId)       return c.json({ error: "userId requis." }, 400);
    if (!reactionType) return c.json({ error: "reactionType requis." }, 400);

    const VALID_REACTIONS = ["Pertinent", "Motivant", "J'adore", "Je soutiens"];
    if (!VALID_REACTIONS.includes(reactionType)) {
      return c.json({ error: `reactionType invalide. Valeurs: ${VALID_REACTIONS.join(", ")}` }, 400);
    }

    const commentRaw = await kv.get(`ff:comment:${commentId}`);
    if (!commentRaw) return c.json({ error: "Commentaire introuvable." }, 404);
    const comment = JSON.parse(commentRaw);
    if (!comment.reactionCounts) {
      comment.reactionCounts = { "Pertinent": 0, "Motivant": 0, "J'adore": 0, "Je soutiens": 0 };
    }

    const reactionKey = `ff:reaction:${commentId}:${userId}`;
    const existingRaw = await kv.get(reactionKey);

    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      const oldType: string = existing.reactionType;

      if (oldType === reactionType) {
        // ── Toggle OFF : même réaction → on retire ──
        comment.reactionCounts[oldType] = Math.max(0, (comment.reactionCounts[oldType] || 0) - 1);
        await kv.del(reactionKey);
        await kv.set(`ff:comment:${commentId}`, JSON.stringify(comment));
        console.log(`Réaction retirée: comment=${commentId}, user=${userId}, type=${oldType}`);
        return c.json({ success: true, removed: true, myReaction: null, reactionCounts: comment.reactionCounts });
      }

      // ── Changer de réaction ──
      comment.reactionCounts[oldType] = Math.max(0, (comment.reactionCounts[oldType] || 0) - 1);
      comment.reactionCounts[reactionType] = (comment.reactionCounts[reactionType] || 0) + 1;
      existing.reactionType = reactionType;
      existing.updatedAt = new Date().toISOString();
      await kv.set(reactionKey, JSON.stringify(existing));
    } else {
      // ── Nouvelle réaction ──
      const reaction = { id: genId(), commentId, userId, reactionType, createdAt: new Date().toISOString() };
      await kv.set(reactionKey, JSON.stringify(reaction));
      comment.reactionCounts[reactionType] = (comment.reactionCounts[reactionType] || 0) + 1;

      // Index réactions du commentaire
      const reactionUserIds: string[] = JSON.parse((await kv.get(`ff:reactions:comment:${commentId}`)) || "[]");
      if (!reactionUserIds.includes(userId)) {
        reactionUserIds.push(userId);
        await kv.set(`ff:reactions:comment:${commentId}`, JSON.stringify(reactionUserIds));
      }
    }

    await kv.set(`ff:comment:${commentId}`, JSON.stringify(comment));
    console.log(`Réaction: comment=${commentId}, user=${userId}, type=${reactionType}`);
    return c.json({ success: true, removed: false, myReaction: reactionType, reactionCounts: comment.reactionCounts });
  } catch (err) {
    console.log("Erreur réaction:", err);
    return c.json({ error: `Échec réaction: ${err}` }, 500);
  }
});

// DELETE /comments/:commentId/reactions/:userId — Retirer sa réaction
app.delete("/make-server-218684af/comments/:commentId/reactions/:userId", async (c) => {
  try {
    const { commentId, userId } = c.req.param();
    const reactionKey = `ff:reaction:${commentId}:${userId}`;
    const existingRaw = await kv.get(reactionKey);
    if (!existingRaw) return c.json({ error: "Réaction introuvable." }, 404);
    const existing = JSON.parse(existingRaw);

    const commentRaw = await kv.get(`ff:comment:${commentId}`);
    if (commentRaw) {
      const comment = JSON.parse(commentRaw);
      const oldType = existing.reactionType;
      comment.reactionCounts[oldType] = Math.max(0, (comment.reactionCounts[oldType] || 0) - 1);
      await kv.set(`ff:comment:${commentId}`, JSON.stringify(comment));
    }

    await kv.del(reactionKey);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec suppression réaction: ${err}` }, 500);
  }
});

// GET /comments/:commentId/reactions — Réactions d'un commentaire
app.get("/make-server-218684af/comments/:commentId/reactions", async (c) => {
  try {
    const commentId = c.req.param("commentId");
    const commentRaw = await kv.get(`ff:comment:${commentId}`);
    if (!commentRaw) return c.json({ error: "Commentaire introuvable." }, 404);
    const comment = JSON.parse(commentRaw);
    return c.json({ reactionCounts: comment.reactionCounts || {} });
  } catch (err) {
    return c.json({ error: `Échec récupération réactions: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RÉACTIONS AUX POSTS (une seule par utilisateur, remplaçable)
// ════════════════════════════════════════════════════════════════════════════

// GET /posts/:postId/reactions?userId=xxx — Compteurs + réaction de l'utilisateur
app.get("/make-server-218684af/posts/:postId/reactions", async (c) => {
  try {
    const postId = c.req.param("postId");
    const userId = c.req.query("userId") || "";

    const countsRaw = await kv.get(`ff:post-reactions:counts:${postId}`);
    const counts: Record<string, number> = countsRaw ? JSON.parse(countsRaw) : {};

    let myReaction: string | null = null;
    if (userId) {
      const myRaw = await kv.get(`ff:post-reaction:${postId}:${userId}`);
      if (myRaw) myReaction = JSON.parse(myRaw).reactionType;
    }

    const total = Object.values(counts).reduce((s: number, v) => s + (v as number), 0);
    return c.json({ counts, myReaction, total });
  } catch (err) {
    return c.json({ error: `Échec récupération réactions post: ${err}` }, 500);
  }
});

// POST /posts/:postId/reactions — Ajouter ou remplacer sa réaction (toggle si identique)
app.post("/make-server-218684af/posts/:postId/reactions", async (c) => {
  try {
    const postId = c.req.param("postId");
    const body = await c.req.json();
    const { userId, reactionType } = body;

    if (!userId)       return c.json({ error: "userId requis." }, 400);
    if (!reactionType) return c.json({ error: "reactionType requis." }, 400);

    const VALID = ["Pertinent", "Motivant", "Je soutiens", "J'adore"];
    if (!VALID.includes(reactionType)) {
      return c.json({ error: `reactionType invalide. Valeurs: ${VALID.join(", ")}` }, 400);
    }

    const reactionKey = `ff:post-reaction:${postId}:${userId}`;
    const countsKey   = `ff:post-reactions:counts:${postId}`;
    const countsRaw   = await kv.get(countsKey);
    const counts: Record<string, number> = countsRaw ? JSON.parse(countsRaw) : {};
    const existingRaw = await kv.get(reactionKey);
    let delta = 0;

    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      const oldType: string = existing.reactionType;
      if (oldType === reactionType) {
        // Toggle off
        counts[oldType] = Math.max(0, (counts[oldType] || 0) - 1);
        await kv.del(reactionKey);
        delta = -1;
        await kv.set(countsKey, JSON.stringify(counts));
        // Analytics
        const ar = await kv.get(`ff:analytics:${postId}`);
        if (ar) {
          const a = JSON.parse(ar);
          a.reactionsCount = Math.max(0, (a.reactionsCount || 0) - 1);
          await kv.set(`ff:analytics:${postId}`, JSON.stringify(a));
        }
        const total = Object.values(counts).reduce((s: number, v) => s + (v as number), 0);
        return c.json({ success: true, removed: true, counts, myReaction: null, total });
      }
      // Changer de réaction
      counts[oldType] = Math.max(0, (counts[oldType] || 0) - 1);
      counts[reactionType] = (counts[reactionType] || 0) + 1;
      existing.reactionType = reactionType;
      existing.updatedAt = new Date().toISOString();
      await kv.set(reactionKey, JSON.stringify(existing));
      delta = 0;
    } else {
      // Nouvelle
      await kv.set(reactionKey, JSON.stringify({ id: genId(), postId, userId, reactionType, createdAt: new Date().toISOString() }));
      counts[reactionType] = (counts[reactionType] || 0) + 1;
      delta = 1;
    }

    await kv.set(countsKey, JSON.stringify(counts));

    // Analytics
    const ar = await kv.get(`ff:analytics:${postId}`);
    const analytics = ar ? JSON.parse(ar) : { postId, viewsCount: 0, reactionsCount: 0, commentsCount: 0, history: [] };
    analytics.reactionsCount = Math.max(0, (analytics.reactionsCount || 0) + delta);
    if (delta !== 0) {
      const today = new Date().toISOString().slice(0, 10);
      if (!analytics.history) analytics.history = [];
      const te = analytics.history.find((h: { date: string; reactions: number }) => h.date === today);
      if (te) { te.reactions = Math.max(0, (te.reactions || 0) + delta); }
      else if (delta > 0) { analytics.history.push({ date: today, views: 0, reactions: delta, comments: 0 }); }
      if (analytics.history.length > 7) analytics.history = analytics.history.slice(-7);
    }
    await kv.set(`ff:analytics:${postId}`, JSON.stringify(analytics));

    // Post relevantCount + logActivity réaction
    const pr = await kv.get(`ff:post:${postId}`);
    if (pr) {
      const p = JSON.parse(pr);
      p.relevantCount = Object.values(counts).reduce((s: number, v) => s + (v as number), 0);
      await kv.set(`ff:post:${postId}`, JSON.stringify(p));
      // Loguer la réaction donnée (anneau rouge)
      if (delta === 1) {
        await logActivity(userId, "reaction", { postId, reactionType });
        // Loguer la réaction reçue pour l'auteur du post (anneau rouge auteur)
        const authorUsername = p.username;
        if (authorUsername && authorUsername !== userId) {
          await logActivity(authorUsername, "received_reaction", { postId });
          // Notification like
          await createSocialNotif({ userId: authorUsername, type: "like", senderId: userId, postId });
        }
      }
    }

    const total = Object.values(counts).reduce((s: number, v) => s + (v as number), 0);
    console.log(`Réaction post: post=${postId}, user=${userId}, type=${reactionType}, total=${total}`);
    return c.json({ success: true, removed: false, counts, myReaction: reactionType, total });
  } catch (err) {
    console.log("Erreur réaction post:", err);
    return c.json({ error: `Échec réaction post: ${err}` }, 500);
  }
});

// DELETE /posts/:postId/reactions/:userId — Retirer sa réaction
app.delete("/make-server-218684af/posts/:postId/reactions/:userId", async (c) => {
  try {
    const { postId, userId } = c.req.param();
    const reactionKey = `ff:post-reaction:${postId}:${userId}`;
    const countsKey   = `ff:post-reactions:counts:${postId}`;
    const existingRaw = await kv.get(reactionKey);
    if (!existingRaw) return c.json({ error: "Réaction introuvable." }, 404);
    const existing = JSON.parse(existingRaw);
    const countsRaw = await kv.get(countsKey);
    const counts: Record<string, number> = countsRaw ? JSON.parse(countsRaw) : {};
    counts[existing.reactionType] = Math.max(0, (counts[existing.reactionType] || 0) - 1);
    await kv.set(countsKey, JSON.stringify(counts));
    await kv.del(reactionKey);
    const ar = await kv.get(`ff:analytics:${postId}`);
    if (ar) {
      const a = JSON.parse(ar); a.reactionsCount = Math.max(0, (a.reactionsCount || 0) - 1);
      await kv.set(`ff:analytics:${postId}`, JSON.stringify(a));
    }
    const total = Object.values(counts).reduce((s: number, v) => s + (v as number), 0);
    return c.json({ success: true, counts, myReaction: null, total });
  } catch (err) {
    return c.json({ error: `Échec suppression réaction post: ${err}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS — Vues, réactions, commentaires par post
// ═════════════════════════════════════════════════════════════��═════════════

// GET /posts/:postId/analytics
app.get("/make-server-218684af/posts/:postId/analytics", async (c) => {
  try {
    const postId = c.req.param("postId");
    const raw = await kv.get(`ff:analytics:${postId}`);
    const defaults = { postId, viewsCount: 0, reactionsCount: 0, commentsCount: 0, history: [] };
    const analytics = raw ? JSON.parse(raw) : defaults;
    return c.json({ analytics });
  } catch (err) {
    return c.json({ error: `Échec récupération analytics: ${err}` }, 500);
  }
});

// POST /posts/:postId/view — Incrémenter les vues (idempotent par session)
app.post("/make-server-218684af/posts/:postId/view", async (c) => {
  try {
    const postId = c.req.param("postId");
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.sessionId || "anonymous";

    // Anti-double-count : une vue par sessionId par post
    const viewKey = `ff:view:${postId}:${sessionId}`;
    const alreadyViewed = await kv.get(viewKey);
    if (alreadyViewed) {
      const raw = await kv.get(`ff:analytics:${postId}`);
      const analytics = raw ? JSON.parse(raw) : { postId, viewsCount: 0, reactionsCount: 0, commentsCount: 0, history: [] };
      return c.json({ success: true, alreadyCounted: true, analytics });
    }
    await kv.set(viewKey, "1");

    // Mettre à jour analytics
    const raw = await kv.get(`ff:analytics:${postId}`);
    const analytics = raw ? JSON.parse(raw) : { postId, viewsCount: 0, reactionsCount: 0, commentsCount: 0, history: [] };
    analytics.viewsCount = (analytics.viewsCount || 0) + 1;

    // Historique journalier (7 derniers jours)
    const today = new Date().toISOString().slice(0, 10);
    if (!analytics.history) analytics.history = [];
    const todayEntry = analytics.history.find((h: { date: string; views: number; reactions: number; comments: number }) => h.date === today);
    if (todayEntry) { todayEntry.views = (todayEntry.views || 0) + 1; }
    else { analytics.history.push({ date: today, views: 1, reactions: 0, comments: 0 }); }
    if (analytics.history.length > 7) analytics.history = analytics.history.slice(-7);

    await kv.set(`ff:analytics:${postId}`, JSON.stringify(analytics));

    // Aussi mettre à jour viewsCount dans le post
    const postRaw = await kv.get(`ff:post:${postId}`);
    if (postRaw) {
      const post = JSON.parse(postRaw);
      post.viewsCount = analytics.viewsCount;
      await kv.set(`ff:post:${postId}`, JSON.stringify(post));
    }

    console.log(`Vue enregistrée: post=${postId}, session=${sessionId}, total=${analytics.viewsCount}`);
    return c.json({ success: true, alreadyCounted: false, analytics });
  } catch (err) {
    console.log("Erreur incrémentation vue:", err);
    return c.json({ error: `Échec vue: ${err}` }, 500);
  }
});

// POST /posts/:postId/reaction — Incrémenter réactions dans analytics
app.post("/make-server-218684af/posts/:postId/reaction", async (c) => {
  try {
    const postId = c.req.param("postId");
    const body = await c.req.json().catch(() => ({}));
    const delta: number = body.delta ?? 1; // +1 ou -1

    const raw = await kv.get(`ff:analytics:${postId}`);
    const analytics = raw ? JSON.parse(raw) : { postId, viewsCount: 0, reactionsCount: 0, commentsCount: 0, history: [] };
    analytics.reactionsCount = Math.max(0, (analytics.reactionsCount || 0) + delta);

    const today = new Date().toISOString().slice(0, 10);
    if (!analytics.history) analytics.history = [];
    const todayEntry = analytics.history.find((h: { date: string; views: number; reactions: number; comments: number }) => h.date === today);
    if (todayEntry) { todayEntry.reactions = Math.max(0, (todayEntry.reactions || 0) + delta); }
    else if (delta > 0) { analytics.history.push({ date: today, views: 0, reactions: delta, comments: 0 }); }
    if (analytics.history.length > 7) analytics.history = analytics.history.slice(-7);

    await kv.set(`ff:analytics:${postId}`, JSON.stringify(analytics));
    return c.json({ success: true, analytics });
  } catch (err) {
    return c.json({ error: `Échec réaction analytics: ${err}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════��══════
// PARTAGES DANS UNE COMMUNAUTÉ
// ════════════════════════════════════════���═════��═════════════════════════════

// POST /shares — Partager un post dans une communauté
app.post("/make-server-218684af/shares", async (c) => {
  try {
    const body = await c.req.json();
    const { originalPostId, userId, communityId, communityName, message, postSnapshot, author, avatar } = body;

    if (!originalPostId) return c.json({ error: "originalPostId requis." }, 400);
    if (!userId)         return c.json({ error: "userId requis." }, 400);
    if (!communityId)    return c.json({ error: "communityId requis." }, 400);

    const id = genId();
    const createdAt = new Date().toISOString();

    const share = {
      id,
      originalPostId,
      userId,
      author: author || userId,
      avatar: avatar || "",
      communityId,
      communityName: communityName || communityId,
      message: message?.trim() || "",
      postSnapshot: postSnapshot || null, // copie légère du post original pour affichage
      createdAt,
    };

    await kv.set(`ff:share:${id}`, JSON.stringify(share));

    // Index par communauté (chronologique inversé)
    const communityShareIds: string[] = JSON.parse((await kv.get(`ff:shares:community:${communityId}`)) || "[]");
    communityShareIds.unshift(id);
    if (communityShareIds.length > 200) communityShareIds.splice(200);
    await kv.set(`ff:shares:community:${communityId}`, JSON.stringify(communityShareIds));

    // Index par post original
    const postShareIds: string[] = JSON.parse((await kv.get(`ff:shares:post:${originalPostId}`)) || "[]");
    postShareIds.unshift(id);
    await kv.set(`ff:shares:post:${originalPostId}`, JSON.stringify(postShareIds));

    // Incrémenter sharesCount du post
    const postRaw = await kv.get(`ff:post:${originalPostId}`);
    if (postRaw) {
      const post = JSON.parse(postRaw);
      post.sharesCount = (post.sharesCount || 0) + 1;
      await kv.set(`ff:post:${originalPostId}`, JSON.stringify(post));
    }

    // Analytics
    const analyticsRaw = await kv.get(`ff:analytics:${originalPostId}`);
    if (analyticsRaw) {
      const analytics = JSON.parse(analyticsRaw);
      analytics.sharesCount = (analytics.sharesCount || 0) + 1;
      await kv.set(`ff:analytics:${originalPostId}`, JSON.stringify(analytics));
    }

    console.log(`Post partagé: id=${id}, post=${originalPostId}, community=${communityId}, user=${userId}`);
    return c.json({ success: true, share });
  } catch (err) {
    console.log("Erreur partage:", err);
    return c.json({ error: `Échec partage: ${err}` }, 500);
  }
});

// GET /shares/community/:communityId — Posts partagés d'une communauté
app.get("/make-server-218684af/shares/community/:communityId", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const limit = parseInt(c.req.query("limit") || "50", 10);

    const shareIds: string[] = JSON.parse((await kv.get(`ff:shares:community:${communityId}`)) || "[]");
    const shares = [];

    for (const id of shareIds.slice(0, limit)) {
      const raw = await kv.get(`ff:share:${id}`);
      if (!raw) continue;
      const share = JSON.parse(raw);
      if (share.createdAt) share.timestamp = relativeTime(share.createdAt);

      // Enrichir avec le post original si possible
      if (share.originalPostId && !share.postSnapshot) {
        const postRaw = await kv.get(`ff:post:${share.originalPostId}`);
        if (postRaw) {
          const post = JSON.parse(postRaw);
          share.postSnapshot = {
            id: post.id,
            user: post.user,
            progress: post.progress,
            hashtags: post.hashtags,
          };
        }
      }
      shares.push(share);
    }

    console.log(`GET shares/community/${communityId} — ${shares.length} partages`);
    return c.json({ shares, total: shareIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération partages: ${err}` }, 500);
  }
});

// ═══════��════════════════════════════════════════════════════════════════════
// POST-RÉPONSES (Ajouter à un nouveau post)
// ════════════════════════════════════════════════════��═══════════════════════

// POST /post-replies — Enregistrer le lien entre original_post_id et new_post_id
app.post("/make-server-218684af/post-replies", async (c) => {
  try {
    const body = await c.req.json();
    const { originalPostId, newPostId } = body;

    if (!originalPostId) return c.json({ error: "originalPostId requis." }, 400);
    if (!newPostId)       return c.json({ error: "newPostId requis." }, 400);

    const id = genId();
    const createdAt = new Date().toISOString();

    const postReply = { id, originalPostId, newPostId, createdAt };
    await kv.set(`ff:post-reply:${id}`, JSON.stringify(postReply));

    // Index par post original
    const replyIds: string[] = JSON.parse((await kv.get(`ff:post-replies:original:${originalPostId}`)) || "[]");
    replyIds.unshift(newPostId);
    await kv.set(`ff:post-replies:original:${originalPostId}`, JSON.stringify(replyIds));

    // Marquer le nouveau post comme étant une réponse
    const newPostRaw = await kv.get(`ff:post:${newPostId}`);
    if (newPostRaw) {
      const newPost = JSON.parse(newPostRaw);
      newPost.originalPostId = originalPostId;
      await kv.set(`ff:post:${newPostId}`, JSON.stringify(newPost));
    }

    console.log(`Post-réponse créé: original=${originalPostId}, new=${newPostId}`);
    return c.json({ success: true, postReply });
  } catch (err) {
    console.log("Erreur post-réponse:", err);
    return c.json({ error: `Échec post-réponse: ${err}` }, 500);
  }
});

// GET /post-replies/:originalPostId — Réponses d'un post
app.get("/make-server-218684af/post-replies/:originalPostId", async (c) => {
  try {
    const originalPostId = c.req.param("originalPostId");
    const replyPostIds: string[] = JSON.parse((await kv.get(`ff:post-replies:original:${originalPostId}`)) || "[]");
    const posts = [];
    for (const id of replyPostIds) {
      const raw = await kv.get(`ff:post:${id}`);
      if (raw) {
        const post = JSON.parse(raw);
        if (post.createdAt) post.progress.timestamp = relativeTime(post.createdAt);
        posts.push(post);
      }
    }
    return c.json({ posts, total: posts.length });
  } catch (err) {
    return c.json({ error: `Échec récupération post-réponses: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FOLLOWS (Abonnements — suivre / se désabonner)
// ═══════════════════════════════════════════════════════════════��════════════

// POST /follows — Suivre un utilisateur (toggle : suit si absent, se désabonne si présent)
app.post("/make-server-218684af/follows", async (c) => {
  try {
    const body = await c.req.json();
    const { followerId, followingId } = body;
    if (!followerId)   return c.json({ error: "followerId requis." }, 400);
    if (!followingId)  return c.json({ error: "followingId requis." }, 400);
    if (followerId === followingId) return c.json({ error: "Impossible de se suivre soi-même." }, 400);

    const followKey = `ff:follow:${followerId}:${followingId}`;
    const existing  = await kv.get(followKey);

    // Index listes
    const followingList: string[] = JSON.parse((await kv.get(`ff:following:${followerId}`)) || "[]");
    const followersList: string[] = JSON.parse((await kv.get(`ff:followers:${followingId}`)) || "[]");

    if (existing) {
      // ── Toggle OFF : se désabonner ──
      await kv.del(followKey);
      const newFollowing = followingList.filter((id) => id !== followingId);
      const newFollowers = followersList.filter((id) => id !== followerId);
      await kv.set(`ff:following:${followerId}`, JSON.stringify(newFollowing));
      await kv.set(`ff:followers:${followingId}`, JSON.stringify(newFollowers));
      console.log(`Désabonnement: ${followerId} → ${followingId}`);
      return c.json({ success: true, following: false, followingCount: newFollowing.length });
    }

    // ── Nouveau suivi ──
    const follow = { id: genId(), followerId, followingId, createdAt: new Date().toISOString() };
    await kv.set(followKey, JSON.stringify(follow));
    if (!followingList.includes(followingId)) followingList.push(followingId);
    if (!followersList.includes(followerId))  followersList.push(followerId);
    await kv.set(`ff:following:${followerId}`, JSON.stringify(followingList));
    await kv.set(`ff:followers:${followingId}`, JSON.stringify(followersList));

    // Notification abonnement
    await createSocialNotif({ userId: followingId, type: "follow", senderId: followerId });

    console.log(`Abonnement: ${followerId} → ${followingId}`);
    return c.json({ success: true, following: true, followingCount: followingList.length });
  } catch (err) {
    console.log("Erreur follow:", err);
    return c.json({ error: `Échec follow: ${err}` }, 500);
  }
});

// GET /follows/:userId/status?targetId=xxx — Est-ce que userId suit targetId ?
app.get("/make-server-218684af/follows/:userId/status", async (c) => {
  try {
    const userId   = c.req.param("userId");
    const targetId = c.req.query("targetId");
    if (!targetId) return c.json({ error: "targetId requis." }, 400);
    const followKey = `ff:follow:${userId}:${targetId}`;
    const existing  = await kv.get(followKey);
    return c.json({ following: !!existing });
  } catch (err) {
    return c.json({ error: `Échec status follow: ${err}` }, 500);
  }
});

// GET /follows/:userId/following — Liste des utilisateurs que userId suit
app.get("/make-server-218684af/follows/:userId/following", async (c) => {
  try {
    const userId     = c.req.param("userId");
    const followingIds: string[] = JSON.parse((await kv.get(`ff:following:${userId}`)) || "[]");
    console.log(`GET following/${userId} — ${followingIds.length} abonnements`);
    return c.json({ following: followingIds, total: followingIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération following: ${err}` }, 500);
  }
});

// GET /follows/:userId/followers — Liste des utilisateurs qui suivent userId
app.get("/make-server-218684af/follows/:userId/followers", async (c) => {
  try {
    const userId      = c.req.param("userId");
    const followerIds: string[] = JSON.parse((await kv.get(`ff:followers:${userId}`)) || "[]");
    console.log(`GET followers/${userId} — ${followerIds.length} abonnés`);
    return c.json({ followers: followerIds, total: followerIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération followers: ${err}` }, 500);
  }
});

// GET /follows/:userId/following-profiles — Profils enrichis des utilisateurs suivis
app.get("/make-server-218684af/follows/:userId/following-profiles", async (c) => {
  try {
    const userId = c.req.param("userId");
    const followingIds: string[] = JSON.parse((await kv.get(`ff:following:${userId}`)) || "[]");
    const profiles = [];
    for (const username of followingIds) {
      const raw = await kv.get(`ff:profile:${username}`);
      if (!raw) { profiles.push({ username, name: username, avatar: "", objective: "", streak: 0 }); continue; }
      const p = JSON.parse(raw);
      profiles.push({ username: p.username || username, name: p.name || username, avatar: p.avatar || "", objective: p.objective || "", streak: p.streak || 0 });
    }
    return c.json({ profiles, total: profiles.length });
  } catch (err) {
    return c.json({ error: `Échec following-profiles: ${err}` }, 500);
  }
});

// GET /follows/:userId/follower-profiles — Profils enrichis des abonnés
app.get("/make-server-218684af/follows/:userId/follower-profiles", async (c) => {
  try {
    const userId = c.req.param("userId");
    const followerIds: string[] = JSON.parse((await kv.get(`ff:followers:${userId}`)) || "[]");
    const profiles = [];
    for (const username of followerIds) {
      const raw = await kv.get(`ff:profile:${username}`);
      if (!raw) { profiles.push({ username, name: username, avatar: "", objective: "", streak: 0 }); continue; }
      const p = JSON.parse(raw);
      profiles.push({ username: p.username || username, name: p.name || username, avatar: p.avatar || "", objective: p.objective || "", streak: p.streak || 0 });
    }
    return c.json({ profiles, total: profiles.length });
  } catch (err) {
    return c.json({ error: `Échec follower-profiles: ${err}` }, 500);
  }
});

// GET /follows/:userId/feed — Posts des utilisateurs suivis par userId
app.get("/make-server-218684af/follows/:userId/feed", async (c) => {
  try {
    const userId  = c.req.param("userId");
    const limit   = parseInt(c.req.query("limit") || "50", 10);

    const followingIds: string[] = JSON.parse((await kv.get(`ff:following:${userId}`)) || "[]");
    if (followingIds.length === 0) {
      return c.json({ posts: [], total: 0, following: [] });
    }

    // Charger les préférences "réduire auteur" et "non pertinent" de l'utilisateur
    const reducedAuthors = new Set<string>();
    for (const username of followingIds) {
      const pref = await kv.get(`ff:user-pref:${userId}:reduce:${username}`);
      if (pref === "1") reducedAuthors.add(username);
    }

    // Collecter les posts de chaque utilisateur suivi
    type FeedPostRaw = { id: string; username: string; createdAt: string; progress: { timestamp?: string }; _reduced?: boolean };
    const allPosts: FeedPostRaw[] = [];
    const reducedCount: Record<string, number> = {};

    for (const username of followingIds) {
      const userPostIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
      const isReduced = reducedAuthors.has(username);

      for (const postId of userPostIds.slice(0, 20)) {
        const raw = await kv.get(`ff:post:${postId}`);
        if (!raw) continue;

        // Sauter les posts marqués non pertinents par cet utilisateur
        const feedback = await kv.get(`ff:post-feedback:${userId}:${postId}`);
        if (feedback === "not_relevant") continue;

        const post = JSON.parse(raw) as FeedPostRaw;
        if (post.createdAt) post.progress.timestamp = relativeTime(post.createdAt);

        // Réduire : garder seulement le post le plus récent d'un auteur réduit
        if (isReduced) {
          reducedCount[username] = (reducedCount[username] || 0) + 1;
          if (reducedCount[username] > 1) continue; // skip les autres
          post._reduced = true;
        }

        allPosts.push(post);
      }
    }

    // Trier : posts normaux d'abord (par date desc), puis posts réduits à la fin
    allPosts.sort((a, b) => {
      if (a._reduced && !b._reduced) return 1;
      if (!a._reduced && b._reduced) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const limited = allPosts.slice(0, limit);
    console.log(`Feed abonnements: user=${userId}, ${followingIds.length} suivis, ${limited.length} posts (${reducedAuthors.size} auteurs réduits)`);
    return c.json({ posts: limited, total: allPosts.length, following: followingIds });
  } catch (err) {
    return c.json({ error: `Échec feed abonnements: ${err}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════���════════════════
// MESSAGES DE COMMUNAUTÉ (Discussion persistante)
// ════════════════════════════════════════════════════════════════════════════

// POST /community/:communityId/messages — Envoyer un message dans une communauté
app.post("/make-server-218684af/community/:communityId/messages", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const body = await c.req.json();
    const { userId, author, handle, avatar, content, parentId, image, sharedPostId, sharedPostSnapshot } = body;

    if (!content?.trim() && !sharedPostId) return c.json({ error: "Contenu ou post partagé requis." }, 400);
    if (!userId) return c.json({ error: "userId requis." }, 400);

    const id = genId();
    const createdAt = new Date().toISOString();

    const message = {
      id,
      communityId,
      parentId: parentId || null,
      userId,
      author: author || userId,
      handle: handle || ("@" + userId),
      avatar: avatar || "",
      content: content?.trim() || "",
      image: image || null,
      sharedPostId: sharedPostId || null,
      sharedPostSnapshot: sharedPostSnapshot || null,
      createdAt,
    };

    await kv.set(`ff:cmsg:${id}`, JSON.stringify(message));

    // Index chronologique par communauté
    const msgIds: string[] = JSON.parse((await kv.get(`ff:cmsgs:${communityId}`)) || "[]");
    msgIds.push(id); // chronologique (oldest first)
    if (msgIds.length > 500) msgIds.splice(0, msgIds.length - 500);
    await kv.set(`ff:cmsgs:${communityId}`, JSON.stringify(msgIds));

    // Progression + Fcoins
    await logActivity(userId, "community_message", { communityId });
    await addProgressScore(userId, 2);
    const cnt = parseInt((await kv.get(`ff:msg-count:${userId}`)) || "0") + 1;
    await kv.set(`ff:msg-count:${userId}`, String(cnt));
    await checkAndAwardFcoins(userId);

    console.log(`Message communauté: id=${id}, community=${communityId}, user=${userId}, parent=${parentId || "null"}`);
    return c.json({ success: true, message: { ...message, timestamp: "À l'instant" } });
  } catch (err) {
    console.log("Erreur message communauté:", err);
    return c.json({ error: `Échec message communauté: ${err}` }, 500);
  }
});

// GET /community/:communityId/messages — Récupérer les messages d'une communauté
app.get("/make-server-218684af/community/:communityId/messages", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const limit = parseInt(c.req.query("limit") || "200", 10);

    const msgIds: string[] = JSON.parse((await kv.get(`ff:cmsgs:${communityId}`)) || "[]");
    const messages = [];

    // Prendre les N derniers (les plus récents)
    const idsToFetch = msgIds.slice(-limit);
    for (const id of idsToFetch) {
      const raw = await kv.get(`ff:cmsg:${id}`);
      if (!raw) continue;
      const msg = JSON.parse(raw);
      msg.timestamp = relativeTime(msg.createdAt);

      // Enrichir avec le post partagé si nécessaire
      if (msg.sharedPostId && !msg.sharedPostSnapshot) {
        const postRaw = await kv.get(`ff:post:${msg.sharedPostId}`);
        if (postRaw) {
          const post = JSON.parse(postRaw);
          msg.sharedPostSnapshot = { id: post.id, user: post.user, progress: post.progress, hashtags: post.hashtags };
        }
      }
      messages.push(msg);
    }

    console.log(`GET community/${communityId}/messages — ${messages.length} messages`);
    return c.json({ messages, total: msgIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération messages: ${err}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════��═══════════════════
// RECHERCHE GLOBALE
// ══════════════════════════════════════════════��═════════════════════════════

// GET /search?q=...&type=all|posts|users|hashtags&username=...&limit=20
app.get("/make-server-218684af/search", async (c) => {
  try {
    const q        = (c.req.query("q") || "").trim().toLowerCase();
    const type     = c.req.query("type") || "all";
    const username = (c.req.query("username") || "").trim().toLowerCase();
    const limit    = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);

    if (!q) return c.json({ posts: [], users: [], hashtags: [] });

    const isHash = q.startsWith("#");
    const isAt   = q.startsWith("@");
    const bare   = isHash ? q.slice(1) : isAt ? q.slice(1) : q;

    // ── Récupérer les IDs des posts ─���───────────���─────────────────────────
    let postIds: string[] = [];
    if (username) {
      postIds = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
    } else {
      postIds = JSON.parse((await kv.get("ff:posts:all")) || "[]");
    }

    const matchedPosts: unknown[] = [];
    const userMap = new Map<string, { name: string; avatar: string; objective: string; username: string; count: number }>();
    const hashtagMap = new Map<string, number>();

    for (const id of postIds.slice(0, 300)) {
      const raw = await kv.get(`ff:post:${id}`);
      if (!raw) continue;
      const post = JSON.parse(raw);
      if (!post?.user?.name) continue;
      if (post.createdAt) post.progress.timestamp = relativeTime(post.createdAt);

      const content    = (post.progress?.description || "").toLowerCase();
      const authorName = (post.user?.name || "").toLowerCase();
      const postUser   = (post.username || "").toLowerCase();
      const tags: string[] = (post.hashtags || []);

      // Indexer les hashtags
      for (const tag of tags) {
        const tagLower = tag.toLowerCase();
        hashtagMap.set(tagLower, (hashtagMap.get(tagLower) || 0) + 1);
      }

      // Déterminer si le post matche
      let match = false;
      if (isHash) {
        match = tags.some((t) => t.toLowerCase().includes(bare));
      } else if (isAt) {
        match = authorName.includes(bare) || postUser.includes(bare);
      } else {
        match =
          content.includes(bare) ||
          authorName.includes(bare) ||
          tags.some((t) => t.toLowerCase().includes(bare));
      }

      if (match) {
        if ((type === "all" || type === "posts") && matchedPosts.length < limit) {
          matchedPosts.push(post);
        }
        // Indexer l'utilisateur
        const uKey = post.username || postUser;
        if (uKey) {
          if (!userMap.has(uKey)) {
            userMap.set(uKey, {
              name: post.user.name,
              avatar: post.user.avatar || "",
              objective: post.user.objective || "",
              username: uKey,
              count: 1,
            });
          } else {
            userMap.get(uKey)!.count++;
          }
        }
      }
    }

    // ── Utilisateurs matchants ─────────────────────────────────���──────────
    const matchedUsers = (type === "all" || type === "users")
      ? Array.from(userMap.values())
          .filter((u) =>
            u.name.toLowerCase().includes(bare) ||
            u.username.toLowerCase().includes(bare)
          )
          .slice(0, limit)
      : [];

    // ── Hashtags matchants ────────────────────────────────────────────────
    const matchedHashtags = (type === "all" || type === "hashtags")
      ? Array.from(hashtagMap.entries())
          .filter(([tag]) => tag.includes(bare))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count }))
      : [];

    console.log(`Recherche: q="${q}", type=${type}, username="${username}" → ${matchedPosts.length} posts, ${matchedUsers.length} users, ${matchedHashtags.length} hashtags`);
    return c.json({
      posts: matchedPosts,
      users: matchedUsers,
      hashtags: matchedHashtags,
      total: matchedPosts.length + matchedUsers.length + matchedHashtags.length,
      query: q,
    });
  } catch (err) {
    console.log("Erreur recherche:", err);
    return c.json({ error: `Échec recherche: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SEED DES POSTS ET PROFILS FICTIFS (idempotent)
// ══════════════════════════════════���═���═══════════════════════════════════════

// POST /seed-fictitious-posts — Insère les posts fictifs dans KV si absents
app.post("/make-server-218684af/seed-fictitious-posts", async (c) => {
  try {
    const body = await c.req.json();
    const { posts = [], profiles = [] } = body;

    let seeded = 0;
    let skipped = 0;

    // ── Posts ─��
    const allIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");

    for (const post of posts) {
      if (!post.id) continue;
      const key = `ff:post:${post.id}`;
      const existing = await kv.get(key);
      if (!existing) {
        const username = post.username || normalizeUsername(post.user?.name || "");
        const storedPost = {
          id: post.id,
          username,
          user: post.user,
          streak: post.streak || 0,
          progress: {
            type: post.progress.type,
            description: post.progress.description,
            timestamp: post.progress.timestamp || "À l'instant",
          },
          hashtags: post.hashtags || [],
          image: post.image || null,
          verified: post.verified || false,
          relevantCount: post.relevantCount || 0,
          commentsCount: post.commentsCount || 0,
          sharesCount: post.sharesCount || 0,
          viewsCount: post.viewsCount || 0,
          isNew: post.isNew || false,
          createdAt: post.createdAt || new Date().toISOString(),
        };

        await kv.set(key, JSON.stringify(storedPost));

        // Index global (append at end to keep newer real posts first)
        if (!allIds.includes(post.id)) allIds.push(post.id);

        // Index par utilisateur
        const userIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
        if (!userIds.includes(post.id)) {
          userIds.push(post.id);
          await kv.set(`ff:posts:user:${username}`, JSON.stringify(userIds));
        }

        seeded++;
      } else {
        skipped++;
      }
    }

    await kv.set("ff:posts:all", JSON.stringify(allIds));

    // ── Profils + Goals ──
    let profilesSeeded = 0;
    for (const p of profiles) {
      if (!p.username) continue;
      const pKey = `ff:profile:${p.username}`;
      const existingProfile = await kv.get(pKey);
      if (!existingProfile) {
        const now = new Date().toISOString();
        const progressPct = p.progressPct || 0;
        await kv.set(pKey, JSON.stringify({
          username: p.username,
          name: p.name || p.username,
          handle: `@${p.username}`,
          avatar: p.avatar || "",
          banner: "",
          bio: p.bio || "",
          objective: p.objective || "",
          objectiveDesc: "",
          descriptor: "",
          hashtags: [],
          streak: p.streak || 0,
          constance: p.streak || 0,
          progressPct,
          objectifsAccomplis: 0,
          daysOnFF: 30,
          onboardingDone: true,
          createdAt: now,
          updatedAt: now,
        }));
        profilesSeeded++;
      }

      // ── Créer ff:goals si absent (idempotent) ──────────────────────────────
      const goalKey = `ff:goals:${p.username}`;
      const existingGoal = await kv.get(goalKey);
      if (!existingGoal && p.objective) {
        const progressPct = p.progressPct || 0;
        const goal = {
          id: `goal-seed-${p.username}`,
          title: p.objective,
          description: p.objectiveDesc || "",
          progress: progressPct,
          status: progressPct >= 100 ? "accompli" : "en_cours",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await kv.set(goalKey, JSON.stringify([goal]));
      }
    }

    console.log(`Seed fictitious: ${seeded} posts, ${skipped} skipped, ${profilesSeeded} profils`);
    return c.json({ success: true, seeded, skipped, profilesSeeded });
  } catch (err) {
    console.log("Erreur seed fictitious:", err);
    return c.json({ error: `Échec seed: ${err}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POSTS COMMUNAUTAIRES (Actus des Tribes)
// ═════════════════════════════════════════════════════════════════════════════

// POST /communities/:id/posts — Créer un post Actus (même format ApiPost que /posts)
app.post("/make-server-218684af/communities/:id/posts", async (c) => {
  try {
    const communityId = c.req.param("id");
    const body = await c.req.json();
    const { user, streak, progress, hashtags, username, image } = body;
    if (!progress?.description?.trim()) return c.json({ error: "Contenu requis." }, 400);
    if (!progress?.type) return c.json({ error: "Type requis." }, 400);
    if (!user?.name) return c.json({ error: "Utilisateur requis." }, 400);

    const postId = genId();
    const createdAt = new Date().toISOString();
    const resolvedUsername = normalizeUsername(username || user.name);

    const post = {
      id: postId, communityId,
      user: { name: user.name, avatar: user.avatar || "", objective: user.objective || "", followers: user.followers || 0 },
      streak: streak || 0,
      progress: { type: progress.type, description: progress.description.trim(), timestamp: "À l'instant" },
      hashtags: hashtags || [], image: image || null,
      verified: false, relevantCount: 0, commentsCount: 0, sharesCount: 0, viewsCount: 0,
      isNew: true, createdAt, username: resolvedUsername,
    };

    await kv.set(`ff:post:${postId}`, JSON.stringify(post));

    // Index par communauté
    const idxKey = `ff:comm-actus-idx:${communityId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");
    ids.unshift(postId);
    if (ids.length > 300) ids.splice(300);
    await kv.set(idxKey, JSON.stringify(ids));

    // Index par utilisateur
    const userIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${resolvedUsername}`)) || "[]");
    userIds.unshift(postId);
    await kv.set(`ff:posts:user:${resolvedUsername}`, JSON.stringify(userIds));

    // Index par hashtag
    for (const tag of (hashtags || [])) {
      const tagKey = (tag as string).toLowerCase().replace(/^#/, "");
      const tagIds: string[] = JSON.parse((await kv.get(`ff:comm-hashtag:${tagKey}`)) || "[]");
      if (!tagIds.includes(postId)) {
        tagIds.unshift(postId);
        if (tagIds.length > 200) tagIds.splice(200);
        await kv.set(`ff:comm-hashtag:${tagKey}`, JSON.stringify(tagIds));
      }
    }

    await logActivity(resolvedUsername, "post", { postId, communityId });
    await addProgressScore(resolvedUsername, 5);
    await checkAndAwardFcoins(resolvedUsername);

    console.log(`Community actus post créé: id=${postId}, community=${communityId}, user=${resolvedUsername}`);
    return c.json({ success: true, post });
  } catch (err) {
    console.error("Erreur POST community actus post:", err);
    return c.json({ error: `Échec création post communauté: ${err}` }, 500);
  }
});

// GET /communities/:id/posts — Posts Actus d'une communauté (format ApiPost)
app.get("/make-server-218684af/communities/:id/posts", async (c) => {
  try {
    const communityId = c.req.param("id");
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);

    const idxKey = `ff:comm-actus-idx:${communityId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");
    const posts = [];

    for (const id of ids.slice(0, limit)) {
      const raw = await kv.get(`ff:post:${id}`);
      if (!raw) continue;
      const post = JSON.parse(raw);
      if (post.createdAt) post.progress.timestamp = relativeTime(post.createdAt);
      posts.push(post);
    }

    console.log(`GET communities/${communityId}/posts — ${posts.length} posts`);
    return c.json({ posts, total: posts.length });
  } catch (err) {
    return c.json({ error: `Échec récupération posts communauté: ${err}` }, 500);
  }
});

// POST /community-posts/seed — Semer les posts communautaires (idempotent)
app.post("/make-server-218684af/community-posts/seed", async (c) => {
  try {
    const body = await c.req.json();
    const { posts } = body;
    if (!Array.isArray(posts)) return c.json({ error: "posts array requis." }, 400);

    let seeded = 0;
    let skipped = 0;

    for (const post of posts) {
      if (!post.id) continue;
      const key = `ff:comm-post:${post.id}`;
      const existing = await kv.get(key);
      if (!existing) {
        await kv.set(key, JSON.stringify(post));
        // Indexer par hashtag
        for (const tag of (post.hashtags || [])) {
          const tagKey = (tag as string).toLowerCase().replace(/^#/, "");
          const tagIds: string[] = JSON.parse((await kv.get(`ff:comm-hashtag:${tagKey}`)) || "[]");
          if (!tagIds.includes(post.id as string)) {
            tagIds.unshift(post.id as string);
            if (tagIds.length > 200) tagIds.splice(200);
            await kv.set(`ff:comm-hashtag:${tagKey}`, JSON.stringify(tagIds));
          }
        }
        seeded++;
      } else {
        skipped++;
      }
    }

    console.log(`Community posts seed: ${seeded} seedés, ${skipped} ignorés`);
    return c.json({ success: true, seeded, skipped });
  } catch (err) {
    console.log("Erreur seed community posts:", err);
    return c.json({ error: `Échec seed: ${err}` }, 500);
  }
});

// GET /community-posts/hashtag/:tag — Posts communautaires par hashtag
app.get("/make-server-218684af/community-posts/hashtag/:tag", async (c) => {
  try {
    const tag = c.req.param("tag").toLowerCase().replace(/^#/, "");
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const userId = c.req.query("userId") || "";

    const postIds: string[] = JSON.parse((await kv.get(`ff:comm-hashtag:${tag}`)) || "[]");
    const posts = [];

    for (const id of postIds.slice(0, limit)) {
      const raw = await kv.get(`ff:comm-post:${id}`);
      if (!raw) continue;
      const post = JSON.parse(raw);

      // Enrichir avec réactions
      const countsRaw = await kv.get(`ff:post-reactions:counts:${id}`);
      post.reactionCounts = countsRaw ? JSON.parse(countsRaw) : {};
      post.reactionTotal = Object.values(post.reactionCounts as Record<string, number>)
        .reduce((s: number, v) => s + (v as number), 0);

      if (userId) {
        const myRaw = await kv.get(`ff:post-reaction:${id}:${userId}`);
        post.myReaction = myRaw ? JSON.parse(myRaw).reactionType : null;
      } else {
        post.myReaction = null;
      }

      // Compteur de commentaires réels
      const commIds: string[] = JSON.parse((await kv.get(`ff:comments:post:${id}`)) || "[]");
      post.liveCommentsCount = commIds.length;

      posts.push(post);
    }

    console.log(`GET community-posts/hashtag/${tag} — ${posts.length} posts`);
    return c.json({ posts, total: postIds.length, tag });
  } catch (err) {
    return c.json({ error: `Échec récupération posts communautaires: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// AUTH — Inscription + OTP custom
// ═══════����═══════════════════════════════════════════════════════════════════

// ── Helpers OTP custom ────────────────────────────────────────────────────────
const OTP_TTL_MS    = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_TRIES = 5;

// ── OTP 8 chiffres custom (indépendant de Supabase) ──────────────────────────
function genOtp(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000)); // 8 chiffres
}

// Stocker l'OTP en KV avec TTL
async function storeOtp(email: string, code: string): Promise<void> {
  const key = `ff:otp:${email.toLowerCase()}`;
  await kv.set(key, JSON.stringify({ code, createdAt: Date.now(), tries: 0 }));
}

// Vérifier l'OTP depuis le KV
async function verifyStoredOtp(email: string, code: string): Promise<{ valid: boolean; error?: string }> {
  const key = `ff:otp:${email.toLowerCase()}`;
  const raw = await kv.get(key);
  if (!raw) return { valid: false, error: "Code expiré ou introuvable. Demande un nouveau code." };
  const entry = JSON.parse(raw);
  if (Date.now() - entry.createdAt > OTP_TTL_MS) {
    await kv.del(key);
    return { valid: false, error: "Code expiré (10 min). Demande un nouveau code." };
  }
  if (entry.tries >= OTP_MAX_TRIES) {
    await kv.del(key);
    return { valid: false, error: "Trop de tentatives. Demande un nouveau code." };
  }
  if (entry.code !== code.trim()) {
    entry.tries++;
    await kv.set(key, JSON.stringify(entry));
    return { valid: false, error: `Code incorrect. ${OTP_MAX_TRIES - entry.tries} tentative(s) restante(s).` };
  }
  await kv.del(key); // consommé → supprimé
  return { valid: true };
}

// sendOtpEmail supprimé — tous les envois passent par sendViaResend() + SDK Resend

// POST /auth/signup — Crée un utilisateur Supabase Auth + profil KV
app.post("/make-server-218684af/auth/signup", async (c) => {
  try {
    const { email, password, username, name } = await c.req.json();
    if (!email?.trim())    return c.json({ error: "Email requis." }, 400);
    if (!password?.trim()) return c.json({ error: "Mot de passe requis." }, 400);
    if (!username?.trim()) return c.json({ error: "Nom d'utilisateur requis." }, 400);

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return c.json({ error: "Nom d'utilisateur invalide (caractères non supportés)." }, 400);

    // Vérifier si l'username est déjà pris
    const existing = await kv.get(`ff:profile:${normalizedUsername}`);
    if (existing) return c.json({ error: "Ce nom d'utilisateur est déjà utilisé." }, 409);

    const displayName = name?.trim() || normalizedUsername;
    const normalizedEmail = email.trim().toLowerCase();

    // Vérifier d'abord via le KV index — évite un appel Auth inutile
    const existingByEmail = await kv.get(`ff:email-to-username:${normalizedEmail}`);
    if (existingByEmail) {
      return c.json({ error: "Cet email est déjà utilisé. Connecte-toi à la place." }, 409);
    }

    // Créer l'utilisateur Supabase Auth (email auto-confirmé)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      user_metadata: { username: normalizedUsername, name: displayName },
      email_confirm: true,
    });

    let userId: string;

    if (authError) {
      const msg = authError.message ?? "";
      const isAlreadyRegistered =
        msg.toLowerCase().includes("already registered") ||
        msg.toLowerCase().includes("already been registered") ||
        msg.toLowerCase().includes("email address is already") ||
        msg.toLowerCase().includes("user already exists");

      if (!isAlreadyRegistered) {
        console.error("Erreur création auth:", msg);
        return c.json({ error: `Erreur lors de la création du compte : ${msg}` }, 400);
      }

      // ── Compte Auth déjà existant — vérifier si le profil KV existe ────────
      console.log(`[signup] Auth existe déjà pour ${normalizedEmail}, vérification KV...`);
      const kvEmailEntry = await kv.get(`ff:email-to-username:${normalizedEmail}`);
      if (kvEmailEntry) {
        // Compte complet → demander de se connecter
        return c.json({ error: "Cet email est déjà utilisé. Connecte-toi à la place." }, 409);
      }

      // Compte Auth existe mais pas le profil KV → récupération (création partielle précédente)
      console.log(`[signup] Récupération compte partiel pour ${normalizedEmail}`);
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existingAuthUser = listData?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail);
      if (!existingAuthUser) {
        return c.json({ error: "Erreur de synchronisation du compte. Réessaie ou contacte le support." }, 500);
      }
      userId = existingAuthUser.id;
    } else {
      userId = authData!.user.id;
    }
    const now = new Date().toISOString();

    // Créer le profil KV initial
    const profile = {
      username: normalizedUsername,
      name: displayName,
      handle: `@${normalizedUsername}`,
      avatar: "",
      banner: "",
      bio: "",
      objective: "",
      objectiveDesc: "",
      descriptor: "",
      hashtags: [],
      streak: 0,
      constance: 0,
      progressPct: 0,
      objectifsAccomplis: 0,
      daysOnFF: 1,
      onboardingDone: false,
      supabaseId: userId,
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(`ff:profile:${normalizedUsername}`, JSON.stringify(profile));
    // Index email → username pour lookup
    await kv.set(`ff:email-to-username:${normalizedEmail}`, normalizedUsername);
    // Index supabaseId → username pour resolveUsername (O(1), sans scan)
    await kv.set(`ff:uid-to-user:${userId}`, normalizedUsername);

    // ── Compteur d'inscrits + badge Early Builder ─────────────────────────────
    // Incrémentation atomique du compteur global d'utilisateurs
    const currentCount = parseInt((await kv.get("ff:user-count")) || "0");
    const newUserNumber = currentCount + 1;
    await kv.set("ff:user-count", String(newUserNumber));
    await kv.set(`ff:user-number:${normalizedUsername}`, String(newUserNumber));
    console.log(`[signup] Inscrit n°${newUserNumber}: ${normalizedUsername}`);
    // Award immédiat : Early Builder (500 premiers) et Pioneer (1000 premiers)
    // silent=true : ne pas alimenter l'activité/score du diagramme dès J0
    try {
      if (newUserNumber <= 500)  await awardFcoin(normalizedUsername, "rare_early",   true);
      if (newUserNumber <= 1000) await awardFcoin(normalizedUsername, "rare_pioneer",  true);
    } catch (e) { console.log("[signup] Erreur award badge early:", e); }

    // Envoyer le code OTP 8 chiffres post-inscription via Resend SDK (non-bloquant)
    try {
      const otpCodeSignup = genOtp();
      await storeOtp(normalizedEmail, otpCodeSignup);
      await sendViaResend(
        normalizedEmail,
        `${otpCodeSignup} — Bienvenue sur FuturFeed, confirme ton compte`,
        buildOtpEmailHtml(otpCodeSignup, `Bienvenue ${displayName} 🎉`, "Entre ce code dans l'app pour activer ton compte FuturFeed.")
      );
      console.log(`[signup] Email OTP bienvenue (8 chiffres) envoyé à ${normalizedEmail}`);
    } catch (otpSendErr) {
      console.log("Avertissement envoi OTP post-inscription:", otpSendErr);
    }

    console.log(`Inscription + OTP: username=${normalizedUsername}, email=${normalizedEmail}`);
    return c.json({ success: true, username: normalizedUsername, userId });
  } catch (err) {
    console.error("Erreur inscription:", err);
    return c.json({ error: `Échec de l'inscription : ${err}` }, 500);
  }
});

// ── Helper : construire le HTML de l'email OTP ────────────────────────────────
function buildOtpEmailHtml(otpCode: string, title: string, subtitle: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;min-height:100vh;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="100%" style="max-width:480px;background:rgba(20,20,28,1);border:1px solid rgba(139,92,246,0.25);border-radius:24px;padding:40px 32px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#f0f0f5;letter-spacing:-0.5px;">FuturFeed</h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.40);">Construis ton futur, jour après jour.</p>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0 0 10px;font-size:16px;font-weight:600;color:#f0f0f5;">${title}</p>
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.7;">
            ${subtitle}<br>
            Il expire dans <strong style="color:rgba(255,255,255,0.80);">10 minutes</strong> et ne peut être utilisé qu'une seule fois.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="background:rgba(139,92,246,0.12);border:1.5px solid rgba(139,92,246,0.35);border-radius:16px;padding:28px;">
            <span style="font-size:48px;font-weight:800;letter-spacing:12px;color:#c4b5fd;">${otpCode}</span>
          </div>
        </td></tr>
        <tr><td style="padding-bottom:20px;">
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.7;text-align:center;">
            Retourne dans l'app <strong style="color:#f0f0f5;">FuturFeed</strong> et entre ce code pour continuer.
          </p>
        </td></tr>
        <tr><td>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.22);line-height:1.6;text-align:center;">
            Si tu n'as pas demandé ce code, ignore cet email en toute sécurité.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Helper : transformer les erreurs Supabase OTP en réponse HTTP propre ──────
function handleSupabaseOtpError(raw: string): { status: number; message: string } {
  const msg = (raw || "").toLowerCase();
  // Limite horaire plan gratuit (3 emails/heure)
  if (msg.includes("email rate limit exceeded") || msg.includes("rate limit")) {
    return { status: 429, message: "Limite d'emails atteinte (plan gratuit Supabase : 3/heure). Attends 1 heure ou configure un SMTP custom dans ton dashboard Supabase." };
  }
  // Limite inter-requête (ex : "after 14 seconds")
  if (msg.includes("security purposes") || msg.includes("seconds")) {
    const match = raw.match(/after (\d+) second/);
    const secs = match ? match[1] : "quelques";
    return { status: 429, message: `Patiente encore ${secs} secondes avant de renvoyer un code.` };
  }
  return { status: 500, message: `Erreur envoi email : ${raw}` };
}

// ── Resend via fetch REST (sans SDK, compatible Deno Edge) ────────────────────
const FROM_ADDRESS = "FuturFeed <contact@email.futurfeed.com>";
const RESEND_API_URL = "https://api.resend.com/emails";

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("Resend_API_KEY_Fowards")?.trim();
  if (!apiKey) throw new Error("[Resend] Resend_API_KEY_Fowards non configurée.");
  console.log(`[Resend] Envoi à ${to} | clé longueur: ${apiKey.length}`);

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
  });

  const json = await res.json().catch(() => ({}));
  console.log(`[Resend] HTTP ${res.status} | réponse: ${JSON.stringify(json)}`);

  if (!res.ok) {
    throw new Error(`[Resend] HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  console.log(`[Resend] ✅ Email accepté | to: ${to} | ID: ${json?.id}`);
}

// POST /auth/send-otp — OTP 8 chiffres custom stocké en KV, envoyé via Resend (domaine vérifié)
app.post("/make-server-218684af/auth/send-otp", async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email?.trim()) return c.json({ error: "Email requis." }, 400);

    const emailKey = email.trim().toLowerCase();
    console.log(`[send-otp] Début envoi OTP pour: ${emailKey}`);

    // ── 1. Vérifier que le compte existe ─────────────────────────────────────
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error(`Erreur liste utilisateurs: ${listErr.message}`);
    const authUser = users.find((u: { email?: string }) => u.email?.toLowerCase() === emailKey);
    if (!authUser) {
      return c.json({ error: "Aucun compte trouvé avec cet email. Inscris-toi d'abord." }, 404);
    }

    // ── 2. Générer le code 8 chiffres et le stocker en KV ────────────────────
    const otpCode = genOtp();
    await storeOtp(emailKey, otpCode);

    // ── 3. Envoyer via Resend ─────────────────────────────────────────────────
    await sendViaResend(
      emailKey,
      `${otpCode} — Ton code de connexion FuturFeed`,
      buildOtpEmailHtml(otpCode, "Bonjour 👋", "Voici ton code de vérification à 8 chiffres.")
    );

    console.log(`[send-otp] OTP 8 chiffres envoyé à ${emailKey} depuis ${FROM_ADDRESS}`);
    return c.json({ success: true });
  } catch (err) {
    console.error("Erreur send-otp:", err);
    return c.json({ error: `Erreur serveur : ${err}` }, 500);
  }
});

// POST /auth/verify-otp — Vérifier le code KV puis créer une session Supabase
app.post("/make-server-218684af/auth/verify-otp", async (c) => {
  try {
    const { email, code } = await c.req.json();
    if (!email?.trim()) return c.json({ error: "Email requis." }, 400);
    if (!code?.trim())  return c.json({ error: "Code requis." }, 400);

    const emailKey = email.trim().toLowerCase();

    // ── 1. Vérifier le code custom stocké en KV ──────────────────────────────
    const result = await verifyStoredOtp(emailKey, code);
    if (!result.valid) {
      console.error(`[verify-otp] Échec pour ${emailKey}: ${result.error}`);
      return c.json({ error: result.error, blocked: false }, 400);
    }

    // ── 2. Code valide → générer un magic link Supabase pour créer la session ─
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: emailKey,
    });
    if (linkErr || !linkData) {
      console.error("[verify-otp] generateLink error:", linkErr?.message);
      return c.json({ error: "Erreur interne lors de la création de session." }, 500);
    }
    const supabaseOtp = (linkData as any)?.properties?.email_otp;
    const { data, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
      email: emailKey,
      token: supabaseOtp,
      type: "magiclink",
    });

    if (verifyErr || !data?.session) {
      console.error("[verify-otp] verifyOtp error:", verifyErr?.message);
      return c.json({ error: "Erreur lors de la création de session. Réessaie." }, 500);
    }

    const { access_token, refresh_token } = data.session;
    console.log(`[verify-otp] Succès pour ${emailKey}`);
    return c.json({ success: true, access_token, refresh_token, email: emailKey });
  } catch (err) {
    console.error("Erreur verify-otp:", err);
    return c.json({ error: `Échec vérification OTP : ${err}` }, 500);
  }
});

// POST /auth/resend-otp — Renvoyer un nouveau code 8 chiffres custom
app.post("/make-server-218684af/auth/resend-otp", async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email?.trim()) return c.json({ error: "Email requis." }, 400);

    const emailKey = email.trim().toLowerCase();

    // Vérifier que le compte existe
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error(`Erreur liste utilisateurs: ${listErr.message}`);
    const authUser = users.find((u: { email?: string }) => u.email?.toLowerCase() === emailKey);
    if (!authUser) return c.json({ error: "Compte introuvable. Inscris-toi d'abord." }, 404);

    // Générer un nouveau code 8 chiffres et écraser l'ancien en KV
    const otpCode = genOtp();
    await storeOtp(emailKey, otpCode);

    await sendViaResend(
      emailKey,
      `${otpCode} — Ton nouveau code FuturFeed`,
      buildOtpEmailHtml(otpCode, "Nouveau code 🔄", "Voici ton nouveau code de vérification à 8 chiffres.")
    );

    console.log(`[resend-otp] Nouveau OTP 8 chiffres envoyé à ${emailKey}`);
    return c.json({ success: true });
  } catch (err) {
    console.error("Erreur resend-otp:", err);
    return c.json({ error: `Échec renvoi OTP : ${err}` }, 500);
  }
});

// GET /user-number/:username — Numéro d'inscription (rang dans les inscrits)
app.get("/make-server-218684af/user-number/:username", async (c) => {
  try {
    const username = c.req.param("username");
    const numRaw = await kv.get(`ff:user-number:${username}`);
    const totalRaw = await kv.get("ff:user-count");
    return c.json({
      userNumber: numRaw ? parseInt(numRaw) : null,
      totalUsers: totalRaw ? parseInt(totalRaw) : null,
      isEarlyBuilder: numRaw ? parseInt(numRaw) <= 500 : false,
      isPioneer: numRaw ? parseInt(numRaw) <= 1000 : false,
    });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PRÉFÉRENCES UTILISATEUR (audience, etc.)
// ════════════════════════════════════════════════════════════════════════════

// GET /user-prefs/:userId
app.get("/make-server-218684af/user-prefs/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const raw = await kv.get(`ff:user-prefs:${userId}`);
    const prefs = raw ? JSON.parse(raw) : { audience: "everyone" };
    return c.json({ prefs });
  } catch (err) {
    console.error("Erreur GET user-prefs:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// POST /user-prefs/:userId
app.post("/make-server-218684af/user-prefs/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const body = await c.req.json();
    const existing = await kv.get(`ff:user-prefs:${userId}`);
    const current = existing ? JSON.parse(existing) : {};
    const merged = { ...current, ...body };
    await kv.set(`ff:user-prefs:${userId}`, JSON.stringify(merged));
    console.log(`user-prefs mis à jour: userId=${userId}`, merged);
    return c.json({ success: true, prefs: merged });
  } catch (err) {
    console.error("Erreur POST user-prefs:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PROFILS UTILISATEURS
// ════════════════════��═══════════════════════════════════════════════════════

// GET /profiles/:username
app.get("/make-server-218684af/profiles/:username", async (c) => {
  try {
    const username = normalizeUsername(c.req.param("username"));
    const raw = await kv.get(`ff:profile:${username}`);
    if (!raw) return c.json({ error: "Profil introuvable.", found: false }, 404);
    const profile = JSON.parse(raw);
    const postIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
    const followerIds: string[] = JSON.parse((await kv.get(`ff:followers:${username}`)) || "[]");
    const followingIds: string[] = JSON.parse((await kv.get(`ff:following:${username}`)) || "[]");
    profile.postsCount = postIds.length;
    profile.followersCount = followerIds.length;
    profile.followingCount = followingIds.length;
    if (profile.createdAt) profile.joinedAt = relativeTime(profile.createdAt);
    // Rétrocompat : écrire le mapping supabaseId → username si manquant
    if (profile.supabaseId) {
      const existing = await kv.get(`ff:uid-to-user:${profile.supabaseId}`);
      if (!existing) await kv.set(`ff:uid-to-user:${profile.supabaseId}`, username);
    }
    console.log(`GET profile/${username}`);
    return c.json({ profile, found: true });
  } catch (err) {
    return c.json({ error: `Échec récupération profil: ${err}` }, 500);
  }
});

// POST /profiles/batch — Récupère plusieurs profils en une seule requête
app.post("/make-server-218684af/profiles/batch", async (c) => {
  try {
    const body = await c.req.json();
    const { usernames } = body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return c.json({ profiles: {} });
    }
    const results: Record<string, unknown> = {};
    for (const rawUsername of usernames.slice(0, 50)) {
      const username = normalizeUsername(rawUsername);
      if (!username) continue;
      const raw = await kv.get(`ff:profile:${username}`);
      if (!raw) continue;
      const profile = JSON.parse(raw);
      const postIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
      const followerIds: string[] = JSON.parse((await kv.get(`ff:followers:${username}`)) || "[]");
      const followingIds: string[] = JSON.parse((await kv.get(`ff:following:${username}`)) || "[]");
      profile.postsCount = postIds.length;
      profile.followersCount = followerIds.length;
      profile.followingCount = followingIds.length;
      results[username] = profile;
    }
    console.log(`GET profiles/batch — ${Object.keys(results).length} profils`);
    return c.json({ profiles: results });
  } catch (err) {
    return c.json({ error: `Échec batch profils: ${err}` }, 500);
  }
});

// PUT /profiles/:username — Créer ou mettre à jour
app.put("/make-server-218684af/profiles/:username", async (c) => {
  try {
    const username = normalizeUsername(c.req.param("username"));
    const body = await c.req.json();
    const existingRaw = await kv.get(`ff:profile:${username}`);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const now = new Date().toISOString();
    const profile = {
      ...existing,
      username,
      name:               body.name              ?? existing.name              ?? username,
      handle:             body.handle            ?? existing.handle            ?? `@${username}`,
      avatar:             body.avatar            ?? existing.avatar            ?? "",
      banner:             body.banner            ?? existing.banner            ?? "",
      bio:                body.bio               ?? existing.bio               ?? "",
      objective:          body.objective         ?? existing.objective         ?? "",
      objectiveDesc:      body.objectiveDesc     ?? existing.objectiveDesc     ?? "",
      descriptor:         body.descriptor        ?? existing.descriptor        ?? "",
      hashtags:           body.hashtags          ?? existing.hashtags          ?? [],
      streak:             body.streak            ?? existing.streak            ?? 0,
      constance:          body.constance         ?? existing.constance         ?? 0,
      progressPct:        body.progressPct       ?? existing.progressPct       ?? 0,
      objectifsAccomplis: body.objectifsAccomplis ?? existing.objectifsAccomplis ?? 0,
      daysOnFF:           body.daysOnFF          ?? existing.daysOnFF          ?? 1,
      onboardingDone:     body.onboardingDone     ?? existing.onboardingDone     ?? false,
      firstPostCreated:   body.firstPostCreated   ?? existing.firstPostCreated   ?? false,
      createdAt:          existing.createdAt     ?? now,
      updatedAt:          now,
    };
    await kv.set(`ff:profile:${username}`, JSON.stringify(profile));
    console.log(`PUT profile/${username}`);

    // ── Propagation live dans les posts existants (avatar, objective, streak) ──
    try {
      const userPostIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
      const toUpdate = userPostIds.slice(0, 50);
      for (const pid of toUpdate) {
        const rawPost = await kv.get(`ff:post:${pid}`);
        if (!rawPost) continue;
        const post = JSON.parse(rawPost);
        post.user = {
          ...post.user,
          avatar:    profile.avatar    || post.user?.avatar    || "",
          objective: profile.objective || post.user?.objective || "",
          name:      profile.name      || post.user?.name      || username,
        };
        post.streak = profile.streak ?? post.streak ?? 0;
        await kv.set(`ff:post:${pid}`, JSON.stringify(post));
      }
      console.log(`PUT profile/${username}: ${toUpdate.length} posts propagés`);
    } catch (propErr) {
      console.log(`PUT profile/${username}: erreur propagation: ${propErr}`);
    }

    return c.json({ success: true, profile });
  } catch (err) {
    return c.json({ error: `Echec mise a jour profil: ${err}` }, 500);
  }
});

// GET /profiles/by-uid/:supabaseId — Profil par UID stable (survive au changement de pseudo)
app.get("/make-server-218684af/profiles/by-uid/:supabaseId", async (c) => {
  try {
    const supabaseId = c.req.param("supabaseId");
    if (!supabaseId) return c.json({ found: false }, 400);
    const storedUsername = await kv.get(`ff:uid-to-user:${supabaseId}`);
    if (!storedUsername) return c.json({ found: false, kvUsername: null }, 404);
    const raw = await kv.get(`ff:profile:${storedUsername}`);
    if (!raw) return c.json({ found: false, kvUsername: storedUsername }, 404);
    const profile = JSON.parse(raw);
    const followerIds: string[] = JSON.parse((await kv.get(`ff:followers:${storedUsername}`)) || "[]");
    const followingIds: string[] = JSON.parse((await kv.get(`ff:following:${storedUsername}`)) || "[]");
    const postIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${storedUsername}`)) || "[]");
    profile.followersCount = followerIds.length;
    profile.followingCount = followingIds.length;
    profile.postsCount = postIds.length;
    console.log(`GET profiles/by-uid/${supabaseId} -> username=${storedUsername}`);
    return c.json({ found: true, profile, kvUsername: storedUsername });
  } catch (err) {
    return c.json({ error: `Echec lookup UID: ${err}`, found: false }, 500);
  }
});

// PUT /profiles/:oldUsername/rename — Migrer toutes les donnees vers un nouveau pseudo
app.put("/make-server-218684af/profiles/:oldUsername/rename", async (c) => {
  try {
    const oldUsername = normalizeUsername(c.req.param("oldUsername"));
    const body = await c.req.json();
    const newUsername = normalizeUsername(body.newUsername || "");
    const supabaseId = body.supabaseId || "";
    if (!oldUsername || !newUsername) return c.json({ error: "oldUsername et newUsername requis." }, 400);
    if (oldUsername === newUsername) return c.json({ success: true, kvUsername: newUsername });

    const conflict = await kv.get(`ff:profile:${newUsername}`);
    if (conflict) {
      const cp = JSON.parse(conflict);
      if (!supabaseId || cp.supabaseId !== supabaseId)
        return c.json({ error: "Ce pseudo est deja utilise.", code: "CONFLICT" }, 409);
    }

    const rawOld = await kv.get(`ff:profile:${oldUsername}`);
    if (rawOld) {
      const profile = JSON.parse(rawOld);
      profile.username = newUsername;
      profile.handle = `@${newUsername}`;
      profile.updatedAt = new Date().toISOString();
      await kv.set(`ff:profile:${newUsername}`, JSON.stringify(profile));
    }

    if (supabaseId) await kv.set(`ff:uid-to-user:${supabaseId}`, newUsername);

    const mergeList = async (oldKey: string, newKey: string) => {
      const oldData: string[] = JSON.parse((await kv.get(oldKey)) || "[]");
      if (oldData.length === 0) return;
      const newData: string[] = JSON.parse((await kv.get(newKey)) || "[]");
      await kv.set(newKey, JSON.stringify([...new Set([...newData, ...oldData])]));
    };
    await mergeList(`ff:posts:user:${oldUsername}`, `ff:posts:user:${newUsername}`);
    await mergeList(`ff:followers:${oldUsername}`, `ff:followers:${newUsername}`);
    await mergeList(`ff:following:${oldUsername}`, `ff:following:${newUsername}`);

    for (const suffix of ["goals", "goals-selected", "user-stat-cash", "user-stat-hours"]) {
      const raw = await kv.get(`ff:${suffix}:${oldUsername}`);
      if (raw) await kv.set(`ff:${suffix}:${newUsername}`, raw);
    }

    console.log(`Rename: ${oldUsername} -> ${newUsername}`);
    return c.json({ success: true, kvUsername: newUsername });
  } catch (err) {
    console.error("Erreur rename:", err);
    return c.json({ error: `Echec rename: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// MEMBRES DE COMMUNAUTE (Abonnements aux communautes)
// ════════════════════════════════════════════════════════════════════════════

// POST /community-members — Rejoindre ou quitter une communauté (toggle)
app.post("/make-server-218684af/community-members", async (c) => {
  try {
    const body = await c.req.json();
    const { communityId, userId } = body;
    if (!communityId) return c.json({ error: "communityId requis." }, 400);
    if (!userId)      return c.json({ error: "userId requis." }, 400);

    const memberKey = `ff:community-member:${communityId}:${userId}`;
    const existing  = await kv.get(memberKey);

    const memberIds: string[]    = JSON.parse((await kv.get(`ff:community-members:${communityId}`)) || "[]");
    const communityIds: string[] = JSON.parse((await kv.get(`ff:user-communities:${userId}`))      || "[]");

    if (existing) {
      // Toggle OFF : quitter la communauté
      await kv.del(memberKey);
      const newMembers     = memberIds.filter((id) => id !== userId);
      const newCommunities = communityIds.filter((id) => id !== communityId);
      await kv.set(`ff:community-members:${communityId}`, JSON.stringify(newMembers));
      await kv.set(`ff:user-communities:${userId}`,       JSON.stringify(newCommunities));
      console.log(`Quitte communauté: user=${userId}, community=${communityId}`);
      return c.json({ success: true, isMember: false, memberCount: newMembers.length });
    }

    // Rejoindre
    const membership = { id: genId(), communityId, userId, createdAt: new Date().toISOString() };
    await kv.set(memberKey, JSON.stringify(membership));
    if (!memberIds.includes(userId))         memberIds.push(userId);
    if (!communityIds.includes(communityId)) communityIds.push(communityId);
    await kv.set(`ff:community-members:${communityId}`, JSON.stringify(memberIds));
    await kv.set(`ff:user-communities:${userId}`,       JSON.stringify(communityIds));

    console.log(`Rejoint communauté: user=${userId}, community=${communityId}`);
    return c.json({ success: true, isMember: true, memberCount: memberIds.length });
  } catch (err) {
    console.log("Erreur community-members:", err);
    return c.json({ error: `Échec abonnement communauté: ${err}` }, 500);
  }
});

// GET /community-members/:communityId/status?userId=xxx
app.get("/make-server-218684af/community-members/:communityId/status", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const userId      = c.req.query("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const memberKey  = `ff:community-member:${communityId}:${userId}`;
    const existing   = await kv.get(memberKey);
    const memberIds: string[] = JSON.parse((await kv.get(`ff:community-members:${communityId}`)) || "[]");
    return c.json({ isMember: !!existing, memberCount: memberIds.length });
  } catch (err) {
    return c.json({ error: `Échec statut membership: ${err}` }, 500);
  }
});

// GET /community-members/:communityId — Liste des membres
app.get("/make-server-218684af/community-members/:communityId", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const memberIds: string[] = JSON.parse((await kv.get(`ff:community-members:${communityId}`)) || "[]");
    const members = [];
    for (const userId of memberIds) {
      const raw = await kv.get(`ff:community-member:${communityId}:${userId}`);
      if (raw) {
        const m = JSON.parse(raw);
        if (m.createdAt) m.joinedAt = relativeTime(m.createdAt);
        members.push(m);
      }
    }
    console.log(`GET community-members/${communityId} — ${members.length} membres`);
    return c.json({ members, total: members.length });
  } catch (err) {
    return c.json({ error: `Échec récupération membres: ${err}` }, 500);
  }
});

// GET /user-communities/:userId — Communautés rejointes par l'utilisateur
app.get("/make-server-218684af/user-communities/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const communityIds: string[] = JSON.parse((await kv.get(`ff:user-communities:${userId}`)) || "[]");
    return c.json({ communityIds, total: communityIds.length });
  } catch (err) {
    return c.json({ error: `Échec récupération communautés user: ${err}` }, 500);
  }
});

// GET /community-members/batch-status?userId=xxx&communityIds=1,2,3
app.get("/make-server-218684af/community-members/batch-status", async (c) => {
  try {
    const userId   = c.req.query("userId");
    const idsParam = c.req.query("communityIds") || "";
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const communityIds = idsParam.split(",").filter(Boolean);
    const statuses: Record<string, boolean> = {};
    for (const communityId of communityIds) {
      const existing = await kv.get(`ff:community-member:${communityId}:${userId}`);
      statuses[communityId] = !!existing;
    }
    return c.json({ statuses });
  } catch (err) {
    return c.json({ error: `Échec batch status: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// OBJECTIFS COMMUNAUTAIRES (TribeStats)
// ════════════════════════════════════════════════════════════════════════════

// POST /community-objectives — Créer un objectif pour un user dans une communauté
app.post("/make-server-218684af/community-objectives", async (c) => {
  try {
    const { userId, communityId, type, emoji, title, targetValue, unit, durationDays } = await c.req.json();
    if (!userId || !communityId || !title?.trim()) {
      return c.json({ error: "userId, communityId et title sont requis." }, 400);
    }
    const id = genId();
    const days = durationDays || 30;
    const objective = {
      id, userId, communityId,
      type: type || "custom",
      emoji: emoji || "🎯",
      title: title.trim(),
      targetValue: targetValue || 1,
      currentValue: 0,
      unit: unit || "",
      durationDays: days,
      endDate: new Date(Date.now() + days * 86400000).toISOString(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const key = `ff:comm-objectives:${userId}:${communityId}`;
    const existing: unknown[] = JSON.parse((await kv.get(key)) || "[]");
    existing.unshift(objective);
    if (existing.length > 20) existing.splice(20);
    await kv.set(key, JSON.stringify(existing));
    // Index de lookup rapide id → userId:communityId
    await kv.set(`ff:comm-obj-idx:${id}`, `${userId}:${communityId}`);
    console.log(`Objectif communautaire créé: id=${id}, user=${userId}, community=${communityId}`);
    return c.json({ success: true, objective });
  } catch (err) {
    return c.json({ error: `Échec création objectif: ${err}` }, 500);
  }
});

// GET /community-objectives/stats/:communityId — Stats agrégées de la communauté
app.get("/make-server-218684af/community-objectives/stats/:communityId", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const memberIds: string[] = JSON.parse((await kv.get(`ff:community-members:${communityId}`)) || "[]");
    let totalObjectives = 0, completedObjectives = 0, activeUsers = 0;
    let totalCurrentValue = 0, totalCompletion = 0;
    for (const uid of memberIds.slice(0, 50)) {
      const objs: Array<{ currentValue: number; targetValue: number; completed: boolean }> =
        JSON.parse((await kv.get(`ff:comm-objectives:${uid}:${communityId}`)) || "[]");
      if (objs.length > 0) activeUsers++;
      for (const o of objs) {
        totalObjectives++;
        if (o.completed) completedObjectives++;
        totalCurrentValue += o.currentValue || 0;
        const p = Math.min(100, Math.round(((o.currentValue || 0) / Math.max(1, o.targetValue)) * 100));
        totalCompletion += p;
      }
    }
    return c.json({
      totalObjectives, completedObjectives, activeUsers,
      totalCurrentValue,
      avgCompletion: totalObjectives > 0 ? Math.round(totalCompletion / totalObjectives) : 0,
    });
  } catch (err) {
    return c.json({ error: `Échec stats objectifs: ${err}` }, 500);
  }
});

// GET /community-objectives/:userId/:communityId — Objectifs d'un user dans une communauté
app.get("/make-server-218684af/community-objectives/:userId/:communityId", async (c) => {
  try {
    const { userId, communityId } = c.req.param();
    const objectives = JSON.parse((await kv.get(`ff:comm-objectives:${userId}:${communityId}`)) || "[]");
    return c.json({ objectives, total: objectives.length });
  } catch (err) {
    return c.json({ error: `Échec récupération objectifs: ${err}` }, 500);
  }
});

// PUT /community-objectives/:id/progress — Incrémenter ou définir la valeur courante
app.put("/make-server-218684af/community-objectives/:id/progress", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { increment, setValue } = body;
    // Lookup direct via index
    const lookup = await kv.get(`ff:comm-obj-idx:${id}`);
    if (!lookup) return c.json({ error: "Objectif introuvable." }, 404);
    const [userId, communityId] = lookup.split(":");
    const key = `ff:comm-objectives:${userId}:${communityId}`;
    const objs: Array<{ id: string; currentValue: number; targetValue: number; completed: boolean }> =
      JSON.parse((await kv.get(key)) || "[]");
    const idx = objs.findIndex((o) => o.id === id);
    if (idx < 0) return c.json({ error: "Objectif introuvable dans la liste." }, 404);
    const obj = objs[idx];
    if (increment) {
      obj.currentValue = (obj.currentValue || 0) + 1;
    } else if (setValue !== undefined) {
      obj.currentValue = Math.max(0, Number(setValue));
    }
    obj.completed = obj.currentValue >= obj.targetValue;
    objs[idx] = obj;
    await kv.set(key, JSON.stringify(objs));
    console.log(`Objectif mis à jour: id=${id}, currentValue=${obj.currentValue}, completed=${obj.completed}`);
    return c.json({ success: true, objective: obj });
  } catch (err) {
    return c.json({ error: `Échec mise à jour objectif: ${err}` }, 500);
  }
});

// DELETE /community-objectives/:id — Supprimer un objectif
app.delete("/make-server-218684af/community-objectives/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const lookup = await kv.get(`ff:comm-obj-idx:${id}`);
    if (!lookup) return c.json({ error: "Objectif introuvable." }, 404);
    const [userId, communityId] = lookup.split(":");
    const key = `ff:comm-objectives:${userId}:${communityId}`;
    const objs: Array<{ id: string }> = JSON.parse((await kv.get(key)) || "[]");
    await kv.set(key, JSON.stringify(objs.filter((o) => o.id !== id)));
    await kv.del(`ff:comm-obj-idx:${id}`);
    console.log(`Objectif supprimé: id=${id}`);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec suppression objectif: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════��═════════════════════════════════
// SYSTÈME DE PROGRESSION
// ════════════════════════════════════════════════════════════════════════════

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function daysDiff(a: string, b: string): number { return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000); }

const FCOIN_DEFS: Record<string, { category: string; name: string }> = {
  streak_2:         { category: "streak",    name: "Départ" },
  streak_7:         { category: "streak",    name: "Discipline" },
  streak_30:        { category: "streak",    name: "Constant" },
  posts_1:          { category: "posts",     name: "Premiers pas" },
  posts_10:         { category: "posts",     name: "Contributeur" },
  posts_50:         { category: "posts",     name: "Créateur" },
  reactions_first:  { category: "reactions", name: "1er post apprécié" },
  reactions_100:    { category: "reactions", name: "Impression" },
  reactions_1000:   { category: "reactions", name: "Influence" },
  community_join:   { category: "community", name: "Début d'aventure" },
  community_20msg:  { category: "community", name: "L'actif" },
  community_100msg: { category: "community", name: "Aimé" },
  rare_early:       { category: "rare",      name: "Early Builder" },  // 500 premiers inscrits
  rare_pioneer:     { category: "rare",      name: "Pioneer" },         // 1000 premiers inscrits
  rare_first_goal:  { category: "rare",      name: "First Objectif" },
  social_10profiles:{ category: "social",    name: "Explorateur" },
  social_10comments:{ category: "social",    name: "Curieux" },
  social_10follows: { category: "social",    name: "Observateur" },
};

// ── Résolution supabaseId → username (lookup O(1) uniquement) ────────────────
// Le mapping ff:uid-to-user:${supabaseId} est écrit à la création du compte.
// Aucun scan de table entière ici pour ne pas bloquer le serveur.
async function resolveUsername(userId: string): Promise<string | null> {
  try {
    // 1) Le profil est peut-être directement sous cette clé (username == userId)
    const direct = await kv.get(`ff:profile:${userId}`);
    if (direct) return userId;
    // 2) Reverse mapping écrit à la création du compte
    const cached = await kv.get(`ff:uid-to-user:${userId}`);
    if (cached) return cached as string;
  } catch (e) { console.log("resolveUsername error:", e); }
  return null;
}

// ── Score journalier (moteur constance) ──────────────────────────────────────
// Pondération des actions + anti-abus à 70% du plafond par catégorie (× 0.5).
// Score final clampé 0-100.
type DailyEntry = {
  date: string; count: number; actions: string[];
  posts: number; goalProgress: number; comments: number;
  reactions: number; communityMessages: number; follows: number;
  score: number;
};
const SCORE_CFG = [
  { key: "posts",             pts: 20, max: 2  },
  { key: "goalProgress",      pts: 25, max: 2  },
  { key: "comments",          pts: 8,  max: 5  },
  { key: "reactions",         pts: 2,  max: 20 },
  { key: "communityMessages", pts: 10, max: 5  },
  { key: "follows",           pts: 5,  max: 5  },
] as const;
const SCORE_CAT: Record<string, string> = {
  post: "posts",
  goal_update: "goalProgress", goal_completed: "goalProgress",
  // goal_created intentionnellement exclu : créer un objectif pendant l'onboarding
  // ne doit PAS générer de données dans le diagramme d'un nouvel utilisateur.
  progress_report: "goalProgress",
  comment: "comments",
  reaction: "reactions",
  community_message: "communityMessages", channel_post: "communityMessages",
  follow: "follows", community_join: "follows",
};
function computeDailyScore(entry: Partial<DailyEntry>): number {
  let total = 0;
  for (const { key, pts, max } of SCORE_CFG) {
    const count = Math.min(max, (entry as Record<string, number>)[key] || 0);
    const thresh = max * 0.7;
    total += count <= thresh ? count * pts : thresh * pts + (count - thresh) * pts * 0.5;
  }
  return Math.min(100, Math.round(total));
}

async function logActivity(userId: string, actionType: string, data?: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  // Log principal (horodaté)
  const key = `ff:activity-log:${userId}`;
  const log: unknown[] = JSON.parse((await kv.get(key)) || "[]");
  log.unshift({ id: genId(), actionType, createdAt: now, data });
  if (log.length > 200) log.splice(200);
  await kv.set(key, JSON.stringify(log));
  // Index journalier enrichi (constance + diagramme)
  const dailyKey = `ff:activity-daily:${userId}`;
  const dailyLog: DailyEntry[] = JSON.parse((await kv.get(dailyKey)) || "[]");
  const todayEntry = dailyLog.find((e) => e.date === today);
  const scoreKey = SCORE_CAT[actionType];
  if (todayEntry) {
    todayEntry.count++;
    if (!todayEntry.actions.includes(actionType)) todayEntry.actions.push(actionType);
    if (scoreKey) (todayEntry as Record<string, number>)[scoreKey] = ((todayEntry as Record<string, number>)[scoreKey] || 0) + 1;
    todayEntry.score = computeDailyScore(todayEntry);
  } else {
    const ne: DailyEntry = { date: today, count: 1, actions: [actionType], posts: 0, goalProgress: 0, comments: 0, reactions: 0, communityMessages: 0, follows: 0, score: 0 };
    if (scoreKey) (ne as Record<string, number>)[scoreKey] = 1;
    ne.score = computeDailyScore(ne);
    dailyLog.unshift(ne);
    if (dailyLog.length > 365) dailyLog.splice(365);
  }
  await kv.set(dailyKey, JSON.stringify(dailyLog));
}

async function addProgressScore(userId: string, points: number): Promise<number> {
  const key = `ff:progress:${userId}`;
  const raw = await kv.get(key);
  const prog = raw ? JSON.parse(raw) : { userId, score: 0, lastUpdate: new Date().toISOString() };
  prog.score = Math.min(100, Math.max(0, (prog.score || 0) + points));
  prog.lastUpdate = new Date().toISOString();
  await kv.set(key, JSON.stringify(prog));
  // Snapshot journalier pour diagramme
  const today = new Date().toISOString().slice(0, 10);
  const histKey = `ff:progress-history:${userId}`;
  const history: Array<{ date: string; score: number }> = JSON.parse((await kv.get(histKey)) || "[]");
  const hidx = history.findIndex((h) => h.date === today);
  if (hidx >= 0) { history[hidx].score = prog.score; } else { history.unshift({ date: today, score: prog.score }); if (history.length > 365) history.splice(365); }
  await kv.set(histKey, JSON.stringify(history));
  return prog.score;
}

async function awardFcoin(userId: string, fcoinId: string, silent = false): Promise<boolean> {
  const key = `ff:fcoins:${userId}`;
  const existing: string[] = JSON.parse((await kv.get(key)) || "[]");
  if (existing.includes(fcoinId)) return false;
  existing.push(fcoinId);
  await kv.set(key, JSON.stringify(existing));
  // Stocker l'horodatage d'obtention pour affichage dans le profil
  const histKey = `ff:fcoins-history:${userId}`;
  const history: Array<{ id: string; earnedAt: string }> = JSON.parse((await kv.get(histKey)) || "[]");
  if (!history.find((h) => h.id === fcoinId)) {
    history.unshift({ id: fcoinId, earnedAt: new Date().toISOString() });
    await kv.set(histKey, JSON.stringify(history));
  }
  // silent=true lors de l'inscription : on n'alimente pas l'activité/score
  // pour éviter qu'un nouveau compte ait déjà des données dans le diagramme
  if (!silent) {
    await logActivity(userId, "fcoin_earned", { fcoinId, name: FCOIN_DEFS[fcoinId]?.name });
    await addProgressScore(userId, 8);
  }
  console.log(`Fcoin: user=${userId}, id=${fcoinId}, silent=${silent}`);
  return true;
}

async function checkAndAwardFcoins(userId: string): Promise<string[]> {
  const awarded: string[] = [];
  const try_ = async (id: string) => { if (await awardFcoin(userId, id)) awarded.push(id); };

  const streakRaw = await kv.get(`ff:streak:${userId}`);
  if (streakRaw) {
    const s = JSON.parse(streakRaw);
    if (s.currentStreak >= 2)  await try_("streak_2");
    if (s.currentStreak >= 7)  await try_("streak_7");
    if (s.currentStreak >= 30) await try_("streak_30");
  }

  const postIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${userId}`)) || "[]");
  if (postIds.length >= 1)  await try_("posts_1");
  if (postIds.length >= 10) await try_("posts_10");
  if (postIds.length >= 50) await try_("posts_50");

  const followingIds: string[] = JSON.parse((await kv.get(`ff:following:${userId}`)) || "[]");
  if (followingIds.length >= 10) await try_("social_10follows");

  const communityIds: string[] = JSON.parse((await kv.get(`ff:user-communities:${userId}`)) || "[]");
  if (communityIds.length >= 1) await try_("community_join");

  const msgCount = parseInt((await kv.get(`ff:msg-count:${userId}`)) || "0");
  if (msgCount >= 20)  await try_("community_20msg");
  if (msgCount >= 100) await try_("community_100msg");

  const cmtCount = parseInt((await kv.get(`ff:comment-count:${userId}`)) || "0");
  if (cmtCount >= 10) await try_("social_10comments");

  // Early Builder / Pioneer : basé sur le numéro d'inscription (pas sur les posts)
  // ff:user-number:<username> est écrit à l'inscription
  const userNumRaw = await kv.get(`ff:user-number:${userId}`);
  if (userNumRaw) {
    const userNum = parseInt(userNumRaw);
    if (userNum <= 500)  await try_("rare_early");   // Early Builder
    if (userNum <= 1000) await try_("rare_pioneer");  // Pioneer
  }

  return awarded;
}

// POST /progression/checkin
app.post("/make-server-218684af/progression/checkin", async (c) => {
  try {
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const today = todayStr();
    const key = `ff:streak:${userId}`;
    const raw = await kv.get(key);
    const streak = raw ? JSON.parse(raw) : { userId, currentStreak: 0, lastActiveDate: "", longestStreak: 0, totalDaysActive: 0 };
    if (streak.lastActiveDate === today) return c.json({ success: true, streak, alreadyCheckedIn: true });
    const diff = streak.lastActiveDate ? daysDiff(today, streak.lastActiveDate) : 1;
    streak.currentStreak = diff === 1 ? streak.currentStreak + 1 : diff > 3 ? 1 : Math.max(1, streak.currentStreak);
    streak.lastActiveDate = today;
    streak.longestStreak = Math.max(streak.longestStreak || 0, streak.currentStreak);
    streak.totalDaysActive = (streak.totalDaysActive || 0) + 1;
    await kv.set(key, JSON.stringify(streak));
    await logActivity(userId, "checkin", { streak: streak.currentStreak });
    await addProgressScore(userId, 2);
    const awarded = await checkAndAwardFcoins(userId);
    const profileRaw = await kv.get(`ff:profile:${userId}`);
    if (profileRaw) { const p = JSON.parse(profileRaw); p.streak = streak.currentStreak; await kv.set(`ff:profile:${userId}`, JSON.stringify(p)); }
    console.log(`Checkin: user=${userId}, streak=${streak.currentStreak}`);
    return c.json({ success: true, streak, newFcoins: awarded, alreadyCheckedIn: false });
  } catch (err) { return c.json({ error: `Échec checkin: ${err}` }, 500); }
});

// POST /progression/post-checkin — après publication d'un post
app.post("/make-server-218684af/progression/post-checkin", async (c) => {
  try {
    const { userId, postId } = await c.req.json();
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const today = todayStr();
    const key = `ff:streak:${userId}`;
    const raw = await kv.get(key);
    const streak = raw ? JSON.parse(raw) : { userId, currentStreak: 0, lastActiveDate: "", longestStreak: 0, totalDaysActive: 0 };
    streak.postedToday = true;
    streak.lastPostDate = today;
    if (streak.lastActiveDate !== today) {
      const diff = streak.lastActiveDate ? daysDiff(today, streak.lastActiveDate) : 1;
      streak.currentStreak = diff === 1 ? streak.currentStreak + 1 : diff > 3 ? 1 : Math.max(1, streak.currentStreak);
      streak.lastActiveDate = today;
      streak.longestStreak = Math.max(streak.longestStreak || 0, streak.currentStreak);
      streak.totalDaysActive = (streak.totalDaysActive || 0) + 1;
    }
    await kv.set(key, JSON.stringify(streak));
    await logActivity(userId, "post", { postId });
    await addProgressScore(userId, 5);
    const awarded = await checkAndAwardFcoins(userId);
    const profileRaw = await kv.get(`ff:profile:${userId}`);
    if (profileRaw) { const p = JSON.parse(profileRaw); p.streak = streak.currentStreak; await kv.set(`ff:profile:${userId}`, JSON.stringify(p)); }
    console.log(`Post-checkin: user=${userId}, streak=${streak.currentStreak}`);
    return c.json({ success: true, streak, newFcoins: awarded });
  } catch (err) { return c.json({ error: `Échec post-checkin: ${err}` }, 500); }
});

// GET /progression/:userId — État complet
app.get("/make-server-218684af/progression/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const [streakRaw, fcoinsRaw, progressRaw, goalsRaw, logRaw] = await Promise.all([
      kv.get(`ff:streak:${userId}`), kv.get(`ff:fcoins:${userId}`),
      kv.get(`ff:progress:${userId}`), kv.get(`ff:goals:${userId}`),
      kv.get(`ff:activity-log:${userId}`),
    ]);
    const postCount = JSON.parse((await kv.get(`ff:posts:user:${userId}`)) || "[]").length;
    const followerCount = JSON.parse((await kv.get(`ff:followers:${userId}`)) || "[]").length;
    const followingCount = JSON.parse((await kv.get(`ff:following:${userId}`)) || "[]").length;
    return c.json({
      streak: streakRaw ? JSON.parse(streakRaw) : { currentStreak: 0, longestStreak: 0, totalDaysActive: 0 },
      fcoins: fcoinsRaw ? JSON.parse(fcoinsRaw) : [],
      fcoinDefs: FCOIN_DEFS,
      progress: progressRaw ? JSON.parse(progressRaw) : { score: 0 },
      goals: goalsRaw ? JSON.parse(goalsRaw) : [],
      stats: { postCount, followerCount, followingCount },
      recentActivity: logRaw ? JSON.parse(logRaw).slice(0, 10) : [],
    });
  } catch (err) { return c.json({ error: `Échec progression: ${err}` }, 500); }
});

// POST /progression/activity — Logger une action
app.post("/make-server-218684af/progression/activity", async (c) => {
  try {
    const { userId, actionType, data } = await c.req.json();
    if (!userId || !actionType) return c.json({ error: "userId et actionType requis." }, 400);
    await logActivity(userId, actionType, data);
    const pts: Record<string, number> = { post: 5, comment: 2, community_message: 2, goal_update: 4, profile_visit: 1, follow: 2, community_join: 5 };
    const newScore = await addProgressScore(userId, pts[actionType] ?? 1);
    if (actionType === "community_message") {
      const cnt = parseInt((await kv.get(`ff:msg-count:${userId}`)) || "0") + 1;
      await kv.set(`ff:msg-count:${userId}`, String(cnt));
    }
    if (actionType === "comment") {
      const cnt = parseInt((await kv.get(`ff:comment-count:${userId}`)) || "0") + 1;
      await kv.set(`ff:comment-count:${userId}`, String(cnt));
    }
    const awarded = await checkAndAwardFcoins(userId);
    return c.json({ success: true, newScore, newFcoins: awarded });
  } catch (err) { return c.json({ error: `Échec activité: ${err}` }, 500); }
});

// POST /progression/goals — Créer/mettre à jour objectif
app.post("/make-server-218684af/progression/goals", async (c) => {
  try {
    const { userId, goalId, title, description, progress, duration_type } = await c.req.json();
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const key = `ff:goals:${userId}`;
    // Migration automatique des anciens objectifs au nouveau modèle
    const rawGoals: Record<string, unknown>[] = JSON.parse((await kv.get(key)) || "[]");
    const goals: GoalObj[] = rawGoals.map(migrateGoalObj);
    const now = new Date().toISOString();
    if (goalId) {
      const g = goals.find((x) => x.id === goalId);
      if (g) {
        if (title !== undefined) g.title = title;
        if (description !== undefined) g.description = description;
        if (progress !== undefined) {
          const prev = g.progress;
          // Mise à jour directe (manuelle) — pas de clamp à 100
          const newPct = Math.max(0, progress);
          g.progress = newPct;
          g.progress_percentage = newPct / 100;
          g.progress_score = Math.round(g.progress_percentage * g.progress_max);
          if (newPct >= 100 && prev < 100) {
            g.status = "accompli";
            g.completedAt = now;
            await awardFcoin(userId, "rare_first_goal");
            await addProgressScore(userId, 20);
            await logActivity(userId, "goal_completed", { goalId, title: g.title });
          } else if (newPct > prev) {
            await addProgressScore(userId, 3);
            await logActivity(userId, "goal_update", { goalId, progress: g.progress });
          }
        }
        if (!g.status) g.status = g.progress >= 100 ? "accompli" : "en_cours";
        g.updatedAt = now;
      }
    } else {
      // Création d'un nouvel objectif avec durée
      const durationType = (duration_type as string) ?? "3_mois";
      const durationDays = getDurationDays(durationType);
      const progressMax = getProgressMax(durationDays);
      const initPct = progress ?? 0;
      goals.unshift({
        id: genId(), title: title ?? "Mon objectif", description: description ?? "",
        progress: initPct, status: "en_cours", createdAt: now, updatedAt: now,
        duration_type: durationType, duration_days: durationDays,
        progress_score: 0, progress_max: progressMax, progress_percentage: 0,
      } as GoalObj);
      // Ne pas appeler addProgressScore ni logActivity pour goal_created :
      // cela évite qu'un nouveau compte ait déjà des données dans le diagramme dès le jour 0.
      // (La progression réelle commence avec les posts, rapports et interactions.)
    }
    // Normalise status pour les objectifs existants
    for (const g of goals) { if (!g.status) g.status = g.progress >= 100 ? "accompli" : "en_cours"; }
    await kv.set(key, JSON.stringify(goals));
    return c.json({ success: true, goals });
  } catch (err) { return c.json({ error: `Échec objectif: ${err}` }, 500); }
});

// GET /progression/:userId/goals
app.get("/make-server-218684af/progression/:userId/goals", async (c) => {
  try {
    const userId = c.req.param("userId");
    const [raw, selectedRaw] = await Promise.all([
      kv.get(`ff:goals:${userId}`),
      kv.get(`ff:goals-selected:${userId}`),
    ]);
    // Migration automatique au nouveau modèle durée/score
    const rawGoals: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
    const goals: GoalObj[] = rawGoals.map(migrateGoalObj);
    const selectedGoalId = selectedRaw ?? null;
    return c.json({ goals, total: goals.length, selectedGoalId });
  } catch (err) { return c.json({ error: `Échec objectifs: ${err}` }, 500); }
});

// PUT /progression/goals/:goalId/activate — Définir l'objectif actif sur le profil
app.put("/make-server-218684af/progression/goals/:goalId/activate", async (c) => {
  try {
    const goalId = c.req.param("goalId");
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const raw = await kv.get(`ff:goals:${userId}`);
    const goals: Array<{ id: string; status: string }> = raw ? JSON.parse(raw) : [];
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return c.json({ error: "Objectif introuvable." }, 404);
    await kv.set(`ff:goals-selected:${userId}`, goalId);
    console.log(`Objectif activé: user=${userId}, goalId=${goalId}`);
    return c.json({ success: true, selectedGoalId: goalId });
  } catch (err) { return c.json({ error: `Échec activation objectif: ${err}` }, 500); }
});

// DELETE /progression/goals/:goalId — Supprimer un objectif
app.delete("/make-server-218684af/progression/goals/:goalId", async (c) => {
  try {
    const goalId = c.req.param("goalId");
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const key = `ff:goals:${userId}`;
    const raw = await kv.get(key);
    const goals: GoalObj[] = raw ? (JSON.parse(raw) as Record<string, unknown>[]).map(migrateGoalObj) : [];
    if (goals.length <= 1) return c.json({ error: "Impossible de supprimer le dernier objectif." }, 400);
    const filtered = goals.filter((g) => g.id !== goalId);
    if (filtered.length === goals.length) return c.json({ error: "Objectif introuvable." }, 404);
    await kv.set(key, JSON.stringify(filtered));
    return c.json({ success: true, goals: filtered });
  } catch (err) { return c.json({ error: `Échec suppression objectif: ${err}` }, 500); }
});

// GET /batch-goal-progress — Progression de l'objectif principal pour plusieurs utilisateurs
app.get("/make-server-218684af/batch-goal-progress", async (c) => {
  try {
    const usernamesParam = c.req.query("usernames") || "";
    const usernames = usernamesParam.split(",").map((u: string) => u.trim()).filter(Boolean);
    const result: Record<string, { progress: number; title: string; goalId: string | null }> = {};
    for (const username of usernames) {
      const raw = await kv.get(`ff:goals:${username}`);
      // Migration automatique au nouveau modèle
      const rawGoals: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
      const goals: GoalObj[] = rawGoals.map(migrateGoalObj);
      // Priorité : premier objectif en cours, sinon premier objectif tout statut
      const primary = goals.find((g) => g.status === "en_cours") || goals[0] || null;

      if (primary) {
        result[username] = {
          progress: Math.round(primary.progress ?? 0), // peut dépasser 100
          title: primary.title ?? "",
          goalId: primary.id ?? null,
        };
      } else {
        // Fallback : lire progressPct + objective directement depuis le profil
        const profileRaw = await kv.get(`ff:profile:${username}`);
        if (profileRaw) {
          const prof = JSON.parse(profileRaw);
          result[username] = {
            progress: prof.progressPct ?? 0,
            title: prof.objective ?? "",
            goalId: null,
          };
        } else {
          result[username] = { progress: 0, title: "", goalId: null };
        }
      }
    }
    return c.json(result);
  } catch (err) {
    console.log("Erreur batch-goal-progress:", err);
    return c.json({ error: `Échec batch-goal-progress: ${err}` }, 500);
  }
});

// GET /progression/:userId/daily-status
app.get("/make-server-218684af/progression/:userId/daily-status", async (c) => {
  try {
    const userId = c.req.param("userId");
    const todayUTC = new Date().toISOString().slice(0, 10);
    const lastDate = await kv.get(`ff:daily-progress-date:${userId}`);
    const alreadySubmitted = lastDate === todayUTC;
    const now2 = new Date();
    const midnight = new Date(now2);
    midnight.setUTCHours(24, 0, 0, 0);
    const secondsUntilReset = Math.max(0, Math.floor((midnight.getTime() - now2.getTime()) / 1000));
    return c.json({ alreadySubmitted, lastDate, todayUTC, secondsUntilReset });
  } catch (err) {
    console.error("Erreur daily-status:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// POST /progression/progress-report — Rapport + analyse IA heuristique
app.post("/make-server-218684af/progression/progress-report", async (c) => {
  try {
    const { userId, goalId, responseText } = await c.req.json();
    if (!userId || !responseText?.trim()) return c.json({ error: "userId et responseText requis." }, 400);
    const now = new Date().toISOString();

    // ── Limite 1 soumission / jour (UTC) ──────────────────────────────────────
    const todayUTC = now.slice(0, 10);
    const lastDate = await kv.get(`ff:daily-progress-date:${userId}`);
    if (lastDate === todayUTC) {
      console.log(`[progress-report] Déjà soumis: userId=${userId} date=${todayUTC}`);
      return c.json({ error: "Tu as déjà partagé ton avancement aujourd'hui. Reviens demain !", alreadySubmitted: true }, 429);
    }

    const text = responseText.toLowerCase();

    // ── Analyse unifiée via detectActionScore ─────────────────────────────────
    // Un seul système pour le score goal ET pour les points de rapport (cohérence totale)
    const actionScore = detectActionScore(text, responseText.length);
    const showsProgress = actionScore !== 0; // -1 (complétion) ou > 0 = progrès détecté
    // progressPoints visible dans l'UI = score brut de l'action (min 1, max 12)
    const progressPoints = actionScore === -1 ? 12 : actionScore > 0 ? Math.min(12, actionScore) : 1;
    // posScore/negScore conservés pour compatibilité avec l'interface ProgressReport
    const POSITIVE_COMPAT = ["avancé","réussi","terminé","fait","lancé","publié","créé","développé","appris","complété","atteint","validé","réalisé","déployé","livré","écrit","codé","construit","livraison","milestone","objectif","streak","avance","continue"];
    const NEGATIVE_COMPAT = ["bloqué","rien","raté","failed","échec","pas avancé","sans progrès","aucun","impossible","abandonné"];
    const posScore = POSITIVE_COMPAT.filter((w) => text.includes(w)).length;
    const negScore = NEGATIVE_COMPAT.filter((w) => text.includes(w)).length;
    const report = { id: genId(), userId, goalId: goalId ?? null, responseText: responseText.trim(), analysis: { posScore, negScore, showsProgress, progressPoints }, createdAt: now };
    const rKey = `ff:progress-reports:${userId}`;
    const reports: unknown[] = JSON.parse((await kv.get(rKey)) || "[]");
    reports.unshift(report);
    if (reports.length > 50) reports.splice(50);
    await kv.set(rKey, JSON.stringify(reports));
    const newScore = await addProgressScore(userId, progressPoints);
    await logActivity(userId, "progress_report", { showsProgress, progressPoints });

    // ── Extraire les heures de DeepWork depuis le texte ──────────────────────
    const hourPatterns = [
      /(\d+(?:[.,]\d+)?)\s*h(?:eures?)?\s*(?:de\s*)?(?:deep\s*work|focus|travail\s*profond|concentration|boulot|code|dev)/gi,
      /(?:deep\s*work|focus|travail\s*profond|session)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?)\s*h(?:eures?)?/gi,
      /(\d+(?:[.,]\d+)?)\s*h(?:eures?)?\s*(?:de\s*)?(?:deep|sprint|session\s*focus)/gi,
    ];
    let extractedHours = 0;
    for (const pattern of hourPatterns) {
      let match;
      while ((match = pattern.exec(responseText)) !== null) {
        extractedHours += parseFloat(match[1].replace(",", "."));
      }
    }
    if (extractedHours === 0 && (text.includes("deepwork") || text.includes("deep work") || text.includes("focus"))) {
      const genericHours = /(\d+(?:[.,]\d+)?)\s*h/gi;
      let m;
      while ((m = genericHours.exec(responseText)) !== null) {
        extractedHours += parseFloat(m[1].replace(",", "."));
      }
    }
    extractedHours = Math.min(24, extractedHours);
    if (extractedHours > 0) {
      const dwKey = `ff:deepwork-hours:${userId}`;
      const current = parseFloat((await kv.get(dwKey)) || "0");
      await kv.set(dwKey, String(Math.round((current + extractedHours) * 10) / 10));
      console.log(`DeepWork: user=${userId}, +${extractedHours}h, total=${current + extractedHours}h`);
    }

    // ── Analyse IA → mise à jour de l'objectif (barre de progression) ────────
    let goalProgress: number | null = null;
    let goalCompleted = false;
    try {
      const gRawR = await kv.get(`ff:goals:${userId}`);
      if (gRawR) {
        // Migration automatique au nouveau modèle durée/score
        const goalsR: GoalObj[] = (JSON.parse(gRawR) as Record<string, unknown>[]).map(migrateGoalObj);
        // Objectif ciblé : goalId fourni ou premier objectif en cours
        const gR = (goalId ? goalsR.find((x) => x.id === goalId) : null)
          ?? goalsR.find((x) => x.status !== "accompli")
          ?? goalsR[0];

        if (gR && gR.status !== "accompli") {
          // actionScore déjà calculé plus haut (système unifié)

          if (actionScore === -1) {
            // Complétion explicite → forcer progress_percentage = 1.0 (100%)
            gR.progress_percentage = 1.0;
            gR.progress_score = gR.progress_max; // aligner score sur le max
            gR.progress = 100;
            gR.status = "accompli";
            gR.completedAt = now;
            gR.updatedAt = now;
            goalCompleted = true;
            await awardFcoin(userId, "rare_first_goal");
            await addProgressScore(userId, 20);
            await logActivity(userId, "goal_completed", { goalId: gR.id, title: gR.title });
            console.log(`[progress-report] Objectif accompli (complétion explicite): user=${userId}, goal=${gR.id}`);
          } else if (actionScore > 0) {
            // Progression normale : appliquer coefficient durée, pas de clamp à 100
            const coeff = getDurationCoeff(gR.duration_days);
            const finalScore = Math.round(actionScore * coeff);
            const prevScore = gR.progress_score;
            const prevPct = gR.progress;
            gR.progress_score = prevScore + finalScore;
            gR.progress_percentage = gR.progress_score / gR.progress_max;
            gR.progress = Math.round(gR.progress_percentage * 100); // peut dépasser 100
            gR.updatedAt = now;
            console.log(`[progress-report] Goal boost: user=${userId}, action=${actionScore}pts×${coeff}=${finalScore}, score ${prevScore}→${gR.progress_score}, ${prevPct}%→${gR.progress}%`);
          }
          // si actionScore === 0 → aucune action détectée → barre inchangée

          goalProgress = gR.progress;
          await kv.set(`ff:goals:${userId}`, JSON.stringify(goalsR));
          // Sync progressPct profil (peut dépasser 100)
          const pRawR = await kv.get(`ff:profile:${userId}`);
          if (pRawR) { const pR = JSON.parse(pRawR); pR.progressPct = gR.progress; await kv.set(`ff:profile:${userId}`, JSON.stringify(pR)); }
        }
      }
    } catch (e) { console.log("Erreur analyse goal progress-report:", e); }

    // ── Marquer la date du jour pour la limite quotidienne ────────────────────
    await kv.set(`ff:daily-progress-date:${userId}`, todayUTC);
    console.log(`Progress report: user=${userId}, showsProgress=${showsProgress}, pts=${progressPoints}, goalProgress=${goalProgress}`);
    return c.json({ success: true, report, analysis: report.analysis, newProgressScore: newScore, goalProgress, goalCompleted });
  } catch (err) { return c.json({ error: `Échec rapport: ${err}` }, 500); }
});

// GET /progression/:userId/reports
app.get("/make-server-218684af/progression/:userId/reports", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "10", 10);
    const raw = await kv.get(`ff:progress-reports:${c.req.param("userId")}`);
    const reports = raw ? JSON.parse(raw) : [];
    return c.json({ reports: reports.slice(0, limit), total: reports.length });
  } catch (err) { return c.json({ error: `Échec rapports: ${err}` }, 500); }
});

// Conditions lisibles pour chaque Fcoin
const FCOIN_CONDITIONS: Record<string, string> = {
  streak_2:          "2 jours de streak consécutifs",
  streak_7:          "7 jours de streak consécutifs",
  streak_30:         "30 jours de streak consécutifs",
  posts_1:           "1er post publié",
  posts_10:          "10 posts publiés",
  posts_50:          "50 posts publiés",
  reactions_first:   "Premier post avec une réaction",
  reactions_100:     "100 réactions reçues",
  reactions_1000:    "1000 réactions reçues",
  community_join:    "Rejoint une première communauté",
  community_20msg:   "20 messages dans les communautés",
  community_100msg:  "100 messages dans les communautés",
  rare_early:        "Parmi les premiers utilisateurs",
  rare_pioneer:      "Utilisateur actif précoce",
  rare_first_goal:   "Premier objectif atteint à 100 %",
  social_10profiles: "Visité 10 profils différents",
  social_10comments: "10 commentaires publiés",
  social_10follows:  "Suivi 10 utilisateurs",
};

// GET /progression/:userId/fcoins
app.get("/make-server-218684af/progression/:userId/fcoins", async (c) => {
  try {
    const userId = c.req.param("userId");
    const raw = await kv.get(`ff:fcoins:${userId}`);
    const earned: string[] = raw ? JSON.parse(raw) : [];

    // Récupérer les horodatages (ff:fcoins-history) ou fallback depuis activity-log
    const histRaw = await kv.get(`ff:fcoins-history:${userId}`);
    const history: Array<{ id: string; earnedAt: string }> = histRaw ? JSON.parse(histRaw) : [];

    // Si pas d'historique, construire depuis l'activity-log (migration rétroactive)
    if (history.length === 0 && earned.length > 0) {
      const logRaw = await kv.get(`ff:activity-log:${userId}`);
      const log: Array<{ actionType: string; createdAt: string; data?: { fcoinId?: string } }> = logRaw ? JSON.parse(logRaw) : [];
      const fcoinEvents = log.filter((e) => e.actionType === "fcoin_earned" && e.data?.fcoinId);
      for (const ev of fcoinEvents) {
        const fid = ev.data!.fcoinId!;
        if (!history.find((h) => h.id === fid)) {
          history.push({ id: fid, earnedAt: ev.createdAt });
        }
      }
      // Pour les fcoins sans log, fallback à la date du profil
      const profileRaw = await kv.get(`ff:profile:${userId}`);
      const profileDate = profileRaw ? (JSON.parse(profileRaw).createdAt || new Date().toISOString()) : new Date().toISOString();
      for (const fid of earned) {
        if (!history.find((h) => h.id === fid)) {
          history.push({ id: fid, earnedAt: profileDate });
        }
      }
      // Sauvegarder la migration
      await kv.set(`ff:fcoins-history:${userId}`, JSON.stringify(history));
    }

    // Construire la liste enrichie des fcoins gagnés
    const earnedHistory = earned.map((fid) => {
      const histEntry = history.find((h) => h.id === fid);
      const def = FCOIN_DEFS[fid] || { category: "unknown", name: fid };
      return {
        id: fid,
        name: def.name,
        category: def.category,
        condition: FCOIN_CONDITIONS[fid] || "Condition inconnue",
        earnedAt: histEntry?.earnedAt || null,
      };
    }).sort((a, b) => {
      // Trier du plus récent au plus ancien
      if (!a.earnedAt) return 1;
      if (!b.earnedAt) return -1;
      return b.earnedAt.localeCompare(a.earnedAt);
    });

    console.log(`GET fcoins/${userId}: ${earned.length} fcoins gagnés`);
    return c.json({ earned, earnedHistory, total: earned.length, definitions: FCOIN_DEFS });
  } catch (err) { return c.json({ error: `Échec fcoins: ${err}` }, 500); }
});

// ════════════════════════════════════════════════════════════════════════════
// DIAGRAMME D'ÉVOLUTION + STATS ÉTENDUES
// ════════════════════════════════════════════════════════════════════════════

// GET /progression/:userId/chart?filter=all|30d|week
// Diagramme d'évolution basé sur les scores journaliers (activité réelle).
// Ne génère jamais de données fictives — seule l'activité réelle est affichée.
app.get("/make-server-218684af/progression/:userId/chart", async (c) => {
  try {
    const userId = c.req.param("userId");
    const filter = c.req.query("filter") || "30d";

    // ── Date de création du compte ────────────────────────────────────────────
    const usernameC = await resolveUsername(userId);
    const profileKeyC = usernameC ? `ff:profile:${usernameC}` : `ff:profile:${userId}`;
    const profileRawC = await kv.get(profileKeyC);
    const accountCreatedAt: string | null = profileRawC ? (JSON.parse(profileRawC).createdAt ?? null) : null;
    const accountStartDate = accountCreatedAt ? accountCreatedAt.slice(0, 10) : null;

    // ── Charger et fusionner les daily logs (supabaseId + username) ───────────
    const [dl1c, dl2c] = await Promise.all([
      kv.get(`ff:activity-daily:${userId}`).then((r) => (r ? JSON.parse(r) : []) as DailyEntry[]),
      usernameC && usernameC !== userId
        ? kv.get(`ff:activity-daily:${usernameC}`).then((r) => (r ? JSON.parse(r) : []) as DailyEntry[])
        : Promise.resolve([] as DailyEntry[]),
    ]);
    const dmapC: Record<string, DailyEntry> = {};
    for (const e of [...dl1c, ...dl2c]) {
      const ex = dmapC[e.date];
      if (!ex) { dmapC[e.date] = { ...e }; }
      else {
        ex.count             += e.count || 0;
        ex.posts             = (ex.posts || 0)             + (e.posts || 0);
        ex.goalProgress      = (ex.goalProgress || 0)      + (e.goalProgress || 0);
        ex.comments          = (ex.comments || 0)          + (e.comments || 0);
        ex.reactions         = (ex.reactions || 0)         + (e.reactions || 0);
        ex.communityMessages = (ex.communityMessages || 0) + (e.communityMessages || 0);
        ex.follows           = (ex.follows || 0)           + (e.follows || 0);
        ex.score = computeDailyScore(ex);
      }
    }
    // Map date → score d'engagement journalier
    const scoreMap: Record<string, number> = {};
    for (const [date, e] of Object.entries(dmapC)) {
      scoreMap[date] = e.score !== undefined ? e.score : computeDailyScore(e);
    }

    // ── Borne de dates selon le filtre ────────────────────────────────────────
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let rangeStart: string;

    if (filter === "week") {
      const dow = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      rangeStart = weekStart.toISOString().slice(0, 10);
    } else if (filter === "30d") {
      const d30 = new Date(now); d30.setDate(now.getDate() - 29);
      rangeStart = d30.toISOString().slice(0, 10);
    } else {
      // "all" — depuis le premier jour d'activité ou création du compte
      const firstActivity = Object.keys(scoreMap).sort()[0] || todayStr;
      rangeStart = [firstActivity, accountStartDate].filter(Boolean).sort()[0] as string;
    }

    // Respecter la date de création du compte (jamais avant)
    if (accountStartDate && rangeStart < accountStartDate) rangeStart = accountStartDate;
    // Ne pas afficher de données avant la première activité réelle
    const firstRealActivity = Object.keys(scoreMap).filter((d) => d >= rangeStart).sort()[0];
    if (firstRealActivity && firstRealActivity > rangeStart) rangeStart = firstRealActivity;

    // ── Générer la séquence de dates (activité réelle uniquement) ─────────────
    // On inclut toutes les dates entre rangeStart et aujourd'hui.
    // Les jours sans activité dans la période → score = 0 (inactivité réelle).
    const dateDates: string[] = [];
    if (rangeStart <= todayStr) {
      const cur = new Date(rangeStart + "T12:00:00Z");
      const end = new Date(todayStr + "T12:00:00Z");
      while (cur <= end) {
        dateDates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }

    // ── Formatter les labels ──────────────────────────────────────────────────
    const formatLabel = (dateStr: string, idx: number, total: number): string => {
      const d = new Date(dateStr + "T12:00:00Z");
      if (filter === "week") {
        return ["L", "M", "Me", "J", "V", "S", "D"][d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
      }
      if (filter === "30d") {
        // Label tous les 5 jours pour éviter la surcharge
        if (idx === 0 || idx === total - 1 || idx % 5 === 0)
          return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
        return "";
      }
      // "all" : label mensuel
      if (d.getUTCDate() === 1 || idx === 0 || idx === total - 1)
        return ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][d.getUTCMonth()];
      return "";
    };

    const points = dateDates.map((date, i) => ({
      label: formatLabel(date, i, dateDates.length),
      value: scoreMap[date] ?? 0,
      date,
    }));

    console.log(`GET progression/${userId}/chart?filter=${filter} — ${points.length} points, range=[${rangeStart}→${todayStr}]`);
    return c.json({ points, filter, total: points.length, accountStartDate });
  } catch (err) {
    return c.json({ error: `Échec chart: ${err}` }, 500);
  }
});

// GET /progression/:userId/extended-stats
// Constance, objectifs accomplis/en cours, jours sur FF
app.get("/make-server-218684af/progression/:userId/extended-stats", async (c) => {
  try {
    const userId = c.req.param("userId");

    // Goals stats
    const goalsRaw = await kv.get(`ff:goals:${userId}`);
    const goals: Array<{ progress: number; status?: string }> = goalsRaw ? JSON.parse(goalsRaw) : [];
    // Normalise status
    const goalsAccomplis = goals.filter((g) => (g.status === "accompli") || g.progress >= 100).length;
    const goalsEnCours = goals.filter((g) => (g.status !== "accompli") && g.progress < 100).length;

    // ── Constance (nouveau calcul dynamique) ──────────────────────────────────
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Charger daily logs depuis les deux clés possibles (supabaseId + username)
    const username2 = await resolveUsername(userId);
    const [dl1, dl2] = await Promise.all([
      kv.get(`ff:activity-daily:${userId}`).then((r) => (r ? JSON.parse(r) : []) as DailyEntry[]),
      username2 && username2 !== userId
        ? kv.get(`ff:activity-daily:${username2}`).then((r) => (r ? JSON.parse(r) : []) as DailyEntry[])
        : Promise.resolve([] as DailyEntry[]),
    ]);
    // Fusion des entrées par date (somme des compteurs)
    const dmap: Record<string, DailyEntry> = {};
    for (const e of [...dl1, ...dl2]) {
      const ex = dmap[e.date];
      if (!ex) { dmap[e.date] = { ...e }; }
      else {
        ex.count             += e.count || 0;
        ex.posts             = (ex.posts || 0)             + (e.posts || 0);
        ex.goalProgress      = (ex.goalProgress || 0)      + (e.goalProgress || 0);
        ex.comments          = (ex.comments || 0)          + (e.comments || 0);
        ex.reactions         = (ex.reactions || 0)         + (e.reactions || 0);
        ex.communityMessages = (ex.communityMessages || 0) + (e.communityMessages || 0);
        ex.follows           = (ex.follows || 0)           + (e.follows || 0);
        ex.score = computeDailyScore(ex);
      }
    }
    const dailyLog: DailyEntry[] = Object.values(dmap).sort((a, b) => a.date.localeCompare(b.date));

    const constanceActiveDays = dailyLog.length;
    const totalActions = dailyLog.reduce((sum, d) => sum + (d.count || 0), 0);

    // Score journalier pour les calculs de moyenne
    const getScore = (e: DailyEntry) => e.score !== undefined ? e.score : computeDailyScore(e);
    const last7 = dailyLog.slice(-7);
    const avg7  = last7.length > 0 ? last7.reduce((s, e) => s + getScore(e), 0) / last7.length : 0;
    const last3 = dailyLog.slice(-3);
    const avg3  = last3.length > 0 ? last3.reduce((s, e) => s + getScore(e), 0) / last3.length : 0;
    const todayEntry2 = dailyLog.find((d) => d.date === todayStr);
    const todayScore  = todayEntry2 ? getScore(todayEntry2) : 0;
    const variation   = todayScore - avg3;
    const constanceScore = Math.max(0, Math.min(100, Math.round(avg7 + variation * 0.3)));

    // Variation UI (↑↓ affiché dans la carte Constance)
    const limit30 = new Date(now); limit30.setDate(now.getDate() - 29);
    const limit30Str = limit30.toISOString().slice(0, 10);

    // Jours sur FF depuis createdAt du profil
    const profileRaw = await kv.get(`ff:profile:${userId}`);
    let daysOnFF = 1;
    let accountCreatedAt: string | null = null;
    if (profileRaw) {
      const profile = JSON.parse(profileRaw);
      accountCreatedAt = profile.createdAt || null;
      if (accountCreatedAt) {
        const diffMs = Date.now() - new Date(accountCreatedAt).getTime();
        daysOnFF = Math.max(1, Math.floor(diffMs / 86400000));
      } else {
        daysOnFF = profile.daysOnFF || 1;
      }
    }

    // Score de progression courant
    const progressRaw = await kv.get(`ff:progress:${userId}`);
    const progressScore: number = progressRaw ? JSON.parse(progressRaw).score : 0;

    // Streak
    const streakRaw = await kv.get(`ff:streak:${userId}`);
    const streak = streakRaw ? JSON.parse(streakRaw) : { currentStreak: 0, longestStreak: 0, totalDaysActive: 0 };

    // DeepWork hours total
    const deepworkRaw = await kv.get(`ff:deepwork-hours:${userId}`);
    const deepworkHours: number = deepworkRaw ? parseFloat(deepworkRaw) : 0;

    // Variation de constance (composante dynamique du jour vs moyenne 3j)
    const constanceVariation = Math.round(variation * 0.3); // identique au delta dans le score final

    console.log(`GET progression/${userId}/extended-stats`);
    return c.json({
      goalsAccomplis,
      goalsEnCours,
      constanceActiveDays,
      constanceScore,
      constanceVariation,
      totalActions,
      daysOnFF,
      accountCreatedAt,
      progressScore,
      deepworkHours,
      streak,
    });
  } catch (err) {
    return c.json({ error: `Échec extended-stats: ${err}` }, 500);
  }
});

// ═══════════════════════���════════════════════════════════════════════════════
// ADMIN — Inventaire et purge des données
// ════════════════════════════════════════════════════════════════════════════

// GET /admin/inventory
app.get("/make-server-218684af/admin/inventory", async (c) => {
  try {
    const rawProfiles = await kv.getByPrefix("ff:profile:");
    type ProfileEntry = { username: string; name: string; supabaseId?: string; postsCount: number; msgsCount: number; filesCount: number };
    const profileList: ProfileEntry[] = [];
    for (const raw of rawProfiles) {
      try {
        const p = JSON.parse(raw);
        const username = normalizeUsername(p.username || "");
        if (!username) continue;
        const postIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${username}`)) || "[]");
        const msgCount = parseInt((await kv.get(`ff:msg-count:${username}`)) || "0");
        profileList.push({ username, name: p.name || username, supabaseId: p.supabaseId, postsCount: postIds.length, msgsCount: msgCount, filesCount: 0 });
      } catch { /* skip */ }
    }
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    type AuthUser = { id: string; email: string; username: string; createdAt: string };
    const authUsers: AuthUser[] = [];
    if (!authErr && authData?.users) {
      for (const u of authData.users) {
        const uname = normalizeUsername((u.user_metadata?.username as string) || u.email?.split("@")[0] || "");
        authUsers.push({ id: u.id, email: u.email || "", username: uname, createdAt: u.created_at });
      }
    }
    type StorageEntry = { username: string; files: number };
    const storageByUser: StorageEntry[] = [];
    try {
      const { data: folders } = await supabaseAdmin.storage.from(PROFILE_BUCKET).list("", { limit: 200 });
      if (folders) {
        for (const folder of folders) {
          if (!folder.name) continue;
          const { data: files } = await supabaseAdmin.storage.from(PROFILE_BUCKET).list(folder.name, { limit: 200 });
          const count = files?.length || 0;
          storageByUser.push({ username: folder.name, files: count });
          const prof = profileList.find((p) => p.username === normalizeUsername(folder.name));
          if (prof) prof.filesCount = count;
        }
      }
    } catch (e) { console.log("Storage inventory error:", e); }
    const allPostIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");
    const rawCommPosts = await kv.getByPrefix("ff:comm-post:");
    const rawCommunityMsgs = await kv.getByPrefix("ff:cmsg:");
    const totals = { profiles: profileList.length, posts: allPostIds.length, communityPosts: rawCommPosts.length, communityMessages: rawCommunityMsgs.length, storageFiles: storageByUser.reduce((s, e) => s + e.files, 0), authUsers: authUsers.length };
    console.log("Admin inventory:", JSON.stringify(totals));
    return c.json({ profiles: profileList, authUsers, storageByUser, totals });
  } catch (err) {
    console.error("Admin inventory error:", err);
    return c.json({ error: `Échec inventaire: ${err}` }, 500);
  }
});

// POST /admin/migrate-user-numbers — Attribue rétroactivement les numéros d'inscription aux anciens utilisateurs
app.post("/make-server-218684af/admin/migrate-user-numbers", async (c) => {
  try {
    const rawProfiles = await kv.getByPrefix("ff:profile:");
    const profiles: Array<{ username: string; createdAt: string }> = [];
    for (const raw of rawProfiles) {
      try {
        const p = JSON.parse(raw);
        if (p.username && p.createdAt) profiles.push({ username: normalizeUsername(p.username), createdAt: p.createdAt });
      } catch { /* skip */ }
    }
    // Trier par date de création (les plus anciens en premier)
    profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let assigned = 0;
    let skipped = 0;
    // Reset le compteur
    await kv.set("ff:user-count", String(profiles.length));
    for (let i = 0; i < profiles.length; i++) {
      const { username } = profiles[i];
      const userNum = i + 1;
      const existing = await kv.get(`ff:user-number:${username}`);
      if (!existing) {
        await kv.set(`ff:user-number:${username}`, String(userNum));
        // Award badges si pas déjà attribués
        if (userNum <= 500)  await awardFcoin(username, "rare_early");
        if (userNum <= 1000) await awardFcoin(username, "rare_pioneer");
        assigned++;
      } else { skipped++; }
    }
    console.log(`[migrate-user-numbers] ${assigned} attribués, ${skipped} ignorés, total=${profiles.length}`);
    return c.json({ success: true, assigned, skipped, total: profiles.length });
  } catch (err) {
    return c.json({ error: `Erreur migration: ${err}` }, 500);
  }
});

// POST /admin/purge  —  Body: { keepUsers: string[] }
app.post("/make-server-218684af/admin/purge", async (c) => {
  try {
    const { keepUsers } = await c.req.json() as { keepUsers: string[] };
    if (!Array.isArray(keepUsers) || keepUsers.length === 0)
      return c.json({ error: "keepUsers requis." }, 400);
    const keep = new Set(keepUsers.map((u: string) => normalizeUsername(u)));
    console.log("Admin purge — keepUsers:", [...keep]);
    const report = { deletedProfiles: 0, keptProfiles: 0, deletedPosts: 0, keptPosts: 0, deletedCommunityMessages: 0, deletedCommunityPosts: 0, deletedFollowLinks: 0, deletedMemberships: 0, deletedAuthUsers: 0, deletedStorageFiles: 0, errors: [] as string[] };

    // Phase 1 — identifier les profils supprimés
    const rawProfiles = await kv.getByPrefix("ff:profile:");
    const deletedUsernames: string[] = [];
    for (const raw of rawProfiles) {
      try {
        const p = JSON.parse(raw);
        const username = normalizeUsername(p.username || "");
        if (!username) continue;
        if (keep.has(username)) report.keptProfiles++;
        else deletedUsernames.push(username);
      } catch { /* skip */ }
    }
    console.log("Profils à supprimer:", deletedUsernames);

    // Phase 2 — nettoyer par utilisateur supprimé
    for (const username of deletedUsernames) {
      try {
        const followingList: string[] = JSON.parse((await kv.get(`ff:following:${username}`)) || "[]");
        for (const followed of followingList) {
          if (keep.has(followed)) {
            const arr: string[] = JSON.parse((await kv.get(`ff:followers:${followed}`)) || "[]");
            await kv.set(`ff:followers:${followed}`, JSON.stringify(arr.filter((u) => u !== username)));
          }
          await kv.del(`ff:follow:${username}:${followed}`);
          report.deletedFollowLinks++;
        }
        const followersList: string[] = JSON.parse((await kv.get(`ff:followers:${username}`)) || "[]");
        for (const follower of followersList) {
          if (keep.has(follower)) {
            const arr: string[] = JSON.parse((await kv.get(`ff:following:${follower}`)) || "[]");
            await kv.set(`ff:following:${follower}`, JSON.stringify(arr.filter((u) => u !== username)));
          }
          await kv.del(`ff:follow:${follower}:${username}`);
          report.deletedFollowLinks++;
        }
        const communityIds: string[] = JSON.parse((await kv.get(`ff:user-communities:${username}`)) || "[]");
        for (const cId of communityIds) {
          await kv.del(`ff:community-member:${cId}:${username}`);
          const memberIds: string[] = JSON.parse((await kv.get(`ff:community-members:${cId}`)) || "[]");
          await kv.set(`ff:community-members:${cId}`, JSON.stringify(memberIds.filter((u) => u !== username)));
          report.deletedMemberships++;
        }
        for (const k of [`ff:following:${username}`,`ff:followers:${username}`,`ff:posts:user:${username}`,`ff:user-communities:${username}`,`ff:streak:${username}`,`ff:fcoins:${username}`,`ff:progress:${username}`,`ff:progress-history:${username}`,`ff:activity-log:${username}`,`ff:activity-daily:${username}`,`ff:msg-count:${username}`,`ff:comment-count:${username}`,`ff:goals:${username}`,`ff:progress-reports:${username}`]) await kv.del(k);
        await kv.del(`ff:profile:${username}`);
        report.deletedProfiles++;
      } catch (e) { report.errors.push(`Profil ${username}: ${e}`); }
    }

    // Phase 3 — purge des posts du feed
    const allPostIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");
    const survivingPostIds: string[] = [];
    for (const id of allPostIds) {
      const raw = await kv.get(`ff:post:${id}`);
      if (!raw) continue;
      const post = JSON.parse(raw);
      const author = normalizeUsername(post.username || post.user?.name || "");
      if (keep.has(author)) { survivingPostIds.push(id); report.keptPosts++; }
      else {
        const commentIds: string[] = JSON.parse((await kv.get(`ff:comments:post:${id}`)) || "[]");
        for (const cid of commentIds) await kv.del(`ff:comment:${cid}`);
        await kv.del(`ff:comments:post:${id}`);
        await kv.del(`ff:post-reactions:counts:${id}`);
        await kv.del(`ff:post:${id}`);
        report.deletedPosts++;
      }
    }
    await kv.set("ff:posts:all", JSON.stringify(survivingPostIds));
    for (const u of keep) {
      const uPosts: string[] = [];
      for (const id of survivingPostIds) {
        const raw = await kv.get(`ff:post:${id}`);
        if (!raw) continue;
        const post = JSON.parse(raw);
        if (normalizeUsername(post.username || post.user?.name || "") === u) uPosts.push(id);
      }
      await kv.set(`ff:posts:user:${u}`, JSON.stringify(uPosts));
    }

    // Phase 4 — purge des messages de communauté
    const allMsgs = await kv.getByPrefix("ff:cmsg:");
    const deletedMsgsByCommunity = new Map<string, string[]>();
    for (const raw of allMsgs) {
      try {
        const msg = JSON.parse(raw);
        if (!keep.has(normalizeUsername(msg.userId || ""))) {
          await kv.del(`ff:cmsg:${msg.id}`);
          report.deletedCommunityMessages++;
          if (msg.communityId) {
            if (!deletedMsgsByCommunity.has(msg.communityId)) deletedMsgsByCommunity.set(msg.communityId, []);
            deletedMsgsByCommunity.get(msg.communityId)!.push(msg.id);
          }
        }
      } catch { /* skip */ }
    }
    for (const [communityId, deletedIds] of deletedMsgsByCommunity) {
      const msgIds: string[] = JSON.parse((await kv.get(`ff:cmsgs:${communityId}`)) || "[]");
      await kv.set(`ff:cmsgs:${communityId}`, JSON.stringify(msgIds.filter((id) => !deletedIds.includes(id))));
    }

    // Phase 5 — purge des posts communautaires
    const allCommPosts = await kv.getByPrefix("ff:comm-post:");
    const deletedCommPostsByTag = new Map<string, string[]>();
    for (const raw of allCommPosts) {
      try {
        const post = JSON.parse(raw);
        if (!keep.has(normalizeUsername(post.username || post.userId || ""))) {
          await kv.del(`ff:comm-post:${post.id}`);
          report.deletedCommunityPosts++;
          for (const tag of (post.hashtags || []) as string[]) {
            const t = tag.toLowerCase().replace(/^#/, "");
            if (!deletedCommPostsByTag.has(t)) deletedCommPostsByTag.set(t, []);
            deletedCommPostsByTag.get(t)!.push(post.id);
          }
        }
      } catch { /* skip */ }
    }
    for (const [tag, deletedIds] of deletedCommPostsByTag) {
      const tagIds: string[] = JSON.parse((await kv.get(`ff:comm-hashtag:${tag}`)) || "[]");
      await kv.set(`ff:comm-hashtag:${tag}`, JSON.stringify(tagIds.filter((id) => !deletedIds.includes(id))));
    }

    // Phase 6 — suppression Supabase Auth
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      if (authData?.users) {
        for (const u of authData.users) {
          const uname = normalizeUsername((u.user_metadata?.username as string) || u.email?.split("@")[0] || "");
          if (!keep.has(uname)) {
            const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
            if (delErr) report.errors.push(`Auth delete ${uname}: ${delErr.message}`);
            else report.deletedAuthUsers++;
            if (u.email) await kv.del(`ff:email-to-username:${u.email.toLowerCase()}`);
          }
        }
      }
    } catch (e) { report.errors.push(`Auth phase: ${e}`); }

    // Phase 7 — suppression Storage
    try {
      const { data: folders } = await supabaseAdmin.storage.from(PROFILE_BUCKET).list("", { limit: 200 });
      if (folders) {
        for (const folder of folders) {
          if (!folder.name || keep.has(normalizeUsername(folder.name))) continue;
          const { data: files } = await supabaseAdmin.storage.from(PROFILE_BUCKET).list(folder.name, { limit: 200 });
          if (files && files.length > 0) {
            const paths = files.map((f) => `${folder.name}/${f.name}`);
            const { error: rmErr } = await supabaseAdmin.storage.from(PROFILE_BUCKET).remove(paths);
            if (rmErr) report.errors.push(`Storage ${folder.name}: ${rmErr.message}`);
            else report.deletedStorageFiles += paths.length;
          }
        }
      }
    } catch (e) { report.errors.push(`Storage phase: ${e}`); }

    console.log("Admin purge terminée:", JSON.stringify(report));
    return c.json({ success: true, report });
  } catch (err) {
    console.error("Admin purge error:", err);
    return c.json({ error: `Échec purge: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════���═════════════
// SEED — Comptes fictifs (profils, posts, follows, progression)
// ════════════════════════════════════════════════════════════════════════════

app.post("/make-server-218684af/admin/seed-fictional", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const force = body.force === true;
    const SEED_KEY = "ff:seed:fictional-v1";
    if (!force) {
      const existing = await kv.get(SEED_KEY);
      if (existing) return c.json({ success: true, skipped: true, alreadyDone: true, message: "Déjà seedé. force:true pour re-seeder." });
    }
    const now = new Date();
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
    const daysAgo  = (d: number, h = 0) => new Date(now.getTime() - d * 86400000 - h * 3600000).toISOString();
    const report = { profilesSeeded: 0, postsSeeded: 0, followsSeeded: 0, progressSeeded: 0, errors: [] as string[] };

    type FU = { u: string; name: string; avatar: string; banner: string; bio: string; objective: string; objectiveDesc: string; descriptor: string; hashtags: string[]; streak: number; constance: number; pct: number; goals: number; days: number; verified: boolean; follows: string[] };
    const USERS: FU[] = [
      { u:"thomasdubois",    name:"Thomas Dubois",    avatar:"https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1620315808304-66597517b188?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Indie hacker en route vers le premier SaaS profitable. Je documente tout.",       objective:"Lancer mon SaaS",               objectiveDesc:"Atteindre 1000 clients payants d'ici fin 2026",   descriptor:"Entrepreneur",   hashtags:["#SaaS","#BuildInPublic","#Indiehacker"],    streak:87,  constance:78, pct:74, goals:3, days:95,  verified:true,  follows:["marielaurent","emmapetit","yasminehassan","sarahmartin","elodiechen","antoinerousseau","paulrenard","nicolasfaure"] },
      { u:"marielaurent",    name:"Marie Laurent",    avatar:"https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1528360983277-13d401cdc186?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Passionnée de langues. En train de conquérir le japonais, une leçon à la fois.",  objective:"Apprendre le japonais",         objectiveDesc:"Atteindre le niveau N2 au JLPT",                 descriptor:"Linguiste",      hashtags:["#Japonais","#Langues","#Apprentissage"],   streak:156, constance:91, pct:68, goals:5, days:160, verified:true,  follows:["thomasdubois","emmapetit","elodiechen","yasminehassan","hugolambert","camillerousseau","alexiatorres"] },
      { u:"emmapetit",       name:"Emma Petit",       avatar:"https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1519682337058-a94d519337bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"J'écris mon premier roman depuis 203 jours. La constance est ma seule stratégie.", objective:"Écrire un roman",               objectiveDesc:"Terminer les 100 000 mots et trouver un éditeur", descriptor:"Auteure",        hashtags:["#Écriture","#Roman","#Créativité"],         streak:203, constance:95, pct:84, goals:7, days:210, verified:true,  follows:["thomasdubois","elodiechen","marielaurent","isabellemartin","yasminehassan","camillerousseau","pierreleclerc"] },
      { u:"antoinerousseau", name:"Antoine Rousseau", avatar:"https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1517694712202-14dd9538aa97?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Dev en reconversion. Je construis mes compétences brique par brique, en public.",  objective:"Devenir développeur Full-Stack", objectiveDesc:"Décrocher mon premier poste dev d'ici 6 mois",    descriptor:"Dev",            hashtags:["#Dev","#React","#FullStack"],               streak:64,  constance:65, pct:51, goals:2, days:70,  verified:false, follows:["thomasdubois","elodiechen","yasminehassan","lucasbernard","paulrenard","maximedupont","hugolambert"] },
      { u:"lucasbernard",    name:"Lucas Bernard",    avatar:"https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Indépendance financière à 35 ans. Je partage mes investissements & réflexions.",  objective:"Indépendance financière",       objectiveDesc:"Atteindre 500k€ de patrimoine investi",          descriptor:"Investisseur",   hashtags:["#Finance","#Investissement","#FIRE"],       streak:31,  constance:58, pct:44, goals:2, days:40,  verified:false, follows:["thomasdubois","yasminehassan","emmapetit","sarahmartin","paulrenard","antoinerousseau"] },
      { u:"sarahmartin",     name:"Sarah Martin",     avatar:"https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Marathonienne en devenir. 42km dans 4 mois. Je cours chaque matin à 6h.",         objective:"Marathon en 6 mois",           objectiveDesc:"Finir le Marathon de Paris en moins de 4h",       descriptor:"Athlète",        hashtags:["#Marathon","#Running","#Constance"],        streak:42,  constance:68, pct:61, goals:2, days:50,  verified:false, follows:["emmapetit","elodiechen","thomasdubois","nicolasfaure","pierreleclerc","baptistero","camillerousseau"] },
      { u:"yasminehassan",   name:"Yasmine Hassan",   avatar:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Data analyst en formation. Les données ne mentent pas, les gens oui.",             objective:"Devenir data analyst",          objectiveDesc:"Obtenir 3 certifications et décrocher un CDI data",descriptor:"Data",           hashtags:["#Data","#PowerBI","#Analytics"],            streak:143, constance:88, pct:78, goals:6, days:150, verified:true,  follows:["emmapetit","elodiechen","thomasdubois","marielaurent","isabellemartin","antoinerousseau","alexiatorres"] },
      { u:"elodiechen",      name:"Elodie Chen",      avatar:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1558655146-9f40138edfeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Designer UI/UX freelance. L'accessibilité n'est pas un bonus, c'est la base.",    objective:"Designer freelance",           objectiveDesc:"Atteindre 10k€/mois en freelance",               descriptor:"Designer",       hashtags:["#UX","#Design","#Freelance"],               streak:91,  constance:82, pct:63, goals:4, days:100, verified:true,  follows:["emmapetit","yasminehassan","thomasdubois","marielaurent","chloebernard","alexiatorres","camillerousseau"] },
      { u:"nicolasfaure",    name:"Nicolas Faure",    avatar:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Transformation physique en cours. -15kg, +15kg de muscle. La science, pas la mode.",objective:"Perdre 15kg et muscler",       objectiveDesc:"Atteindre 80kg avec moins de 12% de masse grasse", descriptor:"Athlète",        hashtags:["#Fitness","#Squat","#Transformation"],      streak:55,  constance:70, pct:47, goals:2, days:60,  verified:false, follows:["thomasdubois","sarahmartin","baptistero","maximedupont","pierreleclerc","camillerousseau"] },
      { u:"maximedupont",    name:"Maxime Dupont",    avatar:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1508193638397-1c4234db14d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"1800km de Dunkerque à Hendaye à vélo. Je pars dans 6 semaines. Suivez l'aventure.",objective:"Traverser la France à vélo",  objectiveDesc:"Relier Dunkerque à Hendaye en 60 jours",         descriptor:"Aventurier",     hashtags:["#Cyclisme","#France","#Aventure"],          streak:29,  constance:52, pct:28, goals:1, days:35,  verified:false, follows:["thomasdubois","baptistero","nicolasfaure","sarahmartin","pierreleclerc","antoinerousseau"] },
      { u:"camillerousseau", name:"Camille Rousseau", avatar:"https://images.unsplash.com/photo-1607346256330-abd12a0cd65c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"21 jours de méditation et le stress a baissé. La régularité fait des miracles.",  objective:"Méditation quotidienne 1 an",  objectiveDesc:"365 jours consécutifs de méditation",           descriptor:"Bien-être",      hashtags:["#Méditation","#Mindfulness","#Bien-être"],  streak:21,  constance:55, pct:38, goals:1, days:25,  verified:false, follows:["emmapetit","marielaurent","elodiechen","sarahmartin","isabellemartin"] },
      { u:"nadialeblanc",    name:"Nadia Leblanc",    avatar:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Je cuisine le Japon depuis Paris. Ramen, sushi, yakitori — la patience avant tout.", objective:"Maîtriser la cuisine japonaise",objectiveDesc:"Réussir les 50 recettes clés de la cuisine japonaise",descriptor:"Cuisinière",   hashtags:["#Cuisine","#Japon","#Ramen"],               streak:45,  constance:72, pct:55, goals:2, days:50,  verified:false, follows:["marielaurent","hugolambert","elodiechen","emmapetit","camillerousseau"] },
      { u:"julienmoreau",    name:"Julien Moreau",    avatar:"https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Musicien indie. 3 titres enregistrés, mon EP sort dans 3 mois.",                  objective:"Sortir mon premier EP",         objectiveDesc:"Enregistrer et sortir 6 titres sur les plateformes",descriptor:"Musicien",     hashtags:["#Musique","#Studio","#EP"],                 streak:13,  constance:42, pct:32, goals:1, days:20,  verified:false, follows:["thomasdubois","alexiatorres","elodiechen","antoinerousseau"] },
      { u:"chloebernard",    name:"Chloé Bernard",    avatar:"https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1502920514313-52581002a659?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Photographe de voyage. 47 clichés dont 3 qui valent le réveil à 5h du matin.",    objective:"Publier 100 photos de voyage",  objectiveDesc:"Publier 100 photos uniques sur mon portfolio en ligne",descriptor:"Photographe",hashtags:["#Photographie","#Travel","#GoldenHour"],    streak:78,  constance:75, pct:58, goals:3, days:85,  verified:true,  follows:["elodiechen","emmapetit","yasminehassan","marielaurent","alexiatorres","sarahmartin"] },
      { u:"paulrenard",      name:"Paul Renard",      avatar:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1497366216548-37526070297c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Je construis mon agence digitale brique par brique. Premier client signé !",      objective:"Créer mon agence digitale",    objectiveDesc:"Atteindre 10 clients réguliers en 1 an",         descriptor:"Entrepreneur",   hashtags:["#Agence","#Entrepreneuriat","#Digital"],    streak:38,  constance:62, pct:42, goals:2, days:45,  verified:false, follows:["thomasdubois","antoinerousseau","elodiechen","lucasbernard","yasminehassan"] },
      { u:"isabellemartin",  name:"Isabelle Martin",  avatar:"https://images.unsplash.com/photo-1521252659862-eec69941b071?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1512820790803-83ca734da794?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"52 livres par an, une habitude de vie. En ce moment : Atomic Habits.",             objective:"Lire 52 livres en 1 an",       objectiveDesc:"Un livre par semaine, 52 fiches de lecture",      descriptor:"Lectrice",       hashtags:["#Lecture","#Livres","#DéveloppementPersonnel"], streak:112, constance:85, pct:70, goals:4, days:120, verified:true,  follows:["emmapetit","yasminehassan","elodiechen","camillerousseau","marielaurent","thomasdubois"] },
      { u:"hugolambert",     name:"Hugo Lambert",     avatar:"https://images.unsplash.com/photo-1463453091185-61582044d556?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1528360983277-13d401cdc186?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Il y a 4 mois je ne savais pas dire bonjour en japonais. Maintenant je converse.", objective:"Parler japonais couramment",   objectiveDesc:"Atteindre le niveau B2 conversationnel en japonais",descriptor:"Polyglotte",   hashtags:["#日本語","#Japonais","#Langues"],            streak:62,  constance:71, pct:52, goals:2, days:68,  verified:false, follows:["marielaurent","nadialeblanc","antoinerousseau","thomasdubois","yasminehassan"] },
      { u:"alexiatorres",    name:"Alexia Torres",    avatar:"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1478737270239-2f02b77fc618?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"12 épisodes de podcast tech enregistrés. La régularité avant la perfection.",     objective:"Lancer mon podcast tech",      objectiveDesc:"Publier 50 épisodes et atteindre 10k écoutes",   descriptor:"Podcasteuse",    hashtags:["#Podcast","#Tech","#Content"],              streak:34,  constance:60, pct:39, goals:2, days:38,  verified:false, follows:["elodiechen","yasminehassan","thomasdubois","julienmoreau","antoinerousseau"] },
      { u:"pierreleclerc",   name:"Pierre Leclerc",   avatar:"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1530549387789-4c1017266635?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"48km sur 100km. La nage de fond m'a appris à ne pas fuir ses pensées.",           objective:"Nager 100km cette année",      objectiveDesc:"100km de natation en 2026, 1 séance minimum par semaine",descriptor:"Nageur",      hashtags:["#Natation","#Endurance","#100km"],          streak:18,  constance:45, pct:35, goals:1, days:22,  verified:false, follows:["sarahmartin","nicolasfaure","maximedupont","baptistero","camillerousseau"] },
      { u:"baptistero",      name:"Baptiste Roy",     avatar:"https://images.unsplash.com/photo-1519345182560-3f2917c472ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"GR5, bivouac 2400m, -2°C. Aucun regret. Les 5 grands GR alpins m'attendent.",    objective:"Faire les 5 GR alpins",        objectiveDesc:"Compléter les 5 GR alpins avant fin 2027",       descriptor:"Alpiniste",      hashtags:["#GR5","#Alpinisme","#Bivouac"],             streak:7,   constance:35, pct:22, goals:1, days:12,  verified:false, follows:["maximedupont","nicolasfaure","sarahmartin","pierreleclerc"] },
      { u:"sofiamartin",     name:"Sofia Martin",     avatar:"https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Je crée ma marque de cosmétiques bio. La nature comme seule formule.",             objective:"Lancer ma marque de cosmétiques bio",objectiveDesc:"Lancer 5 produits bio certifiés en boutique",  descriptor:"Entrepreneuse",  hashtags:["#Cosmétiques","#Bio","#Entrepreneuriat"],   streak:15,  constance:40, pct:30, goals:1, days:20,  verified:false, follows:["elodiechen","emmapetit","camillerousseau","marielaurent"] },
      { u:"mariedupont",     name:"Marie Dupont",     avatar:"https://images.unsplash.com/photo-1585335559291-f94d268f8b17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1519682337058-a94d519337bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"J'écris et je publie mon premier roman. Chaque mot compte.",                      objective:"Écrire et publier mon premier roman",objectiveDesc:"Terminer le manuscrit et envoyer à 10 éditeurs",descriptor:"Auteure",      hashtags:["#Écriture","#Roman","#Publication"],        streak:8,   constance:30, pct:20, goals:1, days:15,  verified:false, follows:["emmapetit","isabellemartin","camillerousseau"] },
      { u:"antoinemoreau",   name:"Antoine Moreau",   avatar:"https://images.unsplash.com/photo-1731652227259-441c966ba1ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Je construis un studio créatif indépendant. La liberté créative, ça se mérite.",  objective:"Construire un studio créatif indépendant",objectiveDesc:"Ouvrir le studio d'ici 18 mois",          descriptor:"Créatif",        hashtags:["#Studio","#Créatif","#Indépendant"],        streak:91,  constance:80, pct:65, goals:4, days:95,  verified:false, follows:["thomasdubois","elodiechen","paulrenard","julienmoreau","antoinerousseau"] },
      { u:"juliachen",       name:"Julia Chen",       avatar:"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1497366216548-37526070297c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"Je construis ma startup edtech. L'éducation doit être accessible à tous.",        objective:"Lancer ma startup edtech en 2026",objectiveDesc:"Lever des fonds seed et atteindre 1000 utilisateurs",descriptor:"Fondatrice", hashtags:["#Edtech","#Startup","#Education"],          streak:19,  constance:48, pct:33, goals:1, days:25,  verified:false, follows:["thomasdubois","yasminehassan","elodiechen","antoinerousseau"] },
      { u:"romainleroy",     name:"Romain Leroy",     avatar:"https://images.unsplash.com/photo-1737574821698-862e77f044c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"10k abonnés LinkedIn en vue. Je partage mes apprentissages business chaque jour.", objective:"Atteindre 10k abonnés LinkedIn", objectiveDesc:"10 000 abonnés LinkedIn et 5 000 newsletter",    descriptor:"Content creator",hashtags:["#LinkedIn","#PersonalBranding","#Content"],  streak:34,  constance:62, pct:45, goals:2, days:40,  verified:false, follows:["thomasdubois","alexiatorres","paulrenard","elodiechen"] },
      { u:"celinefaure",     name:"Céline Faure",     avatar:"https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  banner:"https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",  bio:"1000km à courir cette année. 340km au compteur. Chaque foulée compte.",           objective:"Courir 1000km cette année",    objectiveDesc:"1000km de course à pied en 2026",                descriptor:"Coureuse",       hashtags:["#Running","#1000km","#Endurance"],          streak:14,  constance:43, pct:34, goals:1, days:18,  verified:false, follows:["sarahmartin","nicolasfaure","pierreleclerc","baptistero"] },
    ];

    const ficUsernames = new Set(USERS.map(u => u.u));

    // ── 1. PROFILS ────────────────────────────────────────────────────────────
    for (const fu of USERS) {
      try {
        const createdAt = daysAgo(fu.days);
        const profile = {
          username: fu.u, name: fu.name, handle: `@${fu.u}`, avatar: fu.avatar, banner: fu.banner,
          bio: fu.bio, objective: fu.objective, objectiveDesc: fu.objectiveDesc, descriptor: fu.descriptor,
          hashtags: fu.hashtags, streak: fu.streak, constance: fu.constance, progressPct: fu.pct,
          objectifsAccomplis: fu.goals, daysOnFF: fu.days, onboardingDone: true, verified: fu.verified,
          isFictional: true, createdAt, updatedAt: createdAt,
        };
        await kv.set(`ff:profile:${fu.u}`, JSON.stringify(profile));

        // ── Créer/mettre à jour ff:goals avec la vraie progression ────────────
        const goalKey = `ff:goals:${fu.u}`;
        const existingGoalsRaw = await kv.get(goalKey);
        if (!existingGoalsRaw || force) {
          const goal = {
            id: `goal-seed-${fu.u}`,
            title: fu.objective,
            description: fu.objectiveDesc,
            progress: fu.pct,
            status: fu.pct >= 100 ? "accompli" : "en_cours",
            createdAt: daysAgo(fu.days),
            updatedAt: daysAgo(Math.max(1, Math.floor(fu.days / 10))),
          };
          await kv.set(goalKey, JSON.stringify([goal]));
        }

        report.profilesSeeded++;
      } catch (e) { report.errors.push(`Profil ${fu.u}: ${e}`); }
    }

    // ── 2. POSTS ──────────────────────────────────────────────────────────────
    type SP = { id: string; u: string; name: string; avatar: string; objective: string; followers: number; streak: number; type: string; desc: string; hashtags: string[]; image: string | null; verified: boolean; relevant: number; comments: number; shares: number; views: number; hoursBack: number };
    const POSTS: SP[] = [
      { id:"seed-sarahmartin-001",     u:"sarahmartin",     name:"Sarah Martin",     avatar:"https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Marathon en 6 mois",           followers:1240, streak:42,  type:"avancement", desc:"Course de 15km ce matin. J'ai battu mon record personnel de 2 minutes. La constance commence à payer.", hashtags:["#Marathon","#Running","#Constance"],    image:"https://images.unsplash.com/photo-1706029831332-67734fbf73d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:82,  comments:12, shares:5,  views:870,  hoursBack:2  },
      { id:"seed-thomasdubois-001",    u:"thomasdubois",    name:"Thomas Dubois",    avatar:"https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Lancer mon SaaS",              followers:3800, streak:87,  type:"new",        desc:"3 heures de code aujourd'hui. J'ai intégré le système de paiement. Plus que l'authentification à finaliser.\n\nLa progression est lente mais régulière.", hashtags:["#SaaS","#BuildInPublic","#Indiehacker"], image:"https://images.unsplash.com/photo-1670761301241-7cec3cd6a925?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:124, comments:45, shares:18, views:2100, hoursBack:4  },
      { id:"seed-camillerousseau-001", u:"camillerousseau", name:"Camille Rousseau", avatar:"https://images.unsplash.com/photo-1607346256330-abd12a0cd65c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Méditation quotidienne 1 an",  followers:670,  streak:21,  type:"bilan",      desc:"21 jours consécutifs de méditation. 20 minutes chaque matin avant le café. Mon niveau de stress a baissé de façon perceptible. Le cerveau s'adapte vraiment.", hashtags:["#Méditation","#Mindfulness","#Bien-être"], image:"https://images.unsplash.com/photo-1665950865910-733277270459?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:67,  comments:9,  shares:4,  views:740,  hoursBack:3  },
      { id:"seed-nadialeblanc-001",    u:"nadialeblanc",    name:"Nadia Leblanc",    avatar:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Maîtriser la cuisine japonaise",followers:980,  streak:45,  type:"avancement", desc:"Ramen maison réussi pour la première fois ! Le bouillon a mijoté 6h. Le résultat est incroyable. La patience en cuisine, c'est 90% du résultat.", hashtags:["#Cuisine","#Ramen","#JapaneseCooking"], image:"https://images.unsplash.com/photo-1758523420342-330c7e4e3e1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:93,  comments:21, shares:8,  views:1200, hoursBack:5  },
      { id:"seed-julienmoreau-001",    u:"julienmoreau",    name:"Julien Moreau",    avatar:"https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Sortir mon premier EP",        followers:430,  streak:13,  type:"new",        desc:"Première vraie session d'enregistrement en studio aujourd'hui. 3 titres posés. L'acoustique de la pièce fait toute la différence. Je recommence demain.", hashtags:["#Musique","#Studio","#EP"], image:"https://images.unsplash.com/photo-1658010557310-e887544d7f4a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:45,  comments:7,  shares:3,  views:530,  hoursBack:6  },
      { id:"seed-marielaurent-001",    u:"marielaurent",    name:"Marie Laurent",    avatar:"https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Apprendre le japonais",        followers:2100, streak:156, type:"bilan",      desc:"Aujourd'hui, j'ai révisé ma méthode d'apprentissage. Je vais me concentrer sur la conversation plutôt que l'écriture pour le prochain mois.", hashtags:["#Japonais","#Apprentissage","#Langues"], image:null, verified:true,  relevant:91,  comments:23, shares:8,  views:1500, hoursBack:5  },
      { id:"seed-chloebernard-001",    u:"chloebernard",    name:"Chloé Bernard",    avatar:"https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Publier 100 photos de voyage", followers:5200, streak:78,  type:"objectif",   desc:"Sortie photo au lever du soleil ce matin. 47 clichés dont 3 vraiment exceptionnels. La lumière dorée de 6h30 est incomparable. Je comprends enfin pourquoi les photographes se lèvent tôt.", hashtags:["#Photographie","#GoldenHour","#Travel"], image:"https://images.unsplash.com/photo-1682445090053-1cfb63f3306a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:187, comments:52, shares:24, views:2900, hoursBack:7  },
      { id:"seed-lucasbernard-001",    u:"lucasbernard",    name:"Lucas Bernard",    avatar:"https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Indépendance financière",      followers:2100, streak:31,  type:"objectif",   desc:"Portfolio investi +12% ce trimestre. La diversification commence à montrer ses effets. Chaque mois régulier compte.", hashtags:["#Finance","#Investissement","#IndépendanceFinancière"], image:"https://images.unsplash.com/photo-1660970781103-ba6749cb9ce3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:156, comments:34, shares:12, views:1800, hoursBack:7  },
      { id:"seed-paulrenard-001",      u:"paulrenard",      name:"Paul Renard",      avatar:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Créer mon agence digitale",    followers:760,  streak:38,  type:"avancement", desc:"Premier client signé aujourd'hui ! Un contrat de 3 mois avec une startup locale. L'agence commence à exister concrètement. Chaque étape compte.", hashtags:["#Agence","#Entrepreneuriat","#PremierClient"], image:"https://images.unsplash.com/photo-1760611656615-db3fad24a314?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:134, comments:38, shares:16, views:2100, hoursBack:8  },
      { id:"seed-emmapetit-001",       u:"emmapetit",       name:"Emma Petit",       avatar:"https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Écrire un roman",             followers:4300, streak:203, type:"lecon",      desc:"Chapitre 12 terminé ! 2500 mots aujourd'hui. L'arc narratif prend forme. La constance quotidienne transforme le projet en réalité.", hashtags:["#Écriture","#Roman","#Créativité"], image:null, verified:true,  relevant:234, comments:67, shares:31, views:3200, hoursBack:9  },
      { id:"seed-isabellemartin-001",  u:"isabellemartin",  name:"Isabelle Martin",  avatar:"https://images.unsplash.com/photo-1521252659862-eec69941b071?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Lire 52 livres en 1 an",      followers:3100, streak:112, type:"bilan",      desc:"Livre 23/52 terminé ce soir. 'Atomic Habits' — le meilleur livre que j'ai lu cette année. Le concept d'identité avant les habitudes a changé ma façon de voir les choses.", hashtags:["#Lecture","#AtomicHabits","#Development"], image:"https://images.unsplash.com/photo-1524591282491-edb48a0fca8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:178, comments:44, shares:27, views:2600, hoursBack:10 },
      { id:"seed-nicolasfaure-001",    u:"nicolasfaure",    name:"Nicolas Faure",    avatar:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Perdre 15kg et muscler",       followers:1890, streak:55,  type:"avancement", desc:"PR squat aujourd'hui : 120kg ! Il y a 3 mois je peinais à 80kg. La progression linéaire ça marche vraiment. Petit à petit l'oiseau fait son nid.", hashtags:["#Fitness","#Squat","#PR"], image:"https://images.unsplash.com/photo-1552848031-326ec03fe2ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:201, comments:58, shares:19, views:3100, hoursBack:11 },
      { id:"seed-maximedupont-001",    u:"maximedupont",    name:"Maxime Dupont",    avatar:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Traverser la France à vélo",  followers:540,  streak:29,  type:"objectif",   desc:"80km aujourd'hui dans le Vercors. Les montées sont brutales mais la vue du sommet efface tout. J'ai compris pourquoi les cyclistes sont obsédés par les cols.", hashtags:["#Cyclisme","#Vercors","#France"], image:"https://images.unsplash.com/photo-1605271998276-db59cb8455bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:112, comments:29, shares:11, views:1700, hoursBack:13 },
      { id:"seed-antoinerousseau-001", u:"antoinerousseau", name:"Antoine Rousseau", avatar:"https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Devenir développeur Full-Stack",followers:870, streak:64,  type:"conseil",    desc:"Aujourd'hui j'ai planifié mon roadmap pour les 3 prochains mois. Focus sur React, Node.js et PostgreSQL.", hashtags:["#Dev","#React","#FullStack"], image:null, verified:false, relevant:98,  comments:28, shares:15, views:1400, hoursBack:11 },
      { id:"seed-elodiechen-001",      u:"elodiechen",      name:"Elodie Chen",      avatar:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Devenir UI/UX designer freelance",followers:6700,streak:91, type:"new",        desc:"Nouveau projet dans mon portfolio ! Refonte complète de l'app d'un cabinet médical. Interface pensée d'abord pour les patients âgés. L'accessibilité, c'est pas un bonus.", hashtags:["#UX","#Design","#Accessibilité"], image:"https://images.unsplash.com/photo-1763621569464-409a050b112e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:223, comments:61, shares:33, views:3700, hoursBack:14 },
      { id:"seed-hugolambert-001",     u:"hugolambert",     name:"Hugo Lambert",     avatar:"https://images.unsplash.com/photo-1463453091185-61582044d556?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Parler japonais couramment",  followers:1350, streak:62,  type:"avancement", desc:"Première conversation complète en japonais avec un natif sur Tandem. Je n'ai consulté le dictionnaire qu'une fois. Il y a 4 mois je ne savais pas dire bonjour.", hashtags:["#日本語","#Japonais","#Tandem"], image:"https://images.unsplash.com/photo-1662107399413-ccaf9bbb1ce9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:144, comments:37, shares:14, views:2200, hoursBack:15 },
      { id:"seed-alexiatorres-001",    u:"alexiatorres",    name:"Alexia Torres",    avatar:"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Lancer mon podcast tech",     followers:920,  streak:34,  type:"new",        desc:"Épisode 12 enregistré et monté en 3h chrono. J'ai enfin trouvé mon rythme de production. La régularité avant la perfection.", hashtags:["#Podcast","#Tech","#Content"], image:"https://images.unsplash.com/photo-1627667050609-d4ba6483a368?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:87,  comments:18, shares:9,  views:1300, hoursBack:16 },
      { id:"seed-pierreleclerc-001",   u:"pierreleclerc",   name:"Pierre Leclerc",   avatar:"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Nager 100km cette année",     followers:380,  streak:18,  type:"avancement", desc:"48km sur 100km. Mi-parcours atteint ! La nage de fond m'a appris quelque chose : quand t'es dans l'eau, tu peux pas fuir tes pensées. C'est presque méditatif.", hashtags:["#Natation","#Endurance","#100km"], image:"https://images.unsplash.com/photo-1768576544598-7ad9f8a1d9a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:56,  comments:11, shares:4,  views:820,  hoursBack:18 },
      { id:"seed-yasminehassan-001",   u:"yasminehassan",   name:"Yasmine Hassan",   avatar:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Devenir data analyst",        followers:4800, streak:143, type:"lecon",      desc:"Dashboard Power BI terminé pour mon projet perso. J'ai visualisé 6 mois de mes propres données : sommeil, sport, productivité. Les corrélations sont fascinantes.", hashtags:["#Data","#PowerBI","#Analytics"], image:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:198, comments:54, shares:28, views:3400, hoursBack:20 },
      { id:"seed-baptistero-001",      u:"baptistero",      name:"Baptiste Roy",     avatar:"https://images.unsplash.com/photo-1519345182560-3f2917c472ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Faire les 5 GR alpins",       followers:2600, streak:7,   type:"objectif",   desc:"GR5 — Jour 3. Nuit en bivouac à 2400m d'altitude. Température : -2°C. R��veil à 5h pour voir le lever de soleil sur les Écrins. Aucun regret.", hashtags:["#GR5","#Alpinisme","#Bivouac"], image:"https://images.unsplash.com/photo-1687270282079-58b4689fed0f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:312, comments:88, shares:47, views:5100, hoursBack:22 },
      { id:"seed-thomasdubois-002",    u:"thomasdubois",    name:"Thomas Dubois",    avatar:"https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Lancer mon SaaS",              followers:3800, streak:87,  type:"question",   desc:"Comment vous gérez la motivation les jours où vous n'avez pas envie ? Je cherche des stratégies concrètes pour les passages à vide.", hashtags:["#Motivation","#SaaS","#Mindset"], image:null, verified:true,  relevant:57,  comments:38, shares:4,  views:920,  hoursBack:1  },
      { id:"seed-marielaurent-002",    u:"marielaurent",    name:"Marie Laurent",    avatar:"https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Apprendre le japonais",        followers:2100, streak:156, type:"infos",      desc:"J'ai rejoint un groupe de conversation en japonais. Première session demain soir. Un peu stressée mais très excitée !", hashtags:["#Japonais","#Communauté","#Progression"], image:"https://images.unsplash.com/photo-1662107399413-ccaf9bbb1ce9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:74,  comments:19, shares:6,  views:1100, hoursBack:3  },
      { id:"seed-yasminehassan-002",   u:"yasminehassan",   name:"Yasmine Hassan",   avatar:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Devenir data analyst",        followers:4800, streak:143, type:"avancement", desc:"Certif SQL obtenue ce matin. 3 mois de préparation. Le score final : 94/100. La prochaine étape c'est la certif Python pour l'analyse de données.", hashtags:["#SQL","#Certification","#Data"], image:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:167, comments:43, shares:21, views:2900, hoursBack:2  },
      { id:"seed-emmapetit-002",       u:"emmapetit",       name:"Emma Petit",       avatar:"https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Écrire un roman",             followers:4300, streak:203, type:"conseil",    desc:"Pour ceux qui écrivent : réservez un créneau fixe chaque jour, même 20 minutes. La régularité bat l'inspiration. En 6 mois j'ai produit 80 000 mots grâce à ça.", hashtags:["#Écriture","#Constance","#Productivité"], image:null, verified:true,  relevant:189, comments:52, shares:44, views:4100, hoursBack:25 },
      { id:"seed-elodiechen-002",      u:"elodiechen",      name:"Elodie Chen",      avatar:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Devenir UI/UX designer freelance",followers:6700,streak:91, type:"new",        desc:"J'ai accepté ma première mission freelance ! 3 semaines de mission pour une fintech parisienne. Taux journalier négocié à 450€. Le portfolio en ligne ça marche.", hashtags:["#Freelance","#UX","#Design"], image:"https://images.unsplash.com/photo-1763621569464-409a050b112e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:true,  relevant:245, comments:71, shares:38, views:4800, hoursBack:4  },
      { id:"seed-antoinerousseau-002", u:"antoinerousseau", name:"Antoine Rousseau", avatar:"https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Devenir développeur Full-Stack",followers:870, streak:64,  type:"avancement", desc:"Premier projet en production ! Une API REST complète avec authentification JWT. C'est petit, mais c'est le mien.", hashtags:["#Dev","#API","#FullStack"], image:"https://images.unsplash.com/photo-1670761301241-7cec3cd6a925?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:143, comments:41, shares:22, views:2700, hoursBack:8  },
      { id:"seed-nicolasfaure-002",    u:"nicolasfaure",    name:"Nicolas Faure",    avatar:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Perdre 15kg et muscler",       followers:1890, streak:55,  type:"lecon",      desc:"Leçon durement apprise : la récupération compte autant que l'entraînement. J'ai ignoré les signaux de mon corps pendant 2 semaines. Résultat : tendinite. Prenez vos jours de repos.", hashtags:["#Fitness","#Récupération","#Leçon"], image:"https://images.unsplash.com/photo-1552848031-326ec03fe2ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:156, comments:47, shares:18, views:2400, hoursBack:10 },
      { id:"seed-lucasbernard-002",    u:"lucasbernard",    name:"Lucas Bernard",    avatar:"https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Indépendance financière",      followers:2100, streak:31,  type:"bilan",      desc:"Bilan du mois : +8% sur le portefeuille. La discipline d'investissement mensuel commence à vraiment payer. Patience et constance.", hashtags:["#Finance","#Bilan","#Investissement"], image:"https://images.unsplash.com/photo-1766218329569-53c9270bb305?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:112, comments:27, shares:9,  views:2100, hoursBack:26 },
      { id:"seed-sarahmartin-002",     u:"sarahmartin",     name:"Sarah Martin",     avatar:"https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Marathon en 6 mois",           followers:1240, streak:42,  type:"objectif",   desc:"Inscrite au marathon de Paris. La date est fixée. Maintenant je m'y tiens. 42km dans 4 mois.", hashtags:["#Marathon","#Paris","#Running"], image:"https://images.unsplash.com/photo-1706029831332-67734fbf73d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:88,  comments:15, shares:7,  views:1350, hoursBack:27 },
      { id:"seed-maximedupont-002",    u:"maximedupont",    name:"Maxime Dupont",    avatar:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  objective:"Traverser la France à vélo",  followers:540,  streak:29,  type:"infos",      desc:"J'ai tracé l'itinéraire complet : 1800km de Dunkerque à Hendaye. Départ prévu dans 6 semaines. Je documente tout ici. Restez à bord.", hashtags:["#Cyclisme","#France","#Aventure"], image:"https://images.unsplash.com/photo-1605271998276-db59cb8455bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800", verified:false, relevant:203, comments:66, shares:41, views:3800, hoursBack:48 },
    ];

    const allPostIds: string[] = JSON.parse((await kv.get("ff:posts:all")) || "[]");
    for (const sp of POSTS) {
      try {
        const existing = await kv.get(`ff:post:${sp.id}`);
        if (existing && !force) continue;
        const createdAt = hoursAgo(sp.hoursBack);
        const post = {
          id: sp.id, username: sp.u, verified: sp.verified,
          user: { name: sp.name, avatar: sp.avatar, objective: sp.objective, followers: sp.followers },
          streak: sp.streak, progress: { type: sp.type, description: sp.desc, timestamp: relativeTime(createdAt) },
          hashtags: sp.hashtags, image: sp.image,
          relevantCount: sp.relevant, commentsCount: sp.comments, sharesCount: sp.shares, viewsCount: sp.views,
          isNew: sp.hoursBack < 12, createdAt, isSeedPost: true,
        };
        await kv.set(`ff:post:${sp.id}`, JSON.stringify(post));
        const uids: string[] = JSON.parse((await kv.get(`ff:posts:user:${sp.u}`)) || "[]");
        if (!uids.includes(sp.id)) { uids.unshift(sp.id); await kv.set(`ff:posts:user:${sp.u}`, JSON.stringify(uids)); }
        if (!allPostIds.includes(sp.id)) allPostIds.push(sp.id);
        report.postsSeeded++;
      } catch (e) { report.errors.push(`Post ${sp.id}: ${e}`); }
    }
    // Re-trier l'index global par date décroissante
    const allPostsWithDate: Array<{id: string; createdAt: string}> = [];
    for (const pid of allPostIds) {
      const raw = await kv.get(`ff:post:${pid}`);
      if (raw) { const p = JSON.parse(raw); allPostsWithDate.push({ id: pid, createdAt: p.createdAt || "2020-01-01" }); }
    }
    allPostsWithDate.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await kv.set("ff:posts:all", JSON.stringify(allPostsWithDate.map(p => p.id).slice(0, 500)));

    // ── 3. FOLLOWS (fictif → fictif uniquement) ───────────────────────────────
    for (const fu of USERS) {
      try {
        const followingList: string[] = JSON.parse((await kv.get(`ff:following:${fu.u}`)) || "[]");
        for (const targetU of fu.follows) {
          if (!ficUsernames.has(targetU)) continue;
          if (!followingList.includes(targetU)) followingList.push(targetU);
          const followersList: string[] = JSON.parse((await kv.get(`ff:followers:${targetU}`)) || "[]");
          if (!followersList.includes(fu.u)) { followersList.push(fu.u); await kv.set(`ff:followers:${targetU}`, JSON.stringify(followersList)); }
          const followKey = `ff:follow:${fu.u}:${targetU}`;
          if (!(await kv.get(followKey))) {
            await kv.set(followKey, JSON.stringify({ id: genId(), followerId: fu.u, followingId: targetU, createdAt: daysAgo(fu.days - 1) }));
            report.followsSeeded++;
          }
        }
        await kv.set(`ff:following:${fu.u}`, JSON.stringify(followingList));
      } catch (e) { report.errors.push(`Follow ${fu.u}: ${e}`); }
    }

    // ── 4. STREAK + PROGRESSION + FCOINS ─────────────────────────────────────
    const today = now.toISOString().slice(0, 10);
    for (const fu of USERS) {
      try {
        await kv.set(`ff:streak:${fu.u}`, JSON.stringify({ userId: fu.u, currentStreak: fu.streak, lastActiveDate: today, longestStreak: Math.round(fu.streak * 1.15), totalDaysActive: fu.days, postedToday: false }));
        await kv.set(`ff:progress:${fu.u}`, JSON.stringify({ userId: fu.u, score: fu.pct, lastUpdate: now.toISOString() }));
        const history: Array<{ date: string; score: number }> = [];
        for (let d = 30; d >= 0; d--) {
          const date = new Date(now.getTime() - d * 86400000).toISOString().slice(0, 10);
          const variance = Math.round((Math.random() - 0.5) * 8);
          history.push({ date, score: Math.min(100, Math.max(0, Math.round(fu.pct * (1 - d / 60)) + variance)) });
        }
        await kv.set(`ff:progress-history:${fu.u}`, JSON.stringify(history));
        const fcoins: string[] = ["rare_early"];
        if (fu.streak >= 2)  fcoins.push("streak_2");
        if (fu.streak >= 7)  fcoins.push("streak_7");
        if (fu.streak >= 30) fcoins.push("streak_30");
        if (fu.goals >= 1)   fcoins.push("posts_1", "rare_first_goal");
        if (fu.goals >= 3)   fcoins.push("posts_10");
        if (fu.follows.length >= 5) fcoins.push("social_10follows");
        await kv.set(`ff:fcoins:${fu.u}`, JSON.stringify([...new Set(fcoins)]));
        await kv.set(`ff:msg-count:${fu.u}`, String(Math.floor(Math.random() * 30)));
        report.progressSeeded++;
      } catch (e) { report.errors.push(`Progression ${fu.u}: ${e}`); }
    }

    await kv.set(SEED_KEY, JSON.stringify({ seededAt: now.toISOString(), usersCount: USERS.length, postsCount: POSTS.length }));
    console.log("Seed fictional terminé:", JSON.stringify(report));
    return c.json({ success: true, report });
  } catch (err) {
    console.error("Seed fictional error:", err);
    return c.json({ error: `Échec seed: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// UPLOAD IMAGE PROFIL (avatar / bannière)
// ════════════════════════════════════════════════════════════════════════════

// POST /upload/profile-image — Upload avatar ou bannière vers Supabase Storage
app.post("/make-server-218684af/upload/profile-image", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "avatar";

    if (!file) return c.json({ error: "Fichier requis." }, 400);

    const validation = await validateUpload(file);
    if (!validation.ok) {
      console.log("Upload profile image refusé:", validation.error);
      return c.json({ error: validation.error }, 400);
    }
    const { bytes, mime } = validation;

    // Nom aléatoire — pas de username dans le chemin pour la sécurité
    const rand = crypto.randomUUID().replace(/-/g, "");
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const path = `${type}/${rand}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(PROFILE_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });

    if (uploadError) {
      console.error("Upload profile image error:", uploadError);
      return c.json({ error: `Erreur upload: ${uploadError.message}` }, 500);
    }

    const { data: urlData } = supabaseAdmin.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    console.log(`Upload profil réussi: ${path} (${mime})`);
    return c.json({ success: true, url: urlData.publicUrl, path });
  } catch (err) {
    return c.json({ error: `Échec upload image profil: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// OBJECTIFS COMMUNAUTAIRES — Stats Tab
// ════════════════════════════════════════════════════════════════════════════

// POST /community-objectives — Créer un objectif
app.post("/make-server-218684af/community-objectives", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, communityId, type, emoji, title, targetValue, unit, durationDays } = body;
    if (!userId || !communityId || !title || !targetValue) {
      return c.json({ error: "userId, communityId, title, targetValue requis." }, 400);
    }
    const id = genId();
    const now = new Date().toISOString();
    const days = parseInt(durationDays) || 30;
    const endDate = new Date(Date.now() + days * 86400000).toISOString();
    const obj = {
      id, userId, communityId,
      type: type || "custom",
      emoji: emoji || "🎯",
      title: title.trim(),
      targetValue: Number(targetValue),
      currentValue: 0,
      unit: unit || "",
      durationDays: days,
      startDate: now,
      endDate,
      completed: false,
      createdAt: now,
    };
    await kv.set(`ff:cobj:${id}`, JSON.stringify(obj));
    const idxKey = `ff:cobj-idx:${userId}:${communityId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");
    ids.unshift(id);
    if (ids.length > 50) ids.splice(50);
    await kv.set(idxKey, JSON.stringify(ids));
    console.log(`Objectif créé: id=${id}, user=${userId}, comm=${communityId}`);
    return c.json({ success: true, objective: obj });
  } catch (err) {
    console.log("Erreur création objectif:", err);
    return c.json({ error: `Échec création objectif: ${err}` }, 500);
  }
});

// GET /community-objectives/stats/:communityId — Stats agrégées (doit être AVANT /:userId/:communityId)
app.get("/make-server-218684af/community-objectives/stats/:communityId", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const allRaw = await kv.getByPrefix("ff:cobj:");
    let totalObjectives = 0;
    let completedObjectives = 0;
    let totalCurrentValue = 0;
    const userSet = new Set<string>();
    for (const raw of allRaw) {
      try {
        const obj = JSON.parse(raw);
        if (obj.communityId !== communityId) continue;
        totalObjectives++;
        if (obj.completed) completedObjectives++;
        totalCurrentValue += obj.currentValue || 0;
        userSet.add(obj.userId);
      } catch { /* skip */ }
    }
    const avgCompletion = totalObjectives > 0
      ? Math.round((completedObjectives / totalObjectives) * 100)
      : 0;
    return c.json({ totalObjectives, completedObjectives, activeUsers: userSet.size, totalCurrentValue, avgCompletion });
  } catch (err) {
    return c.json({ error: `Échec stats communauté: ${err}` }, 500);
  }
});

// GET /community-objectives/:userId/:communityId — Liste des objectifs
app.get("/make-server-218684af/community-objectives/:userId/:communityId", async (c) => {
  try {
    const { userId, communityId } = c.req.param();
    const ids: string[] = JSON.parse((await kv.get(`ff:cobj-idx:${userId}:${communityId}`)) || "[]");
    const objectives = [];
    for (const id of ids) {
      const raw = await kv.get(`ff:cobj:${id}`);
      if (raw) objectives.push(JSON.parse(raw));
    }
    return c.json({ objectives, total: objectives.length });
  } catch (err) {
    return c.json({ error: `Échec récupération objectifs: ${err}` }, 500);
  }
});

// PUT /community-objectives/:id/progress — Mettre à jour la progression
app.put("/make-server-218684af/community-objectives/:id/progress", async (c) => {
  try {
    const id = c.req.param("id");
    const { increment, setValue } = await c.req.json();
    const raw = await kv.get(`ff:cobj:${id}`);
    if (!raw) return c.json({ error: "Objectif introuvable." }, 404);
    const obj = JSON.parse(raw);
    if (typeof setValue === "number") {
      obj.currentValue = Math.max(0, Math.min(obj.targetValue, setValue));
    } else if (increment) {
      obj.currentValue = Math.min(obj.targetValue, (obj.currentValue || 0) + 1);
    }
    if (obj.currentValue >= obj.targetValue) obj.completed = true;
    await kv.set(`ff:cobj:${id}`, JSON.stringify(obj));
    console.log(`Objectif progress: id=${id}, value=${obj.currentValue}/${obj.targetValue}`);
    return c.json({ success: true, objective: obj });
  } catch (err) {
    return c.json({ error: `Échec update objectif: ${err}` }, 500);
  }
});

// DELETE /community-objectives/:id — Supprimer
app.delete("/make-server-218684af/community-objectives/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const raw = await kv.get(`ff:cobj:${id}`);
    if (!raw) return c.json({ error: "Objectif introuvable." }, 404);
    const obj = JSON.parse(raw);
    await kv.del(`ff:cobj:${id}`);
    const idxKey = `ff:cobj-idx:${obj.userId}:${obj.communityId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");
    await kv.set(idxKey, JSON.stringify(ids.filter((i: string) => i !== id)));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec suppression objectif: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CANAUX DE COMMUNAUTÉ (structure Discord-like)
// ════════════════════════════════════════════════════════════════════════════

interface ChannelItem { id: string; name: string; emoji?: string; }
interface ChannelCategory { id: string; name: string; collapsed?: boolean; channels: ChannelItem[]; }

function defaultChannelStructure(): ChannelCategory[] {
  return [
    {
      id: "cat-general", name: "Général", collapsed: false,
      channels: [
        { id: "ch-aide",     name: "aide",         emoji: "#" },
        { id: "ch-conseils", name: "conseils",      emoji: "#" },
        { id: "ch-business", name: "vos-business",  emoji: "#" },
      ],
    },
    {
      id: "cat-promouvoir", name: "Promouvoir", collapsed: false,
      channels: [
        { id: "ch-promo", name: "promo", emoji: "#" },
      ],
    },
    {
      id: "cat-regles", name: "Demande / Règles", collapsed: false,
      channels: [
        { id: "ch-regles",  name: "règles-communauté", emoji: "#" },
        { id: "ch-demande", name: "demande-admin",      emoji: "#" },
      ],
    },
    {
      id: "cat-stats", name: "Stats", collapsed: false,
      channels: [
        { id: "ch-objectif", name: "objectifs", emoji: "#" },
      ],
    },
  ];
}

// GET /communities/:id/channels — Récupérer la structure des canaux
app.get("/make-server-218684af/communities/:id/channels", async (c) => {
  try {
    const id = c.req.param("id");
    const raw = await kv.get(`ff:comm-channels:${id}`);
    const channels: ChannelCategory[] = raw ? JSON.parse(raw) : defaultChannelStructure();
    console.log(`GET channels: communityId=${id}, ${channels.length} catégories`);
    return c.json({ channels });
  } catch (err) {
    console.error("Erreur GET channels:", err);
    return c.json({ error: `Échec récupération canaux: ${err}` }, 500);
  }
});

// PUT /communities/:id/channels — Sauvegarder la structure (créateur uniquement)
app.put("/make-server-218684af/communities/:id/channels", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { channels, requestedBy } = body;

    if (!Array.isArray(channels)) return c.json({ error: "channels array requis." }, 400);

    // Vérifier permission (si communauté dynamique)
    const communityRaw = await kv.get(`ff:community:${id}`);
    if (communityRaw) {
      const community = JSON.parse(communityRaw);
      if (requestedBy && community.createdBy !== requestedBy) {
        return c.json({ error: "Seul le créateur peut modifier les canaux." }, 403);
      }
    }

    await kv.set(`ff:comm-channels:${id}`, JSON.stringify(channels));
    console.log(`Canaux mis à jour: communityId=${id}, by=${requestedBy}, ${channels.length} catégories`);
    return c.json({ success: true, channels });
  } catch (err) {
    console.error("Erreur PUT channels:", err);
    return c.json({ error: `Échec mise à jour canaux: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// POSTS DE CANAL (fil de discussion structuré par canal)
// ════════════════════════════════════════════════════════════════════════════

// POST /communities/:id/channels/:channelId/posts — Créer un post dans un canal
app.post("/make-server-218684af/communities/:id/channels/:channelId/posts", async (c) => {
  try {
    const communityId = c.req.param("id");
    const channelId   = c.req.param("channelId");
    const body        = await c.req.json();
    const { userId, author, avatar, badge, text, image, hashtags } = body;

    if (!userId)       return c.json({ error: "userId requis." }, 400);
    if (!text?.trim()) return c.json({ error: "Contenu requis." }, 400);

    const postId    = `chp-${genId()}`;
    const createdAt = new Date().toISOString();

    const post = {
      id: postId, communityId, channelId,
      userId, author: author || userId, avatar: avatar || "",
      badge: badge || "Actus", text: text.trim(),
      image: image || null, hashtags: hashtags || [],
      repliesCount: 0, createdAt,
    };

    await kv.set(`ff:comm-post:${postId}`, JSON.stringify(post));

    const idxKey = `ff:ch-posts:${communityId}:${channelId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");
    ids.unshift(postId);
    if (ids.length > 300) ids.splice(300);
    await kv.set(idxKey, JSON.stringify(ids));

    await logActivity(userId, "channel_post", { communityId, channelId, postId });
    await addProgressScore(userId, 3);
    await checkAndAwardFcoins(userId);

    console.log(`Post canal créé: id=${postId}, community=${communityId}, channel=${channelId}, user=${userId}`);
    return c.json({ success: true, post: { ...post, timestamp: "À l'instant" } });
  } catch (err) {
    console.error("Erreur POST channel post:", err);
    return c.json({ error: `Échec création post canal: ${err}` }, 500);
  }
});

// GET /communities/:id/channels/:channelId/posts — Posts d'un canal
app.get("/make-server-218684af/communities/:id/channels/:channelId/posts", async (c) => {
  try {
    const communityId = c.req.param("id");
    const channelId   = c.req.param("channelId");
    const limit       = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const userId      = c.req.query("userId") || "";

    const idxKey = `ff:ch-posts:${communityId}:${channelId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");

    const posts = [];
    for (const id of ids.slice(0, limit)) {
      const raw = await kv.get(`ff:comm-post:${id}`);
      if (!raw) continue;
      const post = JSON.parse(raw);

      if (post.createdAt) post.timestamp = relativeTime(post.createdAt);

      const countsRaw = await kv.get(`ff:post-reactions:counts:${id}`);
      post.reactionCounts = countsRaw ? JSON.parse(countsRaw) : {};
      post.reactionTotal  = Object.values(post.reactionCounts as Record<string, number>)
        .reduce((s: number, v) => s + (v as number), 0);

      if (userId) {
        const myRaw = await kv.get(`ff:post-reaction:${id}:${userId}`);
        post.myReaction = myRaw ? JSON.parse(myRaw).reactionType : null;
      } else {
        post.myReaction = null;
      }

      const cmtIds: string[] = JSON.parse((await kv.get(`ff:comments:post:${id}`)) || "[]");
      post.liveCommentsCount = cmtIds.length;

      posts.push(post);
    }

    console.log(`GET channel posts: community=${communityId}, channel=${channelId}, ${posts.length} posts`);
    return c.json({ posts, total: ids.length });
  } catch (err) {
    console.error("Erreur GET channel posts:", err);
    return c.json({ error: `Échec récupération posts canal: ${err}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════���
// IMPACT & LEADERBOARD COMMUNAUTÉ
// ════════════════════════════════════════════════════════════════════════════

// GET /communities/:id/impact — Métriques agrégées (lectures KV parallélisées)
app.get("/make-server-218684af/communities/:id/impact", async (c) => {
  try {
    const communityId = c.req.param("id");
    const MAX_POSTS = 60;

    // 1. Structure canaux (1 appel)
    const chansRaw = await kv.get(`ff:comm-channels:${communityId}`);
    const categories: Array<{ id: string; name: string; channels: Array<{ id: string; name: string }> }> =
      chansRaw ? JSON.parse(chansRaw) : [];

    const allChannels: Array<{ id: string; name: string }> = [];
    for (const cat of categories) {
      for (const chan of (cat.channels || [])) allChannels.push({ id: chan.id, name: chan.name });
    }

    if (allChannels.length === 0) {
      return c.json({ totalPosts: 0, totalReactions: 0, activeMembers: 0, weeklyActivity: new Array(7).fill(0), weeklyReactions: new Array(7).fill(0), weeklyComments: new Array(7).fill(0), topChannels: [], topHashtags: [], healthScore: 0, channelCount: 0 });
    }

    // 2. Index de posts par canal — tout en parallèle
    const idxRaws = await Promise.all(
      allChannels.map((ch) => kv.get(`ff:ch-posts:${communityId}:${ch.id}`))
    );

    const channelPostCount: Record<string, number> = {};
    const allPostIds: string[] = [];
    idxRaws.forEach((raw, i) => {
      const ids: string[] = raw ? JSON.parse(raw) : [];
      channelPostCount[allChannels[i].id] = ids.length;
      allPostIds.push(...ids);
    });

    const uniqueIds = [...new Set(allPostIds)].slice(0, MAX_POSTS);
    const totalPostsAll = allPostIds.length;

    // 3. Posts + réactions — tout en parallèle
    const [postRaws, reactionRaws] = await Promise.all([
      Promise.all(uniqueIds.map((pid) => kv.get(`ff:comm-post:${pid}`))),
      Promise.all(uniqueIds.map((pid) => kv.get(`ff:post-reactions:counts:${pid}`))),
    ]);

    // 4. Agréger
    const userStats: Record<string, { name: string; avatar: string; posts: number; reactionsReceived: number }> = {};
    const hashtagCount: Record<string, number> = {};
    const dailyCounts: number[] = new Array(7).fill(0);
    const dailyReactions: number[] = new Array(7).fill(0);
    const dailyComments: number[] = new Array(7).fill(0);
    const now = Date.now();
    let totalReactions = 0;

    postRaws.forEach((raw, i) => {
      if (!raw) return;
      let post: Record<string, any>;
      try { post = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return; }

      let daysAgoPost = -1;
      if (post.createdAt) {
        daysAgoPost = Math.floor((now - new Date(post.createdAt).getTime()) / 86400000);
        if (daysAgoPost >= 0 && daysAgoPost < 7) {
          dailyCounts[daysAgoPost]++;
          dailyComments[daysAgoPost] += (post.repliesCount || post.commentsCount || 0);
        }
      }
      for (const tag of (post.hashtags || [])) {
        hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
      }
      const uid = post.userId || "unknown";
      if (!userStats[uid]) {
        userStats[uid] = { name: post.author || uid, avatar: post.avatar || "", posts: 0, reactionsReceived: 0 };
      }
      userStats[uid].posts++;

      const cr = reactionRaws[i];
      if (cr) {
        let counts: Record<string, number> = {};
        try { counts = typeof cr === "string" ? JSON.parse(cr) : cr; } catch { /* skip */ }
        const total = Object.values(counts).reduce((s: number, v: number) => s + v, 0);
        totalReactions += total;
        userStats[uid].reactionsReceived += total;
        if (daysAgoPost >= 0 && daysAgoPost < 7) {
          dailyReactions[daysAgoPost] += total;
        }
      }
    });

    const topChannels = allChannels
      .map((ch) => ({ id: ch.id, name: ch.name, posts: channelPostCount[ch.id] || 0 }))
      .sort((a, b) => b.posts - a.posts).slice(0, 5).filter((ch) => ch.posts > 0);

    const topHashtags = Object.entries(hashtagCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count }));

    const activeMembers   = Object.keys(userStats).length;
    const postsPerDay     = totalPostsAll / 7;
    const avgReactions    = uniqueIds.length > 0 ? totalReactions / uniqueIds.length : 0;
    const channelUsagePct = allChannels.length > 0
      ? (allChannels.filter((ch) => (channelPostCount[ch.id] || 0) > 0).length / allChannels.length) * 100 : 0;
    const healthScore = Math.min(100, Math.round(
      Math.min(postsPerDay * 10, 40) + Math.min(activeMembers * 5, 30) +
      Math.min(avgReactions * 3, 20) + channelUsagePct * 0.1
    ));
    const weeklyActivity  = [...dailyCounts].reverse();
    const weeklyReactions = [...dailyReactions].reverse();
    const weeklyComments  = [...dailyComments].reverse();

    console.log(`GET impact: community=${communityId}, posts=${totalPostsAll}, scanned=${uniqueIds.length}, health=${healthScore}`);
    return c.json({ totalPosts: totalPostsAll, totalReactions, activeMembers, weeklyActivity, weeklyReactions, weeklyComments, topChannels, topHashtags, healthScore, channelCount: allChannels.length });
  } catch (err) {
    console.error("Erreur GET impact:", err);
    return c.json({ error: `Echec impact: ${err}` }, 500);
  }
});

// GET /communities/:id/leaderboard — Top contributeurs (lectures KV parallélisées)
app.get("/make-server-218684af/communities/:id/leaderboard", async (c) => {
  try {
    const communityId = c.req.param("id");
    const limit = Math.min(parseInt(c.req.query("limit") || "15", 10), 30);
    const MAX_POSTS = 60;

    // 1. Structure canaux (1 appel)
    const chansRaw = await kv.get(`ff:comm-channels:${communityId}`);
    const categories: Array<{ id: string; channels: Array<{ id: string }> }> =
      chansRaw ? JSON.parse(chansRaw) : [];
    const allChannelIds: string[] = categories.flatMap((cat) => (cat.channels || []).map((ch) => ch.id));

    if (allChannelIds.length === 0) return c.json({ leaderboard: [], total: 0 });

    // 2. Index de posts — tout en parallèle
    const idxRaws = await Promise.all(
      allChannelIds.map((id) => kv.get(`ff:ch-posts:${communityId}:${id}`))
    );
    const allPostIds: string[] = [];
    idxRaws.forEach((raw) => { if (raw) allPostIds.push(...JSON.parse(raw)); });

    const uniqueIds = [...new Set(allPostIds)].slice(0, MAX_POSTS);
    if (uniqueIds.length === 0) return c.json({ leaderboard: [], total: 0 });

    // 3. Posts + réactions — tout en parallèle
    const [postRaws, reactionRaws] = await Promise.all([
      Promise.all(uniqueIds.map((pid) => kv.get(`ff:comm-post:${pid}`))),
      Promise.all(uniqueIds.map((pid) => kv.get(`ff:post-reactions:counts:${pid}`))),
    ]);

    // 4. Agréger
    const userStats: Record<string, { userId: string; name: string; avatar: string; posts: number; reactionsReceived: number }> = {};

    postRaws.forEach((raw, i) => {
      if (!raw) return;
      let post: Record<string, any>;
      try { post = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return; }

      const uid = post.userId || "unknown";
      if (!userStats[uid]) {
        userStats[uid] = { userId: uid, name: post.author || uid, avatar: post.avatar || "", posts: 0, reactionsReceived: 0 };
      }
      userStats[uid].posts++;

      const cr = reactionRaws[i];
      if (cr) {
        let counts: Record<string, number> = {};
        try { counts = typeof cr === "string" ? JSON.parse(cr) : cr; } catch { /* skip */ }
        userStats[uid].reactionsReceived += Object.values(counts).reduce((s: number, v: number) => s + v, 0);
      }
    });

    const leaderboard = Object.values(userStats)
      .map((u) => ({ ...u, score: u.posts * 5 + u.reactionsReceived * 2 }))
      .sort((a, b) => b.score - a.score).slice(0, limit);

    console.log(`GET leaderboard: community=${communityId}, scanned=${uniqueIds.length}, entries=${leaderboard.length}`);
    return c.json({ leaderboard, total: Object.keys(userStats).length });
  } catch (err) {
    console.error("Erreur GET leaderboard:", err);
    return c.json({ error: `Echec leaderboard: ${err}` }, 500);
  }
});

// DELETE /communities/:id/channels/:channelId/posts/:postId
app.delete("/make-server-218684af/communities/:id/channels/:channelId/posts/:postId", async (c) => {
  try {
    const communityId = c.req.param("id");
    const channelId   = c.req.param("channelId");
    const postId      = c.req.param("postId");
    const { requestedBy } = await c.req.json();

    const raw = await kv.get(`ff:comm-post:${postId}`);
    if (!raw) return c.json({ error: "Post introuvable." }, 404);
    const post = JSON.parse(raw);

    if (post.userId !== requestedBy) {
      const commRaw = await kv.get(`ff:community:${communityId}`);
      if (!commRaw || JSON.parse(commRaw).createdBy !== requestedBy) {
        return c.json({ error: "Non autorisé." }, 403);
      }
    }

    await kv.del(`ff:comm-post:${postId}`);
    const idxKey = `ff:ch-posts:${communityId}:${channelId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");
    await kv.set(idxKey, JSON.stringify(ids.filter((i) => i !== postId)));

    console.log(`Post canal supprimé: id=${postId}, by=${requestedBy}`);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Échec suppression: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// MESSAGES DE COMMUNAUTÉ / CANAUX (chat Discord-like)
// Route : /community/:communityId/messages
// communityId peut être un ID de canal scopé ex: "tribeId-channelId"
// ════════════════════════════════════��═══════════════════════════════════════

// GET /community/:communityId/messages — Récupérer les messages d'un canal
app.get("/make-server-218684af/community/:communityId/messages", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const limit = Math.min(parseInt(c.req.query("limit") || "200", 10), 500);

    const idxKey = `ff:cmsgs:${communityId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");

    const messages = [];
    for (const id of ids.slice(0, limit)) {
      const raw = await kv.get(`ff:cmsg:${id}`);
      if (!raw) continue;
      const msg = JSON.parse(raw);
      if (msg.createdAt) msg.timestamp = relativeTime(msg.createdAt);
      messages.push(msg);
    }

    // Messages sont stockés du plus récent au plus ancien — on les inverse pour l'affichage
    messages.reverse();

    console.log(`GET community/${communityId}/messages — ${messages.length} messages`);
    return c.json({ messages, total: ids.length });
  } catch (err) {
    console.error("Erreur GET community messages:", err);
    return c.json({ error: `Échec récupération messages: ${err}` }, 500);
  }
});

// POST /community/:communityId/messages — Envoyer un message dans un canal
app.post("/make-server-218684af/community/:communityId/messages", async (c) => {
  try {
    const communityId = c.req.param("communityId");
    const body = await c.req.json();
    const { userId, author, handle, avatar, content, parentId, image, sharedPostId, sharedPostSnapshot } = body;

    if (!userId)          return c.json({ error: "userId requis." }, 400);
    if (!content?.trim()) return c.json({ error: "content requis." }, 400);

    const id = genId();
    const createdAt = new Date().toISOString();

    const message = {
      id,
      communityId,
      parentId: parentId ?? null,
      userId,
      author: author || userId,
      handle: handle || `@${userId}`,
      avatar: avatar || "",
      content: content.trim(),
      image: image || null,
      sharedPostId: sharedPostId || null,
      sharedPostSnapshot: sharedPostSnapshot || null,
      createdAt,
      timestamp: "À l'instant",
    };

    await kv.set(`ff:cmsg:${id}`, JSON.stringify(message));

    // Index chronologique inversé (plus récent en tête)
    const idxKey = `ff:cmsgs:${communityId}`;
    const ids: string[] = JSON.parse((await kv.get(idxKey)) || "[]");
    ids.unshift(id);
    if (ids.length > 1000) ids.splice(1000);
    await kv.set(idxKey, JSON.stringify(ids));

    // Progression : compteur de messages pour Fcoins
    if (userId) {
      const cnt = parseInt((await kv.get(`ff:msg-count:${userId}`)) || "0") + 1;
      await kv.set(`ff:msg-count:${userId}`, String(cnt));
      await addProgressScore(userId, 2);
      await checkAndAwardFcoins(userId);
    }

    console.log(`Message communauté créé: id=${id}, community=${communityId}, user=${userId}`);
    return c.json({ success: true, message });
  } catch (err) {
    console.error("Erreur POST community message:", err);
    return c.json({ error: `Échec envoi message: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ANNEAUX D'ACTIVITÉ — Style Apple Fitness (cycle 3 jours)
// ════════════════════════════════════════════════════════════════════════════

// GET /rings/:userId — Calcul des 3 anneaux d'activité sur le cycle courant
app.get("/make-server-218684af/rings/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);

    // ── Résolution supabaseId → username ──────────────────────────────────────
    // Les posts/goals sont indexés par username ; les commentaires/activity par supabaseId
    const username = await resolveUsername(userId);
    const uKey = username || userId; // clé KV pour posts, goals, community messages

    // ── Cycle de 3 jours (basé sur l'epoch Unix) ─────────────────────────────
    const nowMs    = Date.now();
    const CYCLE_MS = 3 * 86400 * 1000;
    const cycleIdx = Math.floor(nowMs / CYCLE_MS);
    const cycleStartISO = new Date(cycleIdx * CYCLE_MS).toISOString();
    const cycleEndISO   = new Date((cycleIdx + 1) * CYCLE_MS).toISOString();

    // ── Logs d'activité fusionnés (supabaseId + username pour compatibilité) ──
    type LogEntry = { id?: string; actionType: string; createdAt: string; data?: Record<string, unknown> };
    const [logRaw1, logRaw2] = await Promise.all([
      kv.get(`ff:activity-log:${userId}`),
      username && username !== userId ? kv.get(`ff:activity-log:${username}`) : Promise.resolve(null),
    ]);
    const rawLog: LogEntry[] = [
      ...(logRaw1 ? JSON.parse(logRaw1) : []),
      ...(logRaw2 ? JSON.parse(logRaw2) : []),
    ];
    // Déduplication par id composite
    const seenIds = new Set<string>();
    const allLog = rawLog.filter((e) => {
      const eid = e.id || `${e.actionType}|${e.createdAt}`;
      if (seenIds.has(eid)) return false;
      seenIds.add(eid);
      return true;
    });
    const cycleLog = allLog.filter((e) => e.createdAt >= cycleStartISO && e.createdAt < cycleEndISO);

    // ━━━━━━━━━━━━━━━��━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🟣 ANNEAU VIOLET — Delta de progression dans le cycle courant (snapshot)
    //    Formule : (deltaObjectif / 3) × 100   —   cap 100%
    //    1% de progrès ce cycle = 33% | 3% = 100%
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let goalPct = 0; // delta dans le cycle
    try {
      const goalsRaw = await kv.get(`ff:goals:${uKey}`);
      if (goalsRaw) {
        const goals: Array<{ progress: number; status: string }> = JSON.parse(goalsRaw);
        const primary = goals.find((g) => g.status === "en_cours") ?? goals[0];
        if (primary) {
          const currentPct = primary.progress || 0;
          // Snapshot : enregistre la progression au début du cycle (lazy init)
          const snapKey = `ff:goal-snap:${uKey}:${cycleIdx}`;
          const snapRaw = await kv.get(snapKey);
          if (!snapRaw) {
            // Premier accès du cycle → enregistrer le baseline
            await kv.set(snapKey, JSON.stringify({ progress: currentPct }));
            goalPct = 0; // pas encore de progrès mesurable ce cycle
          } else {
            const snap = JSON.parse(snapRaw);
            goalPct = Math.max(0, currentPct - (snap.progress || 0));
          }
        }
      }
    } catch (e) { console.log("Rings purple error:", e); }
    const purple = Math.min(100, Math.round((goalPct / 3) * 100));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🌸 ANNEAU ROSE — Contribution qualitative dans le cycle
    //    Posts : max 3 × 20% = 60%
    //    Commentaires qualifiés (Conseil|Encouragement + ≥10c|réaction|réponse) : max 5 × 8% = 40%
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let postContrib    = 0;
    let commentContrib = 0;
    try {
      // Posts — indexés par USERNAME (uKey)
      const postIds: string[] = JSON.parse((await kv.get(`ff:posts:user:${uKey}`)) || "[]");
      let cyclePostCount = 0;
      for (const pid of postIds.slice(0, 80)) {
        if (cyclePostCount >= 3) break;
        const raw = await kv.get(`ff:post:${pid}`);
        if (!raw) continue;
        const post = JSON.parse(raw);
        if (post.createdAt >= cycleStartISO && post.createdAt < cycleEndISO) cyclePostCount++;
      }
      postContrib = Math.min(3, cyclePostCount) * 20;

      // Commentaires — indexés par userId (supabaseId pour récents) ET username (anciens)
      const [cIds1, cIds2] = await Promise.all([
        kv.get(`ff:comments:user:${userId}`).then((r) => (r ? JSON.parse(r) : []) as string[]),
        username && username !== userId
          ? kv.get(`ff:comments:user:${username}`).then((r) => (r ? JSON.parse(r) : []) as string[])
          : Promise.resolve([] as string[]),
      ]);
      const allCommentIds: string[] = [...new Set([...cIds1, ...cIds2])];
      let qualifiedCount = 0;
      for (const cid of allCommentIds.slice(0, 80)) {
        if (qualifiedCount >= 5) break;
        const raw = await kv.get(`ff:comment:${cid}`);
        if (!raw) continue;
        const comment = JSON.parse(raw);
        if (!comment.createdAt || comment.createdAt < cycleStartISO || comment.createdAt >= cycleEndISO) continue;
        if (comment.commentType !== "Conseil" && comment.commentType !== "Encouragement") continue;
        const hasLength   = (comment.content || "").length > 10;
        const hasReaction = Object.values(comment.reactionCounts || {}).some((v) => (v as number) > 0);
        const hasReply    = (comment.repliesCount || 0) > 0;
        if (hasLength || hasReaction || hasReply) qualifiedCount++;
      }
      commentContrib = Math.min(5, qualifiedCount) * 8;
    } catch (e) { console.log("Rings pink error:", e); }
    const pink = Math.min(100, Math.round(postContrib + commentContrib));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔴 ANNEAU ROUGE — Engagement global (score pondéré / 50 × 100)
    //    Réaction donnée +1 (max 20) | Commentaire +3 (max 10) | Réponse +2 (max 10)
    //    Message communauté +3 (max 10) | Réaction reçue +2 (max 20) | Commentaire reçu +4 (max 10)
    //    Diminishing returns -30% après 25 pts
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let engagementRaw = 0;
    try {
      let reactionsGiven = 0, commentsGiven = 0, repliesGiven = 0, msgsGiven = 0;
      let receivedReactions = 0, receivedComments = 0;
      for (const ev of cycleLog) {
        switch (ev.actionType) {
          case "reaction":           reactionsGiven++;    break;
          case "comment":            commentsGiven++;     break;
          case "reply":              repliesGiven++;      break;
          case "community_message":
          case "channel_post":       msgsGiven++;         break;
          case "received_reaction":  receivedReactions++; break;
          case "received_comment":   receivedComments++;  break;
        }
      }
      const rScore    = Math.min(20, reactionsGiven)    * 1;
      const cScore    = Math.min(10, commentsGiven)     * 3;
      const repScore  = Math.min(10, repliesGiven)      * 2;
      const mScore    = Math.min(10, msgsGiven)         * 3;
      const recRScore = Math.min(20, receivedReactions) * 2;
      const recCScore = Math.min(10, receivedComments)  * 4;
      let total = rScore + cScore + repScore + mScore + recRScore + recCScore;
      // Diminishing returns après 25 pts (50% cible)
      const THRESHOLD = 25;
      if (total > THRESHOLD) total = THRESHOLD + (total - THRESHOLD) * 0.7;
      engagementRaw = total;
    } catch (e) { console.log("Rings red error:", e); }
    const red = Math.min(100, Math.round((engagementRaw / 50) * 100));

    console.log(`GET rings/${userId} (${uKey}): purple=${purple}(Δgoal=${goalPct}%), pink=${pink}(posts=${postContrib}+cmts=${commentContrib}), red=${red}(pts=${Math.round(engagementRaw)})`);
    return c.json({
      purple,
      pink,
      red,
      cycle: { start: cycleStartISO, end: cycleEndISO, index: cycleIdx },
      meta: { goalPct, postContrib, commentContrib, engagementPts: Math.round(engagementRaw) },
    });
  } catch (err) {
    console.error("Erreur rings:", err);
    return c.json({ error: `Échec rings: ${err}` }, 500);
  }
});

// ── GET /giphy/search — Proxy de recherche GIPHY ─────────────────────────────
app.get("/make-server-218684af/giphy/search", async (c) => {
  try {
    const q     = c.req.query("q") ?? "";
    const limit = c.req.query("limit") ?? "20";
    const apiKey = Deno.env.get("GIPHY_API_KEY");
    if (!apiKey) return c.json({ error: "GIPHY_API_KEY non configurée" }, 500);

    const url = `https://api.giphy.com/v1/gifs/${q.trim() ? "search" : "trending"}?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g&lang=fr`;
    const res  = await fetch(url);
    if (!res.ok) return c.json({ error: "Erreur GIPHY API" }, 502);
    const data = await res.json();
    return c.json(data);
  } catch (err) {
    console.error("Erreur giphy/search:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// MODE PRIVÉ DES PROFILS + DEMANDES D'ACCÈS
// ════════════════════════════════════════════════════════════════════════════

// GET /privacy/:username
app.get("/make-server-218684af/privacy/:username", async (c) => {
  try {
    const username = normalizeUsername(c.req.param("username"));
    const raw = await kv.get(`ff:profile:${username}`);
    if (!raw) return c.json({ isPrivate: false, found: false });
    const profile = JSON.parse(raw);
    return c.json({ isPrivate: !!profile.isPrivate, found: true });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// PUT /privacy/:username
app.put("/make-server-218684af/privacy/:username", async (c) => {
  try {
    const username = normalizeUsername(c.req.param("username"));
    const { isPrivate, requestedBy } = await c.req.json();
    if (!requestedBy) return c.json({ error: "requestedBy requis." }, 400);
    if (normalizeUsername(requestedBy) !== username) return c.json({ error: "Non autorisé." }, 403);
    const raw = await kv.get(`ff:profile:${username}`);
    if (!raw) return c.json({ error: "Profil introuvable." }, 404);
    const profile = JSON.parse(raw);
    profile.isPrivate = !!isPrivate;
    profile.updatedAt = new Date().toISOString();
    await kv.set(`ff:profile:${username}`, JSON.stringify(profile));
    console.log(`Privacy: ${username} isPrivate=${isPrivate}`);
    return c.json({ success: true, isPrivate: profile.isPrivate });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// POST /access-requests
app.post("/make-server-218684af/access-requests", async (c) => {
  try {
    const { visitorId, ownerId } = await c.req.json();
    if (!visitorId || !ownerId) return c.json({ error: "visitorId et ownerId requis." }, 400);
    if (visitorId === ownerId) return c.json({ error: "Impossible de se demander l'accès à soi-même." }, 400);
    const idxKey = `ff:access-req-idx:${visitorId}:${ownerId}`;
    const existingReqId = await kv.get(idxKey);
    if (existingReqId) {
      const existingRaw = await kv.get(`ff:access-req:${existingReqId}`);
      if (existingRaw) return c.json({ success: true, request: JSON.parse(existingRaw), alreadyExists: true });
    }
    const id = genId();
    const createdAt = new Date().toISOString();
    const request = { id, visitorId, ownerId, status: "pending", createdAt, updatedAt: createdAt };
    await kv.set(`ff:access-req:${id}`, JSON.stringify(request));
    await kv.set(idxKey, id);
    const ownerReqIds: string[] = JSON.parse((await kv.get(`ff:access-reqs:owner:${ownerId}`)) || "[]");
    if (!ownerReqIds.includes(id)) { ownerReqIds.unshift(id); if (ownerReqIds.length > 200) ownerReqIds.splice(200); }
    await kv.set(`ff:access-reqs:owner:${ownerId}`, JSON.stringify(ownerReqIds));
    // Notification pour le propriétaire
    const notifId = genId();
    const notif = { id: notifId, userId: ownerId, type: "access_request", requestId: id, visitorId, read: false, createdAt };
    await kv.set(`ff:notif:${notifId}`, JSON.stringify(notif));
    const ownerNotifIds: string[] = JSON.parse((await kv.get(`ff:notifs:user:${ownerId}`)) || "[]");
    ownerNotifIds.unshift(notifId);
    if (ownerNotifIds.length > 100) ownerNotifIds.splice(100);
    await kv.set(`ff:notifs:user:${ownerId}`, JSON.stringify(ownerNotifIds));
    console.log(`Demande d'accès: id=${id}, visitor=${visitorId}, owner=${ownerId}`);
    return c.json({ success: true, request });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// GET /access-requests/status
app.get("/make-server-218684af/access-requests/status", async (c) => {
  try {
    const visitorId = c.req.query("visitorId");
    const ownerId = c.req.query("ownerId");
    if (!visitorId || !ownerId) return c.json({ error: "visitorId et ownerId requis." }, 400);
    const reqId = await kv.get(`ff:access-req-idx:${visitorId}:${ownerId}`);
    if (!reqId) return c.json({ status: "none", request: null });
    const raw = await kv.get(`ff:access-req:${reqId}`);
    if (!raw) return c.json({ status: "none", request: null });
    return c.json({ status: JSON.parse(raw).status, request: JSON.parse(raw) });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// GET /access-requests?ownerId=xxx
app.get("/make-server-218684af/access-requests", async (c) => {
  try {
    const ownerId = c.req.query("ownerId");
    if (!ownerId) return c.json({ error: "ownerId requis." }, 400);
    const reqIds: string[] = JSON.parse((await kv.get(`ff:access-reqs:owner:${ownerId}`)) || "[]");
    const requests = [];
    for (const id of reqIds) {
      const raw = await kv.get(`ff:access-req:${id}`);
      if (!raw) continue;
      const req = JSON.parse(raw);
      const vRaw = await kv.get(`ff:profile:${req.visitorId}`);
      if (vRaw) { const vp = JSON.parse(vRaw); req.visitorName = vp.name || req.visitorId; req.visitorAvatar = vp.avatar || ""; req.visitorObjective = vp.objective || ""; }
      if (req.createdAt) req.timestamp = relativeTime(req.createdAt);
      requests.push(req);
    }
    return c.json({ requests, total: requests.length });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// PUT /access-requests/:id
app.put("/make-server-218684af/access-requests/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { action, ownerId } = await c.req.json();
    if (!action || !["accept", "refuse"].includes(action)) return c.json({ error: "action: 'accept' ou 'refuse'." }, 400);
    if (!ownerId) return c.json({ error: "ownerId requis." }, 400);
    const raw = await kv.get(`ff:access-req:${id}`);
    if (!raw) return c.json({ error: "Demande introuvable." }, 404);
    const request = JSON.parse(raw);
    if (normalizeUsername(request.ownerId) !== normalizeUsername(ownerId)) return c.json({ error: "Non autorisé." }, 403);
    const newStatus = action === "accept" ? "accepted" : "refused";
    request.status = newStatus;
    request.updatedAt = new Date().toISOString();
    await kv.set(`ff:access-req:${id}`, JSON.stringify(request));
    if (newStatus === "accepted") {
      const acceptedKey = `ff:profile-access:${ownerId}`;
      const accepted: string[] = JSON.parse((await kv.get(acceptedKey)) || "[]");
      if (!accepted.includes(request.visitorId)) { accepted.push(request.visitorId); await kv.set(acceptedKey, JSON.stringify(accepted)); }
    } else {
      const acceptedKey = `ff:profile-access:${ownerId}`;
      const accepted: string[] = JSON.parse((await kv.get(acceptedKey)) || "[]");
      await kv.set(acceptedKey, JSON.stringify(accepted.filter((v: string) => v !== request.visitorId)));
    }
    // Notifier le visiteur
    const notifId = genId();
    const notif = { id: notifId, userId: request.visitorId, type: `access_${newStatus}`, requestId: id, ownerId, read: false, createdAt: new Date().toISOString() };
    await kv.set(`ff:notif:${notifId}`, JSON.stringify(notif));
    const vNotifIds: string[] = JSON.parse((await kv.get(`ff:notifs:user:${request.visitorId}`)) || "[]");
    vNotifIds.unshift(notifId); if (vNotifIds.length > 100) vNotifIds.splice(100);
    await kv.set(`ff:notifs:user:${request.visitorId}`, JSON.stringify(vNotifIds));
    console.log(`Accès ${action}: id=${id}, visitor=${request.visitorId}, owner=${ownerId}`);
    return c.json({ success: true, request });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// GET /access-requests/check?ownerId=xxx&visitorId=yyy
app.get("/make-server-218684af/access-requests/check", async (c) => {
  try {
    const ownerId = c.req.query("ownerId");
    const visitorId = c.req.query("visitorId");
    if (!ownerId || !visitorId) return c.json({ error: "ownerId et visitorId requis." }, 400);
    const accepted: string[] = JSON.parse((await kv.get(`ff:profile-access:${ownerId}`)) || "[]");
    return c.json({ hasAccess: accepted.includes(visitorId) });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// GET /notifications?userId=xxx
app.get("/make-server-218684af/notifications", async (c) => {
  try {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const notifIds: string[] = JSON.parse((await kv.get(`ff:notifs:user:${userId}`)) || "[]");
    const notifications = [];
    for (const id of notifIds.slice(0, limit)) {
      const raw = await kv.get(`ff:notif:${id}`);
      if (!raw) continue;
      const notif = JSON.parse(raw);
      if (notif.createdAt) notif.timestamp = relativeTime(notif.createdAt);
      // Enrichir expéditeur (like / comment / follow)
      if (notif.senderId) { const sRaw = await kv.get(`ff:profile:${notif.senderId}`); if (sRaw) { const sp = JSON.parse(sRaw); notif.senderName = sp.name; notif.senderAvatar = sp.avatar; } }
      if (notif.visitorId) { const vRaw = await kv.get(`ff:profile:${notif.visitorId}`); if (vRaw) { const vp = JSON.parse(vRaw); notif.visitorName = vp.name; notif.visitorAvatar = vp.avatar; } }
      if (notif.ownerId) { const oRaw = await kv.get(`ff:profile:${notif.ownerId}`); if (oRaw) { const op = JSON.parse(oRaw); notif.ownerName = op.name; notif.ownerAvatar = op.avatar; } }
      notifications.push(notif);
    }
    return c.json({ notifications, total: notifIds.length, unreadCount: notifications.filter((n) => !n.read).length });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// PUT /notifications/:id/read
app.put("/make-server-218684af/notifications/:id/read", async (c) => {
  try {
    const id = c.req.param("id");
    const raw = await kv.get(`ff:notif:${id}`);
    if (!raw) return c.json({ error: "Notification introuvable." }, 404);
    const notif = JSON.parse(raw);
    notif.read = true;
    await kv.set(`ff:notif:${id}`, JSON.stringify(notif));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// GET /notifications/unread-count?userId=xxx — Compte rapide des non-lues
app.get("/make-server-218684af/notifications/unread-count", async (c) => {
  try {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const notifIds: string[] = JSON.parse((await kv.get(`ff:notifs:user:${userId}`)) || "[]");
    let count = 0;
    for (const id of notifIds.slice(0, 100)) {
      const raw = await kv.get(`ff:notif:${id}`);
      if (!raw) continue;
      const notif = JSON.parse(raw);
      if (!notif.read) count++;
    }
    return c.json({ unreadCount: count });
  } catch (err) {
    return c.json({ error: `Erreur unread-count: ${err}` }, 500);
  }
});

// PUT /notifications/mark-all-read?userId=xxx
app.put("/make-server-218684af/notifications/mark-all-read", async (c) => {
  try {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "userId requis." }, 400);
    const notifIds: string[] = JSON.parse((await kv.get(`ff:notifs:user:${userId}`)) || "[]");
    for (const id of notifIds) {
      const raw = await kv.get(`ff:notif:${id}`);
      if (!raw) continue;
      const notif = JSON.parse(raw);
      if (!notif.read) { notif.read = true; await kv.set(`ff:notif:${id}`, JSON.stringify(notif)); }
    }
    return c.json({ success: true, marked: notifIds.length });
  } catch (err) {
    return c.json({ error: `Erreur mark-all-read: ${err}` }, 500);
  }
});

// ── GET /user-stats/cash/:userId ─────────────────────────────────────────────
app.get("/make-server-218684af/user-stats/cash/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const raw = await kv.get(`ff:cash:${userId}`);
    const cash = raw ? JSON.parse(raw).total : 0;
    return c.json({ cash });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// ── PUT /user-stats/cash/:userId — modifie le total (±, plancher 0) ──────────
app.put("/make-server-218684af/user-stats/cash/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { amount } = await c.req.json();
    if (typeof amount !== "number" || isNaN(amount)) return c.json({ error: "amount invalide." }, 400);
    const raw = await kv.get(`ff:cash:${userId}`);
    const existing = raw ? JSON.parse(raw).total : 0;
    const newTotal = Math.max(0, existing + amount);
    await kv.set(`ff:cash:${userId}`, JSON.stringify({ total: newTotal, updatedAt: new Date().toISOString() }));
    console.log(`Cash update: user=${userId}, delta=${amount > 0 ? "+" : ""}${amount}, total=${newTotal}`);
    return c.json({ cash: newTotal });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// ── GET /user-stats/hours/:userId ────────────────────────────────────────────
app.get("/make-server-218684af/user-stats/hours/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const raw = await kv.get(`ff:hours:${userId}`);
    const hours = raw ? JSON.parse(raw).total : 0;
    return c.json({ hours });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// ── PUT /user-stats/hours/:userId — modifie le total (±, plancher 0) ─────────
app.put("/make-server-218684af/user-stats/hours/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const { amount } = await c.req.json();
    if (typeof amount !== "number" || isNaN(amount)) return c.json({ error: "amount invalide." }, 400);
    const raw = await kv.get(`ff:hours:${userId}`);
    const existing = raw ? JSON.parse(raw).total : 0;
    const newTotal = Math.max(0, existing + amount);
    await kv.set(`ff:hours:${userId}`, JSON.stringify({ total: newTotal, updatedAt: new Date().toISOString() }));
    console.log(`Hours update: user=${userId}, delta=${amount > 0 ? "+" : ""}${amount}, total=${newTotal}`);
    return c.json({ hours: newTotal });
  } catch (err) {
    return c.json({ error: `Erreur: ${err}` }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// EMAIL SENDING VIA RESEND
// ════════════════════════════════════════════════════════════════════════════

// POST /send-email — Envoyer un email via Resend
app.post("/make-server-218684af/send-email", async (c) => {
  try {
    const body = await c.req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return c.json({ error: "to, subject et html sont requis." }, 400);
    }

    const { data, error } = await resend.emails.send({
      from: "FuturFeed <contact@email.futurfeed.com>", // Remplace par ton domaine vérifié chez Resend
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Erreur envoi email:", error);
      return c.json({ error: `Échec envoi: ${error.message}` }, 500);
    }

    console.log(`Email envoyé à ${to} | ID: ${data?.id}`);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("Erreur send-email:", err);
    return c.json({ error: `Échec serveur: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);