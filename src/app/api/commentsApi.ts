import { projectId, publicAnonKey } from "/utils/supabase/info";
import type { EloCommentType } from "../lib/eloAlgorithm";
export type { EloCommentType };

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Types ────────────────────────────────────────────────────────────────────

export type CommentType =
  | "Conseil(s)"
  | "Encouragement"
  | "Réaction";

export type ReactionType = "Actionnable" | "Motivant";

export interface ApiComment {
  id: string;
  postId: string;
  userId: string;
  author: string;
  avatar: string;
  content: string;
  commentType: CommentType | null;
  reactionCounts: Record<ReactionType, number>;
  repliesCount: number;
  createdAt: string;
  timestamp?: string;
  myReaction?: ReactionType | null;
  /** Optimistic reply injected client-side before server confirms */
  optimisticReply?: ApiReply;
}

export interface ApiReply {
  id: string;
  commentId: string;
  userId: string;
  author: string;
  avatar: string;
  content: string;
  createdAt: string;
  timestamp?: string;
}

export interface CreateCommentPayload {
  postId: string;
  userId: string;
  content: string;
  commentType?: CommentType | null;
  eloType?: EloCommentType;
  author?: string;
  avatar?: string;
}

export interface CreateReplyPayload {
  userId: string;
  content: string;
  author?: string;
  avatar?: string;
}

// ── Commentaires ─────────────────────────────────────────────────────────────

/** Créer un commentaire */
export async function createComment(payload: CreateCommentPayload): Promise<{ success: boolean; comment: ApiComment }> {
  const res = await fetch(`${BASE}/comments`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Récupérer les commentaires d'un post (triés: Conseil > reste, par reactions) */
export async function getPostComments(
  postId: string,
  options?: { userId?: string; limit?: number }
): Promise<{ comments: ApiComment[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.userId) params.set("userId", options.userId);
  if (options?.limit)  params.set("limit", String(options.limit));
  const qs = params.toString() ? `?${params}` : "";
  const res = await fetch(`${BASE}/comments/post/${encodeURIComponent(postId)}${qs}`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Récupérer les commentaires d'un utilisateur */
export async function getUserComments(userId: string, limit = 50): Promise<{ comments: ApiComment[]; total: number }> {
  const res = await fetch(`${BASE}/comments/user/${encodeURIComponent(userId)}?limit=${limit}`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

// ── Réponses ─────────────────────────────────────────────────────────────────

/** Créer une réponse à un commentaire */
export async function createReply(
  commentId: string,
  payload: CreateReplyPayload
): Promise<{ success: boolean; reply: ApiReply }> {
  const res = await fetch(`${BASE}/comments/${encodeURIComponent(commentId)}/replies`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Récupérer les réponses d'un commentaire */
export async function getCommentReplies(commentId: string): Promise<{ replies: ApiReply[]; total: number }> {
  const res = await fetch(`${BASE}/comments/${encodeURIComponent(commentId)}/replies`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

// ── Réactions ─────────────────────────────────────────────────────────────────

export interface CommentReactionResult {
  success: boolean;
  removed: boolean;
  myReaction: ReactionType | null;
  reactionCounts: Record<ReactionType, number>;
}

/**
 * Ajouter, changer ou retirer (toggle) une réaction à un commentaire.
 * Un seul appel POST : le backend gère le toggle automatiquement.
 */
export async function reactToComment(
  commentId: string,
  userId: string,
  reactionType: ReactionType
): Promise<CommentReactionResult> {
  const res = await fetch(`${BASE}/comments/${encodeURIComponent(commentId)}/reactions`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ userId, reactionType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data as CommentReactionResult;
}

/** Retirer sa réaction d'un commentaire (DELETE explicite — fallback) */
export async function removeReaction(commentId: string, userId: string): Promise<{ success: boolean }> {
  const res = await fetch(
    `${BASE}/comments/${encodeURIComponent(commentId)}/reactions/${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Récupérer les réactions d'un commentaire */
export async function getCommentReactions(commentId: string): Promise<{ reactionCounts: Record<ReactionType, number> }> {
  const res = await fetch(`${BASE}/comments/${encodeURIComponent(commentId)}/reactions`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const COMMENT_TYPE_LABELS: CommentType[] = [
  "Conseil(s)",
  "Encouragement",
  "Réaction",
];

export const REACTION_TYPES: ReactionType[] = ["Actionnable", "Motivant"];