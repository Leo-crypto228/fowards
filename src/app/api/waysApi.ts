import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

export interface WaysAuthor {
  username: string;
  name: string;
  avatar: string;
}

export interface WaysReply {
  id: string;
  author: WaysAuthor;
  text: string;
  createdAt: string;
}

export interface WaysComment {
  id: string;
  waysId: string;
  author: WaysAuthor;
  text: string;
  createdAt: string;
  replies: WaysReply[];
}

export interface Ways {
  id: string;
  author: WaysAuthor;
  text: string;
  image: string | null;
  createdAt: string;
  expiresAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface WaysFeedEntry {
  author: WaysAuthor;
  ways: Ways[];
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse serveur invalide (${res.status}): ${text.slice(0, 120)}`);
  }
}

export async function createWays(params: {
  username: string;
  text?: string;
  image?: string;
}): Promise<{ ways: Ways }> {
  const res = await fetch(`${BASE}/ways`, { method: "POST", headers: HEADERS, body: JSON.stringify(params) });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || "Erreur création Ways");
  return data;
}

export async function getWaysFeed(userId: string): Promise<{ feed: WaysFeedEntry[] }> {
  const res = await fetch(`${BASE}/ways/feed?userId=${encodeURIComponent(userId)}`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur chargement feed Ways");
  return data;
}

export async function getWays(id: string): Promise<{ ways: Ways }> {
  const res = await fetch(`${BASE}/ways/${id}`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ways introuvable");
  return data;
}

export async function deleteWays(id: string, username: string): Promise<void> {
  const res = await fetch(`${BASE}/ways/${id}`, {
    method: "DELETE",
    headers: HEADERS,
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur suppression Ways");
}

export async function likeWays(id: string, username: string): Promise<{ liked: boolean; likesCount: number }> {
  const res = await fetch(`${BASE}/ways/${id}/like`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur like Ways");
  return data;
}

export async function addWaysComment(
  id: string,
  params: { username: string; name: string; avatar: string; text: string }
): Promise<{ comment: WaysComment }> {
  const res = await fetch(`${BASE}/ways/${id}/comments`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur envoi commentaire");
  return data;
}

export async function getWaysComments(id: string, userId: string): Promise<{ comments: WaysComment[] }> {
  const res = await fetch(`${BASE}/ways/${id}/comments?userId=${encodeURIComponent(userId)}`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur chargement commentaires");
  return data;
}

export async function replyToWaysComment(
  waysId: string,
  commentId: string,
  params: { username: string; text: string }
): Promise<{ reply: WaysReply }> {
  const res = await fetch(`${BASE}/ways/${waysId}/comments/${commentId}/reply`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur réponse commentaire");
  return data;
}
