import { projectId, publicAnonKey } from "/utils/supabase/info";
import type { EloCommentType } from "../lib/eloAlgorithm";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

async function post(path: string, body: object): Promise<void> {
  try {
    await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });
  } catch {
    // Elo updates are fire-and-forget — never block the UI on failure
  }
}

/** Called after a post reaction is confirmed by the server (new like only, not unlikes). */
export function triggerEloLike(
  postId: string,
  userId: string,
  postCreatedAt: string,
): void {
  post("/elo/like", { postId, userId, postCreatedAt });
}

/** Called after a comment is saved to the server. */
export function triggerEloComment(
  postId: string,
  userId: string,
  postCreatedAt: string,
  charCount: number,
  eloType: EloCommentType,
): void {
  post("/elo/comment", { postId, userId, postCreatedAt, charCount, eloType });
}

/** Called when a post has been visible for ≥3 s without any engagement.
 *  Idempotent server-side — one event per user/post pair. */
export function triggerEloImpression(
  postId: string,
  userId: string,
  postCreatedAt: string,
): void {
  post("/elo/impression", { postId, userId, postCreatedAt });
}
