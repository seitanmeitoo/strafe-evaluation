import { describe, expect, it } from "vitest";
import { session } from "../test/fixtures";
import { progressSeries, sessionRecords, sessionsInRange } from "./progress";

const DAY = 24 * 60 * 60 * 1000;
// Local noon, so that "same day" does not depend on the time zone.
const at = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour).toISOString();

describe("sessionsInRange", () => {
  const now = Date.parse(at(2025, 3, 31));

  it("returns everything without a range", () => {
    const list = [session(), session()];
    expect(sessionsInRange(list, null, now)).toBe(list);
  });

  it("returns an empty list for invalid input", () => {
    expect(sessionsInRange(null, 7, now)).toEqual([]);
  });

  it("keeps sessions inside the window, boundary included", () => {
    const inside = session({ timestamp: new Date(now - 6 * DAY).toISOString() });
    const edge = session({ timestamp: new Date(now - 7 * DAY).toISOString() });
    const outside = session({ timestamp: new Date(now - 8 * DAY).toISOString() });
    expect(sessionsInRange([inside, edge, outside], 7, now)).toEqual([inside, edge]);
  });

  it("drops sessions with an invalid date", () => {
    expect(sessionsInRange([session({ timestamp: "bad" })], 7, now)).toEqual([]);
  });
});

describe("progressSeries", () => {
  it("returns no points without usable sessions", () => {
    expect(progressSeries([])).toEqual({ unit: "day", points: [] });
    expect(progressSeries(null).points).toEqual([]);
    expect(progressSeries([session({ totalStrafes: 0 }), session({ timestamp: "bad" })]).points).toEqual([]);
  });

  it("groups sessions of the same day, weighted by strafes", () => {
    const list = [
      session({ timestamp: at(2025, 3, 10, 9), totalStrafes: 100, perfectRate: 40, medianDurationMs: 10 }),
      session({ timestamp: at(2025, 3, 10, 18), totalStrafes: 300, perfectRate: 20, medianDurationMs: 20 }),
    ];
    const { unit, points } = progressSeries(list);
    expect(unit).toBe("day");
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ sessions: 2, strafes: 400, perfectRate: 25, medianMs: 17.5, accurateRate: null });
  });

  it("weights accuracy by shots", () => {
    const list = [
      session({ timestamp: at(2025, 3, 10), totalShots: 10, accurateRate: 100 }),
      session({ timestamp: at(2025, 3, 10), totalShots: 30, accurateRate: 40 }),
    ];
    expect(progressSeries(list).points[0].accurateRate).toBe(55);
  });

  it("sorts points oldest first", () => {
    const list = [
      session({ timestamp: at(2025, 3, 12) }),
      session({ timestamp: at(2025, 3, 10) }),
      session({ timestamp: at(2025, 3, 11) }),
    ];
    const times = progressSeries(list).points.map((p) => p.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times).toHaveLength(3);
  });

  it("switches to weekly points over a span longer than 30 days", () => {
    const list = [
      session({ timestamp: at(2025, 1, 6) }), // Monday
      session({ timestamp: at(2025, 1, 12) }), // Sunday, same week
      session({ timestamp: at(2025, 3, 3) }),
    ];
    const { unit, points } = progressSeries(list);
    expect(unit).toBe("week");
    expect(points).toHaveLength(2);
    expect(points[0].sessions).toBe(2);
    expect(new Date(points[0].time).getDay()).toBe(1);
  });
});

describe("sessionRecords", () => {
  it("returns no record without sessions", () => {
    expect(sessionRecords([])).toEqual({ bestPerfect: null, bestMedian: null, bestAccuracy: null });
    expect(sessionRecords(null).bestPerfect).toBeNull();
  });

  it("ignores sessions with fewer than 30 strafes", () => {
    const records = sessionRecords([session({ totalStrafes: 29, perfectRate: 100 })]);
    expect(records.bestPerfect).toBeNull();
  });

  it("finds the best Perfect rate, the lowest median and the best accuracy", () => {
    const a = session({ totalStrafes: 40, perfectRate: 30, medianDurationMs: 12, totalShots: 20, accurateRate: 60 });
    const b = session({ totalStrafes: 40, perfectRate: 45, medianDurationMs: 9, totalShots: 20, accurateRate: 85 });
    const c = session({ totalStrafes: 40, perfectRate: 20, medianDurationMs: 15, totalShots: 5, accurateRate: 100 });
    const r = sessionRecords([a, b, c]);
    expect(r.bestPerfect).toEqual({ value: 45, timestamp: b.timestamp });
    expect(r.bestMedian).toEqual({ value: 9, timestamp: b.timestamp });
    // c has too few shots to count.
    expect(r.bestAccuracy).toEqual({ value: 85, timestamp: b.timestamp });
  });

  it("has no accuracy record when no session has enough shots", () => {
    expect(sessionRecords([session({ totalShots: 9, accurateRate: 100 })]).bestAccuracy).toBeNull();
  });

  it("keeps the first session on a tie", () => {
    const a = session({ perfectRate: 50 });
    const b = session({ perfectRate: 50 });
    expect(sessionRecords([a, b]).bestPerfect.timestamp).toBe(a.timestamp);
  });
});
