import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommunityPostData {
  id: string;
  communityId: string;
  avatar: string;
  name: string;
  timestamp: string;
  role: string;
  memberSince: string;
  badge: string;
  text: string;
  image?: string;
  repliesCount: number;
  hashtags: string[];
  reactionCounts?: Record<string, number>;
  reactionTotal?: number;
  myReaction?: string | null;
  liveCommentsCount?: number;
}

export type SeedPost = Omit<CommunityPostData, "reactionCounts" | "reactionTotal" | "myReaction" | "liveCommentsCount">;

// ── Fonctions API ──────────────────────────────────────────────────────────────

/** Semer les posts communautaires dans Supabase (idempotent par ID) */
export async function seedCommunityPosts(
  posts: SeedPost[]
): Promise<{ success: boolean; seeded: number; skipped: number }> {
  const res = await fetch(`${BASE}/community-posts/seed`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ posts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}

/** Récupérer les posts communautaires d'un hashtag */
export async function getCommunityPostsByHashtag(
  tag: string,
  userId?: string,
  limit = 50
): Promise<{ posts: CommunityPostData[]; total: number; tag: string }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (userId) params.set("userId", userId);
  const res = await fetch(
    `${BASE}/community-posts/hashtag/${encodeURIComponent(tag)}?${params}`,
    { headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data;
}
