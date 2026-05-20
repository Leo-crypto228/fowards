import { projectId, publicAnonKey } from "/utils/supabase/info";
import { supabase } from "./supabaseClient";
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
  /** Grade de l'auteur au moment de la création du commentaire */
  authorGrade?: string;
  content: string;
  voiceUrl?: string | null;
  voiceDuration?: number | null;
  videoUrl?: string | null;
  videoDuration?: number | null;
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
  voiceUrl?: string;
  voiceDuration?: number;
  videoUrl?: string;
  videoDuration?: number;
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

/** Toggle une réaction sur un commentaire — via le backend KV */
export async function reactToComment(
  commentId: string,
  userId: string,
  reactionType: ReactionType,
  commentAuthorId?: string,
  postId?: string,
): Promise<CommentReactionResult> {
  const res = await fetch(`${BASE}/comments/${encodeURIComponent(commentId)}/reactions`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ userId, reactionType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);

  // Notifier (fire-and-forget, seulement si ajout)
  if (!data.removed && commentAuthorId && commentAuthorId !== userId) {
    fetch(`${BASE}/notifications/comment-reaction`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ commentId, reactorId: userId, commentAuthorId, postId }),
    }).catch(() => {});
  }

  return data as CommentReactionResult;
}

/** Modifier le contenu d'un commentaire texte */
export async function updateComment(
  commentId: string,
  userId: string,
  content: string,
): Promise<{ success: boolean; comment: ApiComment }> {
  const res = await fetch(`${BASE}/comments/${encodeURIComponent(commentId)}`, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify({ userId, content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Supprimer un commentaire (texte ou vocal) */
export async function deleteComment(
  commentId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const res = await fetch(
    `${BASE}/comments/${encodeURIComponent(commentId)}?userId=${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: HEADERS },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Charger counts + myReaction pour une liste de commentaires depuis Supabase */
export async function loadReactionCounts(
  commentIds: string[],
  userId?: string
): Promise<Record<string, { counts: Record<ReactionType, number>; myReaction: ReactionType | null }>> {
  if (!commentIds.length) return {};
  const { data } = await supabase
    .from("comment_reactions")
    .select("comment_id, user_id, reaction_type")
    .in("comment_id", commentIds);

  const result: Record<string, { counts: Record<ReactionType, number>; myReaction: ReactionType | null }> = {};
  for (const id of commentIds) {
    result[id] = { counts: { Actionnable: 0, Motivant: 0 }, myReaction: null };
  }
  for (const r of data ?? []) {
    const entry = result[r.comment_id];
    if (!entry) continue;
    if (r.reaction_type === "Actionnable") entry.counts.Actionnable++;
    else if (r.reaction_type === "Motivant") entry.counts.Motivant++;
    if (userId && r.user_id === userId) entry.myReaction = r.reaction_type as ReactionType;
  }
  return result;
}

/** @deprecated use reactToComment */
export async function removeReaction(commentId: string, userId: string): Promise<{ success: boolean }> {
  await supabase.from("comment_reactions").delete()
    .eq("comment_id", commentId).eq("user_id", userId);
  return { success: true };
}

/** @deprecated use loadReactionCounts */
export async function getCommentReactions(commentId: string): Promise<{ reactionCounts: Record<ReactionType, number> }> {
  const res = await loadReactionCounts([commentId]);
  return { reactionCounts: res[commentId]?.counts ?? { Actionnable: 0, Motivant: 0 } };
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const COMMENT_TYPE_LABELS: CommentType[] = [
  "Conseil(s)",
  "Encouragement",
  "Réaction",
];

export const REACTION_TYPES: ReactionType[] = ["Actionnable", "Motivant"];