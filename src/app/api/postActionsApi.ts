import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

export interface ReportResult {
  success: boolean;
  deleted: boolean;
  alreadyReported?: boolean;
  reason?: string;
  reportCount?: number;
}

/** Signale un post pour contenu inapproprié.
 *  Le backend analyse automatiquement et supprime si vraiment inapproprié. */
export async function reportInappropriate(
  postId: string,
  reporterId: string
): Promise<ReportResult> {
  const res = await fetch(`${BASE}/post-actions/report-inappropriate`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ postId, reporterId }),
  });
  if (!res.ok) throw new Error(`Erreur signalement (${res.status})`);
  return res.json();
}

/** Enregistre la préférence de voir moins de posts d'un auteur. */
export async function reduceAuthor(
  userId: string,
  authorUsername: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/post-actions/reduce-author`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ userId, authorUsername }),
  });
  if (!res.ok) throw new Error(`Erreur préférence auteur (${res.status})`);
  return res.json();
}

/** Marque un post comme non pertinent pour l'utilisateur. */
export async function markNotRelevant(
  userId: string,
  postId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/post-actions/not-relevant`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ userId, postId }),
  });
  if (!res.ok) throw new Error(`Erreur non-pertinent (${res.status})`);
  return res.json();
}
