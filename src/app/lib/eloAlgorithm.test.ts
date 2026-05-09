import { describe, it, expect } from "vitest";
import {
  getEngagementProbability,
  getKFactor,
  getCommentUtility,
  updatePostScore,
  getDistributionPercentage,
  selectUsersToShow,
  ELO_INITIAL,
} from "./eloAlgorithm";

// ── getEngagementProbability ──────────────────────────────────────────────────

describe("getEngagementProbability", () => {
  it("returns 0.5 when both scores are equal", () => {
    expect(getEngagementProbability(500, 500)).toBeCloseTo(0.5);
  });

  it("returns > 0.5 when post score is higher than user score", () => {
    // High-quality post shown to average user → higher expected engagement
    expect(getEngagementProbability(500, 700)).toBeGreaterThan(0.5);
  });

  it("returns < 0.5 when user score is higher than post score", () => {
    // High-quality user shown a low-quality post → lower expected engagement
    expect(getEngagementProbability(700, 500)).toBeLessThan(0.5);
  });

  it("approaches 1 for a much stronger post", () => {
    expect(getEngagementProbability(500, 1200)).toBeGreaterThan(0.98);
  });

  it("approaches 0 for a much stronger user", () => {
    expect(getEngagementProbability(1200, 500)).toBeLessThan(0.02);
  });
});

// ── getKFactor ────────────────────────────────────────────────────────────────

describe("getKFactor", () => {
  it("returns 64 for a brand-new post (< 24h)", () => {
    expect(getKFactor(new Date().toISOString())).toBe(64);
  });

  it("returns 64 for a post published 12 hours ago", () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 3_600_000).toISOString();
    expect(getKFactor(twelveHoursAgo)).toBe(64);
  });

  it("returns 32 for a post published 2 days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3_600_000).toISOString();
    expect(getKFactor(twoDaysAgo)).toBe(32);
  });

  it("returns 32 for a post published exactly 6 days ago", () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3_600_000).toISOString();
    expect(getKFactor(sixDaysAgo)).toBe(32);
  });

  it("returns 16 for a post published 10 days ago", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3_600_000).toISOString();
    expect(getKFactor(tenDaysAgo)).toBe(16);
  });

  it("accepts a Date object", () => {
    expect(getKFactor(new Date())).toBe(64);
  });
});

// ── getCommentUtility ─────────────────────────────────────────────────────────

describe("getCommentUtility", () => {
  it("returns 0 for an empty comment with no engagement and no type", () => {
    expect(getCommentUtility(0, 0, 0, null)).toBe(0);
  });

  it("returns higher score for actionnable vs motivant type", () => {
    const actionnable = getCommentUtility(0, 0, 0, "actionnable");
    const motivant = getCommentUtility(0, 0, 0, "motivant");
    expect(actionnable).toBeGreaterThan(motivant);
    expect(motivant).toBeGreaterThan(0);
  });

  it("actionnable bonus (+20) gives Rnorm = 20/50 = 0.4", () => {
    expect(getCommentUtility(0, 0, 0, "actionnable")).toBeCloseTo(0.4);
  });

  it("motivant bonus (+10) gives Rnorm = 10/50 = 0.2", () => {
    expect(getCommentUtility(0, 0, 0, "motivant")).toBeCloseTo(0.2);
  });

  it("caps the result at 1 regardless of inputs", () => {
    expect(getCommentUtility(100, 1000, 100, "actionnable")).toBe(1);
  });

  it("caps charCount at 1000 characters", () => {
    const at1000 = getCommentUtility(0, 1000, 0, null);
    const at2000 = getCommentUtility(0, 2000, 0, null);
    expect(at1000).toEqual(at2000);
  });

  it("a well-liked comment with replies scores high", () => {
    // 5 likes (50) + 500 chars (10) + 3 replies (45) + actionnable (20) = 125 → Rnorm = 1
    expect(getCommentUtility(5, 500, 3, "actionnable")).toBe(1);
  });
});

// ── updatePostScore ───────────────────────────────────────────────────────────

