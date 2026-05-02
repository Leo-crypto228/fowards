import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FollowResult {
  success: boolean;
  following: boolean;   // true = now following, false = now unfollowed
  followingCount: number;
}

// ── Follow / Unfollow (toggle) ────────────────────────────────────────────────

/**
 * Toggle follow : suit si absent, se désabonne si déjà suivi.
 * Renvoie `following: true` si on suit maintenant, `false` si on s'est désabonné.
 */
export async function toggleFollow(
  followerId: string,
  followingId: string
): Promise<FollowResult> {
  const res = await fetch(`${BASE}/follows`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ followerId, followingId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data as FollowResult;
}

// ── Statut de suivi ───────────────────────────────────────────────────────────

/** Vérifie si followerId suit followingId */
export async function getFollowStatus(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const res = await fetch(
    `${BASE}/follows/${encodeURIComponent(followerId)}/status?targetId=${encodeURIComponent(followingId)}`,
    { headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return (data as { following: boolean }).following;
}

// ── Listes ────────────────────────────────────────────────────────────────────

/** Récupère les IDs des utilisateurs que userId suit */
export async function getFollowing(
  userId: string
): Promise<{ following: string[]; total: number }> {
  const res = await fetch(
    `${BASE}/follows/${encodeURIComponent(userId)}/following`,
    { headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data as { following: string[]; total: number };
}

/** Récupère les IDs des utilisateurs qui suivent userId */
export async function getFollowers(
  userId: string
): Promise<{ followers: string[]; total: number }> {
  const res = await fetch(
    `${BASE}/follows/${encodeURIComponent(userId)}/followers`,
    { headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data as { followers: string[]; total: number };
}

// ── Profils enrichis ──────────────────────────────────────────────────────────

export interface EnrichedProfile {
  username: string;
  name: string;
  avatar: string;
  objective: string;
  streak: number;
}

/** Récupère les profils enrichis (avec avatar) des utilisateurs suivis par userId */
export async function getFollowingProfiles(
  userId: string
): Promise<{ profiles: EnrichedProfile[]; total: number }> {
  try {
    const res = await fetch(
      `${BASE}/follows/${encodeURIComponent(userId)}/following-profiles`,
      { headers: HEADERS }
    );
    if (!res.ok) return { profiles: [], total: 0 };
    return res.json();
  } catch {
    return { profiles: [], total: 0 };
  }
}

/** Récupère les profils enrichis (avec avatar) des abonnés de userId */
export async function getFollowerProfiles(
  userId: string
): Promise<{ profiles: EnrichedProfile[]; total: number }> {
  try {
    const res = await fetch(
      `${BASE}/follows/${encodeURIComponent(userId)}/follower-profiles`,
      { headers: HEADERS }
    );
    if (!res.ok) return { profiles: [], total: 0 };
    return res.json();
  } catch {
    return { profiles: [], total: 0 };
  }
}

// ── Feed abonnements ──────────────────────────────────────────────────────────

export interface FeedPost {
  id: string;
  user: { name: string; avatar: string; objective: string; followers?: number };
  streak: number;
  progress: { type: string; description: string; timestamp: string };
  hashtags: string[];
  image?: string | null;
  verified: boolean;
  relevantCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isNew: boolean;
  createdAt: string;
  username: string;
}

/**
 * Récupère les posts de tous les utilisateurs suivis par userId,
 * triés par date décroissante.
 */
export async function getFollowingFeed(
  userId: string,
  limit = 50
): Promise<{ posts: FeedPost[]; total: number; following: string[] }> {
  const res = await fetch(
    `${BASE}/follows/${encodeURIComponent(userId)}/feed?limit=${limit}`,
    { headers: HEADERS }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data as { posts: FeedPost[]; total: number; following: string[] };
}