import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostSnapshot {
  id: string;
  user: { name: string; avatar: string; objective: string };
  progress: { type: string; description: string; timestamp: string };
  hashtags?: string[];
}

export interface ApiShare {
  id: string;
  originalPostId: string;
  userId: string;
  author: string;
  avatar: string;
  communityId: string;
  communityName: string;
  message: string;
  postSnapshot: PostSnapshot | null;
  createdAt: string;
  timestamp?: string;
}

export interface AnalyticsHistory {
  date: string;
  views: number;
  reactions: number;
  comments: number;
}

export interface ApiAnalytics {
  postId: string;
  viewsCount: number;
  reactionsCount: number;
  commentsCount: number;
  sharesCount?: number;
  history: AnalyticsHistory[];
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/** Récupérer les analytics d'un post */
export async function getPostAnalytics(postId: string): Promise<{ analytics: ApiAnalytics }> {
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(postId)}/analytics`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Incrémenter les vues d'un post (idempotent par sessionId) */
export async function incrementPostView(
  postId: string,
  sessionId: string
): Promise<{ success: boolean; alreadyCounted: boolean; analytics: ApiAnalytics }> {
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(postId)}/view`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Mettre à jour le compteur de réactions dans analytics */
export async function updatePostReactionAnalytics(
  postId: string,
  delta: 1 | -1
): Promise<{ success: boolean; analytics: ApiAnalytics }> {
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(postId)}/reaction`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ delta }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

// ── Partages ──────────────────────────────────────────────────────────────────

export interface SharePostPayload {
  originalPostId: string;
  userId: string;
  author: string;
  avatar: string;
  communityId: string;
  communityName: string;
  message?: string;
  postSnapshot?: PostSnapshot;
}

/** Partager un post dans une communauté */
export async function sharePost(payload: SharePostPayload): Promise<{ success: boolean; share: ApiShare }> {
  const res = await fetch(`${BASE}/shares`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Récupérer les posts partagés dans une communauté */
export async function getCommunityShares(
  communityId: string,
  limit = 50
): Promise<{ shares: ApiShare[]; total: number }> {
  const res = await fetch(
    `${BASE}/shares/community/${encodeURIComponent(communityId)}?limit=${limit}`,
    { headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

// ── Post-réponses ─────────────────────────────────────────────────────────────

/** Enregistrer un lien post-réponse */
export async function linkPostReply(
  originalPostId: string,
  newPostId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/post-replies`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ originalPostId, newPostId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

// ── Réactions aux posts ───────────────────────────────────────────────────────

export type PostReactionType = "Pertinent" | "Motivant" | "Je soutiens" | "J'adore";

export interface PostReactionsData {
  counts: Record<string, number>;
  myReaction: PostReactionType | null;
  total: number;
}

/** Récupérer les réactions d'un post + celle de l'utilisateur
 *  Retry automatique (x2) sur 503 avec backoff exponentiel pour absorber
 *  les pics de concurrence sur l'edge function Supabase. */
export async function getPostReactions(
  postId: string,
  userId: string,
  _attempt = 0
): Promise<PostReactionsData> {
  const res = await fetch(
    `${BASE}/posts/${encodeURIComponent(postId)}/reactions?userId=${encodeURIComponent(userId)}`,
    { headers: HEADERS }
  );
  if (res.status === 503 && _attempt < 2) {
    // Backoff : 400 ms, 900 ms
    await new Promise((r) => setTimeout(r, 400 * Math.pow(2, _attempt) + Math.random() * 100));
    return getPostReactions(postId, userId, _attempt + 1);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data as PostReactionsData;
}

/** Ajouter ou remplacer la réaction d'un utilisateur sur un post */
export async function addPostReaction(
  postId: string,
  userId: string,
  reactionType: PostReactionType
): Promise<PostReactionsData & { removed: boolean }> {
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(postId)}/reactions`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ userId, reactionType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

// ── Utilitaire : session ID stable par onglet ─────────────────────────────────
let _sessionId: string | null = null;
export function getSessionId(): string {
  if (_sessionId) return _sessionId;
  try {
    const stored = sessionStorage.getItem("ff_session_id");
    if (stored) { _sessionId = stored; return stored; }
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("ff_session_id", newId);
    _sessionId = newId;
    return newId;
  } catch {
    _sessionId = `${Date.now()}`;
    return _sessionId;
  }
}

// ── Messages de communauté ────────────────────────────────────────────────────

export interface ApiCommunityMessage {
  id: string;
  communityId: string;
  parentId: string | null;
  userId: string;
  author: string;
  handle: string;
  avatar: string;
  content: string;
  image?: string | null;
  sharedPostId?: string | null;
  sharedPostSnapshot?: PostSnapshot | null;
  createdAt: string;
  timestamp?: string;
}

export interface SendCommunityMessagePayload {
  communityId: string;
  parentId?: string | null;
  userId: string;
  author: string;
  handle: string;
  avatar: string;
  content: string;
  image?: string;
  sharedPostId?: string;
  sharedPostSnapshot?: PostSnapshot;
}

/** Envoyer un message dans la discussion d'une communauté */
export async function sendCommunityMessage(
  payload: SendCommunityMessagePayload
): Promise<{ success: boolean; message: ApiCommunityMessage }> {
  const res = await fetch(
    `${BASE}/community/${encodeURIComponent(payload.communityId)}/messages`,
    { method: "POST", headers: HEADERS, body: JSON.stringify(payload) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Récupérer les messages de la discussion d'une communauté */
export async function getCommunityMessages(
  communityId: string,
  limit = 200
): Promise<{ messages: ApiCommunityMessage[]; total: number }> {
  const res = await fetch(
    `${BASE}/community/${encodeURIComponent(communityId)}/messages?limit=${limit}`,
    { headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}