// Elo-based post visibility algorithm for Fowards.
// All functions are pure and side-effect-free.

export type EloCommentType = "actionnable" | "motivant" | null;

export const ELO_INITIAL = 500;

/**
 * p̂(U, P) = 1 / (1 + 10^((Su - Sp) / 400))
 * Probability that user U engages with post P given their Elo scores.
 */
export function getEngagementProbability(scoreUser: number, scorePost: number): number {
  return 1 / (1 + Math.pow(10, (scoreUser - scorePost) / 400));
}

/**
 * K factor based on post age:
 *   < 24h  → 64  (most sensitive to feedback)
 *   1–7d   → 32
 *   > 7d   → 16
 */
export function getKFactor(createdAt: string | Date): 64 | 32 | 16 {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (ageHours < 24) return 64;
  if (ageHours < 168) return 32;
  return 16;
}

/**
 * Comment utility score normalised to [0, 1].
 * Cutil = L×10 + min(|c|,1000)/50 + Rrep×15 + Btype
 * Rnorm = min(Cutil / 50, 1)
 */
export function getCommentUtility(
  likes: number,
  charCount: number,
  replies: number,
  type: EloCommentType,
): number {
  const btype = type === "actionnable" ? 20 : type === "motivant" ? 10 : 0;
  const cutil = likes * 10 + Math.min(charCount, 1000) / 50 + replies * 15 + btype;
  return Math.min(cutil / 50, 1);
}

/**
 * S'p = Sp + K × (R − p̂)
 * Updates the post Elo score given an observed outcome R.
 */
export function updatePostScore(
  scorePost: number,
  K: number,
  R: number,
  pHat: number,
): number {
  return scorePost + K * (R - pHat);
}

/**
 * Distribution thresholds:
 *   Sp < 700  → 5%
 *   700–799   → 30%
 *   800–899   → 60%
 *   ≥ 900     → 100%
 */
export function getDistributionPercentage(scorePost: number): 5 | 30 | 60 | 100 {
  if (scorePost < 700) return 5;
  if (scorePost < 800) return 30;
  if (scorePost < 900) return 60;
  return 100;
}

/**
 * Returns the subset of users who should see a post, based on its Elo score.
 * Top-Elo users are prioritised for limited distributions.
 */
export function selectUsersToShow<T extends { id: string; eloScore: number }>(
  allUsers: T[],
  scorePost: number,
): T[] {
  const pct = getDistributionPercentage(scorePost);
  if (pct === 100) return allUsers;
  const count = Math.max(1, Math.ceil(allUsers.length * pct / 100));
  return [...allUsers].sort((a, b) => b.eloScore - a.eloScore).slice(0, count);
}
