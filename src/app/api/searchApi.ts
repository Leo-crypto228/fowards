import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

export interface SearchPost {
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

export interface SearchUser {
  name: string;
  avatar: string;
  objective: string;
  username: string;
  count: number;
}

export interface SearchHashtag {
  tag: string;
  count: number;
}

export interface SearchResults {
  posts: SearchPost[];
  users: SearchUser[];
  hashtags: SearchHashtag[];
  total: number;
  query: string;
}

export async function search(params: {
  q: string;
  type?: "all" | "posts" | "users" | "hashtags";
  username?: string;
  limit?: number;
}): Promise<SearchResults> {
  const { q, type = "all", username = "", limit = 20 } = params;
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", type);
  if (username) url.searchParams.set("username", username);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur serveur ${res.status}`);
  return data as SearchResults;
}
