import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Toggle membership (join si absent, leave si présent) ──────────────────────
export async function toggleCommunityMembership(
  userId: string,
  communityId: string
): Promise<{ isMember: boolean; memberCount: number }> {
  const res = await fetch(`${BASE}/community-members`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ userId, communityId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Échec abonnement communauté (${res.status})`);
  }
  return res.json();
}

// ── Statut de membership d'un utilisateur pour une communauté ────────────────
export async function getCommunityMemberStatus(
  communityId: string,
  userId: string
): Promise<{ isMember: boolean; memberCount: number }> {
  const res = await fetch(
    `${BASE}/community-members/${encodeURIComponent(communityId)}/status?userId=${encodeURIComponent(userId)}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Échec statut membership (${res.status})`);
  return res.json();
}

// ── Batch status pour plusieurs communautés ───────────────────────────────────
export async function getBatchCommunityStatus(
  userId: string,
  communityIds: string[]
): Promise<Record<string, boolean>> {
  if (communityIds.length === 0) return {};
  const ids = communityIds.join(",");
  const res = await fetch(
    `${BASE}/community-members/batch-status?userId=${encodeURIComponent(userId)}&communityIds=${encodeURIComponent(ids)}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Échec batch status (${res.status})`);
  const data = await res.json();
  return data.statuses ?? {};
}

// ── Communautés rejointes par un utilisateur ─────────────────────────────────
export async function getUserCommunities(userId: string): Promise<string[]> {
  const res = await fetch(`${BASE}/user-communities/${encodeURIComponent(userId)}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Échec récupération communautés user (${res.status})`);
  const data = await res.json();
  return data.communityIds ?? [];
}
