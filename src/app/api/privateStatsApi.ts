import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

export interface EloHistoryEntry {
  score: number;
  timestamp: string;
  reason: "like" | "comment_actionnable" | "comment_motivant" | "comment" | "impression";
}

export interface BoostCounts {
  like: number;
  actionnable: number;
  motivant: number;
}

export interface PrivateStats {
  eloScore: number;
  eloHistory: EloHistoryEntry[];
  engagedCount: number;
  distributedCount: number;
  viewsCount: number;
  boostCounts: BoostCounts;
}

export async function getPrivateStats(
  postId: string,
  userId: string,
): Promise<PrivateStats | null> {
  try {
    const res = await fetch(
      `${BASE}/posts/${encodeURIComponent(postId)}/private-stats?userId=${encodeURIComponent(userId)}`,
      { headers: HEADERS },
    );
    if (res.status === 403) return null;
    const data = await res.json();
    if (!res.ok) return null;
    return data as PrivateStats;
  } catch {
    return null;
  }
}

export function recordEngaged(postId: string, userId: string): void {
  fetch(`${BASE}/posts/${encodeURIComponent(postId)}/engaged`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ userId }),
  }).catch(() => {});
}

export function recordDistributed(postId: string, userId: string): void {
  fetch(`${BASE}/posts/${encodeURIComponent(postId)}/distribute`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ userId }),
  }).catch(() => {});
}
