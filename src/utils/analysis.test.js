import { describe, expect, it } from "vitest";
import { strafe, strafes } from "../test/fixtures";
import {
  analyzeDirections,
  analyzeFatigue,
  analyzeSession,
  coefficientOfVariation,
  consistencyLabel,
  summarize,
} from "./analysis";

describe("coefficientOfVariation", () => {
  it("is null with fewer than 2 values", () => {
    expect(coefficientOfVariation([])).toBeNull();
    expect(coefficientOfVariation([5])).toBeNull();
    expect(coefficientOfVariation(null)).toBeNull();
  });

  it("is 0 when every value is 0 (all Perfect)", () => {
    expect(coefficientOfVariation([0, 0, 0])).toBe(0);
  });

  it("divides the standard deviation by the mean", () => {
    expect(coefficientOfVariation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(0.4);
  });
});

describe("consistencyLabel", () => {
  it("maps the coefficient to a label", () => {
    expect(consistencyLabel(null)).toBeNull();
    expect(consistencyLabel(0.1)).toBe("steady");
    expect(consistencyLabel(0.5)).toBe("average");
    expect(consistencyLabel(1.0)).toBe("average");
    expect(consistencyLabel(1.2)).toBe("irregular");
  });
});

describe("summarize", () => {
  it("returns an empty summary without strafes", () => {
    expect(summarize([])).toEqual({
      count: 0, perfectRate: 0, medianMs: 0, stdDevMs: 0, cv: null, shots: 0, accurateRate: null,
    });
    expect(summarize().count).toBe(0);
  });

  it("computes the Perfect rate and the median in milliseconds", () => {
    const list = [
      strafe({ type: "Perfect", duration: 0 }),
      strafe({ type: "Early", duration: 10000 }),
      strafe({ type: "Late", duration: 20000 }),
      strafe({ type: "Early", duration: 30000 }),
    ];
    const s = summarize(list);
    expect(s.count).toBe(4);
    expect(s.perfectRate).toBe(25);
    expect(s.medianMs).toBe(15);
    expect(s.shots).toBe(0);
    expect(s.accurateRate).toBeNull();
  });

  it("counts accurate shots with the CS2 model", () => {
    const list = [
      strafe({ shot_delay: 70000 }), // slowed down enough
      strafe({ shot_delay: 10000 }), // still too fast
      strafe({ shot_delay: null }),
    ];
    const s = summarize(list);
    expect(s.shots).toBe(2);
    expect(s.accurateRate).toBe(50);
  });
});

describe("analyzeDirections", () => {
  it("does not name a weak side with too few strafes per direction", () => {
    const list = [
      ...strafes(9, { direction: "LeftToRight" }),
      ...strafes(20, { direction: "RightToLeft", type: "Early", duration: 30000 }),
    ];
    expect(analyzeDirections(list).weakSide).toBeNull();
  });

  it("names the side with the lower Perfect rate", () => {
    const list = [
      ...strafes(12, { direction: "LeftToRight" }),
      ...strafes(12, { direction: "RightToLeft", type: "Early", duration: 20000 }),
    ];
    const r = analyzeDirections(list);
    expect(r.weakSide).toBe("RightToLeft");
    expect(r.perfectGap).toBe(100);
  });

  it("falls back to the median when Perfect rates are close", () => {
    const list = [
      ...strafes(12, { direction: "LeftToRight", type: "Early", duration: 30000 }),
      ...strafes(12, { direction: "RightToLeft", type: "Early", duration: 10000 }),
    ];
    const r = analyzeDirections(list);
    expect(r.perfectGap).toBe(0);
    expect(r.weakSide).toBe("LeftToRight");
    expect(r.medianGap).toBe(2);
  });

  it("ignores median gaps below 2 ms (measurement noise)", () => {
    const list = [
      ...strafes(12, { direction: "LeftToRight", type: "Early", duration: 2500 }),
      ...strafes(12, { direction: "RightToLeft", type: "Early", duration: 1000 }),
    ];
    expect(analyzeDirections(list).weakSide).toBeNull();
  });

  it("returns no weak side when both sides are alike", () => {
    const list = [
      ...strafes(15, { direction: "LeftToRight", type: "Early", duration: 10000 }),
      ...strafes(15, { direction: "RightToLeft", type: "Early", duration: 10000 }),
    ];
    expect(analyzeDirections(list).weakSide).toBeNull();
  });
});

describe("analyzeFatigue", () => {
  it("returns null for a short session", () => {
    expect(analyzeFatigue(strafes(39))).toBeNull();
  });

  it("detects a drop of the Perfect rate (strafes are newest first)", () => {
    const newest = strafes(20, { type: "Early", duration: 10000 });
    const oldest = strafes(20, { type: "Perfect" });
    const f = analyzeFatigue([...newest, ...oldest]);
    expect(f.detected).toBe(true);
    expect(f.start.perfectRate).toBe(100);
    expect(f.end.perfectRate).toBe(0);
    expect(f.perfectDrop).toBe(100);
  });

  it("detects a rise of the median even when the Perfect rate holds", () => {
    const newest = strafes(20, { type: "Early", duration: 30000 });
    const oldest = strafes(20, { type: "Early", duration: 10000 });
    const f = analyzeFatigue([...newest, ...oldest]);
    expect(f.perfectDrop).toBe(0);
    expect(f.medianRise).toBe(2);
    expect(f.detected).toBe(true);
  });

  it("does not flag a stable session", () => {
    expect(analyzeFatigue(strafes(60, { type: "Early", duration: 10000 })).detected).toBe(false);
  });

  it("does not flag an improving session", () => {
    const newest = strafes(20, { type: "Perfect" });
    const oldest = strafes(20, { type: "Early", duration: 20000 });
    expect(analyzeFatigue([...newest, ...oldest]).detected).toBe(false);
  });
});

describe("analyzeSession", () => {
  it("handles an empty session", () => {
    const a = analyzeSession([]);
    expect(a.consistency).toBeNull();
    expect(a.fatigue).toBeNull();
    expect(a.weakSide).toBeNull();
    expect(a.durationSec).toBe(0);
  });

  it("computes the duration from the first to the last timestamp", () => {
    const list = [
      strafe({ timestamp: "2025-01-01T12:00:00.000Z" }),
      strafe({ timestamp: "2025-01-01T12:01:30.000Z" }),
    ];
    expect(analyzeSession(list).durationSec).toBe(90);
  });

  it("ignores invalid timestamps", () => {
    const list = [strafe({ timestamp: "nope" }), strafe({ timestamp: "2025-01-01T12:00:00.000Z" })];
    expect(analyzeSession(list).durationSec).toBe(0);
  });

  it("labels a perfectly steady session", () => {
    const a = analyzeSession(strafes(10));
    expect(a.cv).toBe(0);
    expect(a.consistency).toBe("steady");
  });

  it("flattens the fatigue result", () => {
    const list = [
      ...strafes(20, { type: "Early", duration: 10000 }),
      ...strafes(20, { type: "Perfect" }),
    ];
    const a = analyzeSession(list);
    expect(a.fatigue).toMatchObject({ detected: true, startPerfectRate: 100, endPerfectRate: 0 });
  });
});
