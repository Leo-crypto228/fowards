import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuggestedUser {
  username: string;
  name: string;
  avatar: string;
  objective: string;
  grade: string;
  followersCount: number;
}

export interface SuggestedUsersResult {
  users: SuggestedUser[];
  total: number;
  hasMore: boolean;
}

export interface SuggestedCommunity {
  id: string;
  name: string;
  avatar: string;
  members: number;
  description: string;
  mentality: "Objectif" | "Passion";
}

// ── Suggested users (triés par abonnés décroissant) ───────────────────────────

export async function getSuggestedUsers(
  limit: number,
  offset: number,
  excludeUsername?: string,
  forceRebuild = false,
): Promise<SuggestedUsersResult> {
  const url = new URL(`${BASE}/profiles/suggested`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (excludeUsername) url.searchParams.set("exclude", excludeUsername);
  if (forceRebuild)    url.searchParams.set("rebuild", "true");

  const res = await fetch(url.toString(), { headers: H });
  if (!res.ok) throw new Error(`profiles/suggested ${res.status}`);
  const result: SuggestedUsersResult = await res.json();
  // TEMPORAIRE — diagnostic : retirer une fois les profils confirmés affichés
  console.log("[getSuggestedUsers] result:", JSON.stringify({ total: result.total, count: result.users?.length, hasMore: result.hasMore }));
  return result;
}

// ── Suggested communities (toutes les communautés triées par membres) ─────────

export async function getSuggestedCommunities(): Promise<SuggestedCommunity[]> {
  const res = await fetch(`${BASE}/communities`, { headers: H });
  if (!res.ok) throw new Error(`communities ${res.status}`);
  const data = await res.json();
  const communities: SuggestedCommunity[] = (data.communities ?? []).map((c: any) => ({
    id: String(c.id),
    name: c.name ?? "Communauté",
    avatar: c.avatar
      ? c.avatar.startsWith("http")
        ? c.avatar
        : `https://${projectId}.supabase.co/storage/v1/object/public/${c.avatar}`
      : "",
    members: typeof c.members === "number" ? c.members : 0,
    description: c.description ?? "",
    mentality: c.mentality === "Passion" ? "Passion" : "Objectif",
  }));
  // Triées par membres décroissant
  return communities.sort((a, b) => b.members - a.members);
}
