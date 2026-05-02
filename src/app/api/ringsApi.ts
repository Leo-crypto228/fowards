import { projectId, publicAnonKey } from "/utils/supabase/info";
import { fetchWithRetry } from "./fetchRetry";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;

export interface RingsData {
  purple: number; // 0-100 : progression objectif
  pink:   number; // 0-100 : contribution qualitative
  red:    number; // 0-100 : engagement global
  cycle: {
    start: string;
    end:   string;
    index: number;
  };
  meta?: {
    goalPct:        number;
    postContrib:    number;
    commentContrib: number;
    engagementPts:  number;
  };
}

export async function getRings(userId: string): Promise<RingsData> {
  const res = await fetchWithRetry(
    `${BASE}/rings/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${publicAnonKey}` } }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Rings fetch error ${res.status}: ${err}`);
  }
  return res.json();
}