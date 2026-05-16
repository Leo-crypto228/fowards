import { projectId, publicAnonKey } from "/utils/supabase/info";
import { fetchWithRetry } from "./fetchRetry";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

export type PostType =
  | "avancee"
  | "question"
  | "blocage"
  | "conseil"
  | "actus"
  // legacy (backward compat)
  | "infos"
  | "new"
  | "avancement"
  | "objectif"
  | "lecon"
  | "bilan";

export interface ApiPost {
  id: string;
  user: {
    name: string;
    avatar: string;
    objective: string;
    followers?: number;
  };
  streak: number;
  progress: {
    type: PostType;
    description: string;
    timestamp: string;
  };
  hashtags: string[];
  image?: string | null;
  images?: string[];
  verified: boolean;
  relevantCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isNew: boolean;
  createdAt: string;
  username: string;
}

export interface CreatePostPayload {
  user: {
    name: string;
    avatar: string;
    objective: string;
    followers?: number;
  };
  streak: number;
  progress: {
    type: PostType;
    description: string;
  };
  hashtags?: string[];
  image?: string;
  images?: string[];
  username: string;
  isAnonymous?: boolean;
}

// Crée un nouveau post
export async function createPost(payload: CreatePostPayload): Promise<{ success: boolean; post: ApiPost }> {
  const res = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur: ${res.status}`);
  return data;
}

// Récupère tous les posts (les plus récents en premier)
export async function getAllPosts(limit = 20, userId?: string, offset = 0): Promise<{ posts: ApiPost[]; total: number; hasMore: boolean }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (userId) params.set("userId", userId);
  if (offset > 0) params.set("offset", String(offset));
  const res = await fetchWithRetry(`${BASE}/posts?${params}`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur: ${res.status}`);
  return data;
}

// Récupère les posts d'un utilisateur spécifique
export async function getUserPosts(username: string, limit = 50, requestingUserId?: string): Promise<{ posts: ApiPost[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (requestingUserId) params.set("requestingUserId", requestingUserId);
  const res = await fetchWithRetry(`${BASE}/posts/user/${encodeURIComponent(username)}?${params}`, {
    headers: HEADERS,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur: ${res.status}`);
  return data;
}

// Supprime un post
export async function deletePost(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: HEADERS,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur: ${res.status}`);
  return data;
}

// Extrait les hashtags d'un texte
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\wÀ-ÿ]+/g) || [];
  return [...new Set(matches)];
}

// Map label UI → clé PostType
export const LABEL_TO_TYPE: Record<string, PostType> = {
  "Avancée":    "avancee",
  "Question":   "question",
  "Blocage":    "blocage",
  "Conseil(s)": "conseil",
  "Actus":      "actus",
  // legacy
  "Infos perso": "infos",
  "New":         "new",
  "Avancement":  "avancement",
  "Objectif":    "objectif",
  "Leçon":       "lecon",
  "Bilan":       "bilan",
};

// Map clé PostType → label UI
export const TYPE_TO_LABEL: Record<PostType, string> = {
  avancee:    "Avancée",
  question:   "Question",
  blocage:    "Blocage",
  conseil:    "Conseil(s)",
  actus:      "Actus",
  // legacy
  infos:      "Infos",
  new:        "Actus",
  avancement: "Avancée",
  objectif:   "Objectif",
  lecon:      "Leçon",
  bilan:      "Bilan",
};

// Les 5 nouveaux types de posts (UI)
export const POST_TYPE_LABELS = ["Avancée", "Question", "Blocage", "Conseil(s)", "Actus"] as const;
