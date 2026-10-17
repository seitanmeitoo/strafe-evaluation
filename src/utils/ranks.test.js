import { describe, expect, it } from "vitest";
import { session } from "../test/fixtures";
import { DEFAULT_RANKS, RANK_WINDOW, currentRank, normalizeRanks, sessionScore } from "./ranks";

describe("sessionScore", () => {
  it("is null for a missing or empty session", () => {
    expect(sessionScore(null)).toBeNull();
    expect(sessionScore({ totalStrafes: 0 })).toBeNull();
  });

  it("uses 60 % Perfect and 40 % median without shots", () => {
    expect(sessionScore({ totalStrafes: 30, perfectRate: 50, medianDurationMs: 25 })).toBe(50);
    expect(sessionScore({ totalStrafes: 30, perfectRate: 100, medianDurationMs: 0 })).toBe(100);
  });

  it("adds accuracy (30 %) when there were shots", () => {
    const s = { totalStrafes: 30, perfectRate: 100, medianDurationMs: 0, totalShots: 10, accurateRate: 0 };
    expect(sessionScore(s)).toBe(70);
    expect(sessionScore({ ...s, accurateRate: 100 })).toBe(100);
  });

  it("clamps the median part between 0 and 1", () => {
    expect(sessionScore({ totalStrafes: 30, perfectRate: 0, medianDurationMs: 500 })).toBe(0);
  });
});

describe("normalizeRanks", () => {
  it("falls back to copies of the defaults", () => {
    expect(normalizeRanks(null)).toEqual(DEFAULT_RANKS);
    expect(normalizeRanks([])).toEqual(DEFAULT_RANKS);
    expect(normalizeRanks([null, { name: " ", min: 1 }, { name: "x", min: "abc" }])).toEqual(DEFAULT_RANKS);
    expect(normalizeRanks(null)[0]).not.toBe(DEFAULT_RANKS[0]);
  });

  it("sorts by threshold, trims names and clamps thresholds", () => {
    const ranks = normalizeRanks([
      { name: " Top ", min: 250 },
      { name: "Low", min: 10 },
      { name: "Mid", min: 49.6 },
    ]);
    expect(ranks).toEqual([
      { name: "Low", min: 0 },
      { name: "Mid", min: 50 },
      { name: "Top", min: 100 },
    ]);
  });

  it("forces the first rank to start at 0 and limits name length", () => {
    const ranks = normalizeRanks([{ name: "a".repeat(40), min: 30 }]);
    expect(ranks[0].min).toBe(0);
    expect(ranks[0].name).toHaveLength(24);
  });
});

describe("currentRank", () => {
  it("is null without scored sessions", () => {
    expect(currentRank([])).toBeNull();
    expect(currentRank(null)).toBeNull();
    expect(currentRank([{ totalStrafes: 0 }])).toBeNull();
  });

  it("averages the scores and finds the rank and the next one", () => {
    const sessions = [session({ perfectRate: 60, medianDurationMs: 0 }), session({ perfectRate: 40, medianDurationMs: 0 })];
    // scores: 0.6 * 0.6 + 0.4 = 76 and 0.6 * 0.4 + 0.4 = 64 -> average 70
    const rank = currentRank(sessions);
    expect(rank).toMatchObject({ name: "Expert", score: 70, index: 3, sessions: 2 });
    expect(rank.next).toEqual({ name: "Master", min: 80 });
  });

  it("has no next rank at the top", () => {
    const rank = currentRank([session({ perfectRate: 100, medianDurationMs: 0 })]);
    expect(rank.name).toBe("Legend");
    expect(rank.next).toBeNull();
  });

  it("lands on a rank exactly at its threshold", () => {
    const rank = currentRank([session({ perfectRate: 0, medianDurationMs: 30 })], [{ name: "A", min: 0 }, { name: "B", min: 16 }]);
    // 0.4 * (1 - 30 / 50) = 16 %
    expect(rank).toMatchObject({ name: "B", score: 16 });
  });

  it("only looks at the most recent sessions", () => {
    const recent = Array.from({ length: RANK_WINDOW }, () => session({ perfectRate: 100, medianDurationMs: 0 }));
    const old = Array.from({ length: 20 }, () => session({ perfectRate: 0, medianDurationMs: 100 }));
    const rank = currentRank([...recent, ...old]);
    expect(rank.sessions).toBe(RANK_WINDOW);
    expect(rank.score).toBe(100);
  });

  it("uses custom ranks", () => {
    const rank = currentRank([session({ perfectRate: 100, medianDurationMs: 0 })], [{ name: "Only", min: 0 }]);
    expect(rank).toMatchObject({ name: "Only", next: null });
  });
});
