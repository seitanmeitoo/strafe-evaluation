import { describe, expect, it } from "vitest";
import { buildFeedback, formatDuration } from "./feedback";

const byDir = (perfectRate, medianMs) => ({ count: 20, perfectRate, medianMs });

function makeSession(overrides = {}, analysis = {}) {
  return {
    id: "s1",
    totalStrafes: 50,
    perfectRate: 25,
    medianDurationMs: 12,
    totalShots: 0,
    accurateRate: 0,
    analysis: {
      cv: 0.7,
      durationSec: 120,
      weakSide: null,
      byDirection: { leftToRight: byDir(25, 12), rightToLeft: byDir(25, 12) },
      fatigue: null,
      ...analysis,
    },
    ...overrides,
  };
}

const keys = (items) => items.map((i) => i.key);

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(null)).toBe("0 s");
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(180)).toBe("3 min");
    expect(formatDuration(3900)).toBe("1 h 05");
  });
});

describe("buildFeedback", () => {
  it("returns null without analysis", () => {
    expect(buildFeedback({ totalStrafes: 3 })).toBeNull();
    expect(buildFeedback(null)).toBeNull();
  });

  it("chooses the headline from the session length", () => {
    expect(buildFeedback(makeSession()).headline.key).toBe("headlineWithDuration");
    expect(buildFeedback(makeSession({}, { durationSec: 5 })).headline.key).toBe("headline");
  });

  it("compares with the previous session", () => {
    const prev = makeSession({ id: "p", perfectRate: 15, medianDurationMs: 20 });
    const fb = buildFeedback(makeSession({ perfectRate: 25, medianDurationMs: 12 }), prev);
    expect(fb.comparedTo).toBe("p");
    expect(keys(fb.strengths)).toContain("perfectUp");
    expect(keys(fb.strengths)).toContain("medianDown");
  });

  it("flags a drop of the Perfect rate and a slower median", () => {
    const prev = makeSession({ id: "p", perfectRate: 40, medianDurationMs: 8 });
    const fb = buildFeedback(makeSession({ perfectRate: 25, medianDurationMs: 14 }), prev);
    expect(keys(fb.improvements)).toEqual(expect.arrayContaining(["perfectDown", "medianUp"]));
  });

  it("ignores a previous session without strafes", () => {
    const fb = buildFeedback(makeSession(), makeSession({ id: "empty", totalStrafes: 0 }));
    expect(fb.comparedTo).toBeNull();
  });

  it("praises a steady session and warns about an irregular one", () => {
    expect(keys(buildFeedback(makeSession({}, { cv: 0.2 })).strengths)).toContain("steady");
    expect(keys(buildFeedback(makeSession({}, { cv: 1.4 })).improvements)).toContain("irregular");
  });

  it("only judges accuracy with enough shots", () => {
    const few = buildFeedback(makeSession({ totalShots: 4, accurateRate: 10 }));
    expect(keys(few.improvements)).not.toContain("accurateLow");
    const low = buildFeedback(makeSession({ totalShots: 20, accurateRate: 40 }));
    expect(keys(low.improvements)).toContain("accurateLow");
    const good = buildFeedback(makeSession({ totalShots: 20, accurateRate: 90 }));
    expect(keys(good.strengths)).toContain("accurateGood");
  });

  it("puts the weak side first and recommends working on it", () => {
    const fb = buildFeedback(
      makeSession({}, {
        weakSide: "RightToLeft",
        byDirection: { leftToRight: byDir(60, 6), rightToLeft: byDir(20, 14) },
      })
    );
    expect(fb.improvements[0].key).toBe("weakSide");
    expect(fb.improvements[0].params.side).toContain("→");
    expect(fb.recommendation.key).toBe("recFocusSide");
  });

  it("mentions only the median when Perfect rates are close", () => {
    const fb = buildFeedback(
      makeSession({}, {
        weakSide: "LeftToRight",
        byDirection: { leftToRight: byDir(25, 20), rightToLeft: byDir(24, 10) },
      })
    );
    expect(fb.improvements[0].key).toBe("weakSideMedian");
  });

  it("recommends a break first when fatigue is detected", () => {
    const fb = buildFeedback(
      makeSession({}, {
        weakSide: "LeftToRight",
        fatigue: { detected: true, startPerfectRate: 60, endPerfectRate: 30, startMedianMs: 6, endMedianMs: 12 },
      })
    );
    expect(fb.fatigue.key).toBe("fatigue");
    expect(fb.recommendation.key).toBe("recBreak");
  });

  it("recommends timing work for a low Perfect rate and keeps going otherwise", () => {
    expect(buildFeedback(makeSession({ perfectRate: 10 })).recommendation.key).toBe("recTiming");
    expect(buildFeedback(makeSession({ perfectRate: 35 })).recommendation.key).toBe("recKeepGoing");
    expect(buildFeedback(makeSession({}, { cv: 1.5 })).recommendation.key).toBe("recSteady");
  });
});