describe("updatePostScore", () => {
  it("increases the score when R > p̂ (unexpected like)", () => {
    const pHat = 0.3; // model expected 30% engagement
    const newScore = updatePostScore(ELO_INITIAL, 64, 0.7, pHat);
    expect(newScore).toBeGreaterThan(ELO_INITIAL);
  });

  it("decreases the score when R = 0 and p̂ > 0 (ignored)", () => {
    const pHat = 0.5;
    const newScore = updatePostScore(ELO_INITIAL, 32, 0, pHat);
    expect(newScore).toBeLessThan(ELO_INITIAL);
  });

  it("leaves score unchanged when R equals p̂ exactly", () => {
    const pHat = 0.7;
    expect(updatePostScore(ELO_INITIAL, 64, 0.7, pHat)).toBeCloseTo(ELO_INITIAL);
  });

  it("K=64 produces a bigger delta than K=16 for the same outcome", () => {
    const pHat = 0.5;
    const delta64 = Math.abs(updatePostScore(ELO_INITIAL, 64, 0.7, pHat) - ELO_INITIAL);
    const delta16 = Math.abs(updatePostScore(ELO_INITIAL, 16, 0.7, pHat) - ELO_INITIAL);
    expect(delta64).toBeGreaterThan(delta16);
  });

  it("like on a new post (K=64, equal scores): gains +12.8 points", () => {
    // p̂ = 0.5, K = 64, R = 0.7 → delta = 64 × 0.2 = 12.8
    expect(updatePostScore(500, 64, 0.7, 0.5)).toBeCloseTo(512.8);
  });

  it("ignored post (K=32, equal scores): loses -16 points", () => {
    // p̂ = 0.5, K = 32, R = 0 → delta = 32 × (0 - 0.5) = -16
    expect(updatePostScore(500, 32, 0, 0.5)).toBeCloseTo(484);
  });
});

// ── getDistributionPercentage ─────────────────────────────────────────────────

describe("getDistributionPercentage", () => {
  it("returns 5% for cold-start posts (Sp = 500)", () => {
    expect(getDistributionPercentage(ELO_INITIAL)).toBe(5);
  });

  it("returns 5% up to (but not including) 700", () => {
    expect(getDistributionPercentage(699)).toBe(5);
    expect(getDistributionPercentage(0)).toBe(5);
  });

  it("returns 30% for Sp ∈ [700, 800[", () => {
    expect(getDistributionPercentage(700)).toBe(30);
    expect(getDistributionPercentage(799)).toBe(30);
  });

  it("returns 60% for Sp ∈ [800, 900[", () => {
    expect(getDistributionPercentage(800)).toBe(60);
    expect(getDistributionPercentage(899)).toBe(60);
  });

  it("returns 100% for Sp ≥ 900", () => {
    expect(getDistributionPercentage(900)).toBe(100);
    expect(getDistributionPercentage(1500)).toBe(100);
  });
});

// ── selectUsersToShow ─────────────────────────────────────────────────────────

const MOCK_USERS = Array.from({ length: 100 }, (_, i) => ({
  id: `u${i}`,
  eloScore: 400 + i * 5, // scores from 400 to 895
}));

describe("selectUsersToShow", () => {
  it("returns all users when post Elo ≥ 900 (100% distribution)", () => {
    expect(selectUsersToShow(MOCK_USERS, 900)).toHaveLength(100);
  });

  it("returns ~5% (5 users) for a cold-start post", () => {
    expect(selectUsersToShow(MOCK_USERS, 500)).toHaveLength(5);
  });

  it("returns ~30% (30 users) for Sp = 750", () => {
    expect(selectUsersToShow(MOCK_USERS, 750)).toHaveLength(30);
  });

  it("returns ~60% (60 users) for Sp = 850", () => {
    expect(selectUsersToShow(MOCK_USERS, 850)).toHaveLength(60);
  });

  it("prioritises higher-Elo users for limited distributions", () => {
    const selected = selectUsersToShow(MOCK_USERS, 500); // 5% → top 5
    const minElo = Math.min(...selected.map((u) => u.eloScore));
    const maxEloInAll = Math.max(...MOCK_USERS.map((u) => u.eloScore));
    // All selected users should be near the top
    expect(minElo).toBeGreaterThan(maxEloInAll - 30);
  });

  it("never returns more users than the total population", () => {
    const small = [{ id: "a", eloScore: 800 }, { id: "b", eloScore: 600 }];
    expect(selectUsersToShow(small, 500).length).toBeLessThanOrEqual(2);
  });

  it("always returns at least 1 user when the list is non-empty", () => {
    const oneUser = [{ id: "x", eloScore: 500 }];
    expect(selectUsersToShow(oneUser, 500).length).toBeGreaterThanOrEqual(1);
  });
});
