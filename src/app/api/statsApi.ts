import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

export interface DailyMember {
  id: string;
  name: string;
  avatar: string;
  objective: string;
}

export interface TodayStats {
  date: string;
  posts: number;
  interactions: number;
  members: number;
  newMembers: DailyMember[];
}

export interface HistoryMember extends DailyMember {
  joinedAt: string;
}

export async function getTodayStats(): Promise<TodayStats> {
  const res = await fetch(`${BASE}/stats/today`, { headers: HEADERS });
  if (!res.ok) throw new Error(`stats/today ${res.status}`);
  return res.json();
}

export async function getMembersHistory(limit = 50): Promise<{ members: HistoryMember[]; total: number }> {
  const res = await fetch(`${BASE}/members/history?limit=${limit}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`members/history ${res.status}`);
  return res.json();
}
