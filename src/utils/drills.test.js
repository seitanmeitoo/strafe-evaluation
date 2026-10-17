import { describe, expect, it } from "vitest";
import { strafe } from "../test/fixtures";
import {
  DEFAULT_DRILL_CONFIG,
  acceptsStrafe,
  applyStrafe,
  drillProgress,
  drillScore,
  mergeDrillConfig,
  nextMode,
  startDrill,
  stopDrill,
  tickDrill,
} from "./drills";

const T0 = 1_000_000;

/** Feeds several strafes in a row and returns the final state and every event. */
function feed(state, list, now = T0) {
  let current = state;
  const events = [];
  for (const s of list) {
    const r = applyStrafe(current, s, now);
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe("mergeDrillConfig", () => {
  it("returns the defaults without saved config", () => {
    expect(mergeDrillConfig()).toEqual(DEFAULT_DRILL_CONFIG);
  });

  it("returns a copy that can be changed safely", () => {
    const merged = mergeDrillConfig();
    merged.timed.durationSec = 5;
    merged.warmup.phases[0].count = 1;
    expect(DEFAULT_DRILL_CONFIG.timed.durationSec).toBe(60);
    expect(DEFAULT_DRILL_CONFIG.warmup.phases[0].count).toBe(20);
  });

  it("overrides only the saved fields", () => {
    const merged = mergeDrillConfig({ focus: { target: 5 } });
    expect(merged.focus).toEqual({ ...DEFAULT_DRILL_CONFIG.focus, target: 5 });
  });

  it("completes warm-up phases with defaults and ignores empty phase lists", () => {
    const merged = mergeDrillConfig({ warmup: { phases: [{ count: 3 }] } });
    expect(merged.warmup.phases).toHaveLength(1);
    expect(merged.warmup.phases[0]).toMatchObject({ count: 3, direction: "LeftToRight", requireShot: false });
    expect(mergeDrillConfig({ warmup: { phases: [] } }).warmup.phases).toHaveLength(4);
  });
});

describe("nextMode", () => {
  it("cycles through every mode", () => {
    expect(nextMode("normal")).toBe("timed");
    expect(nextMode("warmup")).toBe("normal");
  });

  it("restarts the cycle on an unknown mode", () => {
    // indexOf is -1, so the next mode is the first one.
    expect(nextMode("nope")).toBe("normal");
  });
});

describe("drillScore", () => {
  it("is 0 without strafes", () => {
    expect(drillScore(null)).toBe(0);
    expect(drillScore({ count: 0 })).toBe(0);
  });

  it("is 100 for a perfect, regular and instant drill", () => {
    expect(drillScore({ count: 10, perfectRate: 100, cv: 0, medianMs: 0 })).toBe(100);
  });

  it("weights Perfect rate 40 %, regularity 30 % and median 30 %", () => {
    expect(drillScore({ count: 10, perfectRate: 50, cv: 0.5, medianMs: 25 })).toBe(50);
  });

  it("gives no regularity points without a coefficient and caps it at 1", () => {
    expect(drillScore({ count: 10, perfectRate: 0, cv: null, medianMs: 50 })).toBe(0);
    expect(drillScore({ count: 10, perfectRate: 0, cv: 5, medianMs: 50 })).toBe(0);
  });
});

describe("startDrill", () => {
  it("returns null for normal and unknown modes", () => {
    expect(startDrill("normal", {}, T0)).toBeNull();
    expect(startDrill("nope", {}, T0)).toBeNull();
  });

  it("starts a running drill with the mode config", () => {
    const d = startDrill("timed", { timed: { durationSec: 30 } }, T0, 7);
    expect(d).toMatchObject({ mode: "timed", status: "running", startedAt: T0, bestStreak: 7 });
    expect(d.config.durationSec).toBe(30);
  });

  it("prepares one counter per warm-up phase", () => {
    expect(startDrill("warmup", {}, T0).phaseCounts).toEqual([0, 0, 0, 0]);
  });
});

describe("acceptsStrafe", () => {
  it("rejects strafes when no drill is running", () => {
    expect(acceptsStrafe(null, strafe())).toBe(false);
    const done = stopDrill(startDrill("streak", {}, T0), T0 + 1000);
    expect(acceptsStrafe(done, strafe())).toBe(false);
  });

  it("applies the shots-only filter", () => {
    const d = startDrill("streak", { streak: { target: 5, requireShot: true } }, T0);
    expect(acceptsStrafe(d, strafe({ shot_delay: null }))).toBe(false);
    expect(acceptsStrafe(d, strafe({ shot_delay: 50000 }))).toBe(true);
  });

  it("applies the direction filter in focus mode", () => {
    const d = startDrill("focus", { focus: { direction: "LeftToRight" } }, T0);
    expect(acceptsStrafe(d, strafe({ direction: "LeftToRight" }))).toBe(true);
    expect(acceptsStrafe(d, strafe({ direction: "RightToLeft" }))).toBe(false);
  });

  it("applies the diagonal filter in focus mode", () => {
    const d = startDrill("focus", { focus: { direction: "LeftToRight", allowDiagonal: false } }, T0);
    expect(acceptsStrafe(d, strafe({ direction: "LeftToRight", is_diagonal: true }))).toBe(false);
    expect(acceptsStrafe(d, strafe({ direction: "LeftToRight", is_diagonal: false }))).toBe(true);
  });

  it("does not filter timed and streak drills by direction", () => {
    const timed = startDrill("timed", {}, T0);
    const streak = startDrill("streak", {}, T0);
    const s = strafe({ direction: "RightToLeft", is_diagonal: true });
    expect(acceptsStrafe(timed, s)).toBe(true);
    expect(acceptsStrafe(streak, s)).toBe(true);
  });

  it("follows the current warm-up phase rules", () => {
    const config = {
      warmup: {
        phases: [
          { direction: "LeftToRight", count: 2, diagonal: "none" },
          { direction: "any", count: 2, diagonal: "only" },
        ],
      },
    };
    const d = startDrill("warmup", config, T0);
    expect(acceptsStrafe(d, strafe({ direction: "LeftToRight" }))).toBe(true);
    expect(acceptsStrafe(d, strafe({ direction: "RightToLeft" }))).toBe(false);
    expect(acceptsStrafe(d, strafe({ direction: "LeftToRight", is_diagonal: true }))).toBe(false);
    const second = { ...d, phaseIndex: 1 };
    expect(acceptsStrafe(second, strafe({ direction: "RightToLeft", is_diagonal: true }))).toBe(true);
    expect(acceptsStrafe(second, strafe({ direction: "RightToLeft", is_diagonal: false }))).toBe(false);
  });
});

describe("timed mode", () => {
  it("counts every strafe and ignores ticks before the end", () => {
    let d = startDrill("timed", { timed: { durationSec: 10 } }, T0);
    d = feed(d, [strafe(), strafe()]).state;
    d = tickDrill(d, T0 + 4500);
    expect(d.status).toBe("running");
    expect(d.elapsedSec).toBe(4);
    expect(d.strafes).toHaveLength(2);
  });

  it("finishes exactly when the time is up, even on a late tick", () => {
    let d = startDrill("timed", { timed: { durationSec: 10 } }, T0);
    d = feed(d, [strafe(), strafe({ type: "Early", duration: 10000 })]).state;
    d = tickDrill(d, T0 + 25000);
    expect(d.status).toBe("finished");
    expect(d.endedAt).toBe(T0 + 10000);
    expect(d.result).toMatchObject({ mode: "timed", durationSec: 10, count: 2, perfectRate: 50 });
  });

  it("ignores strafes and ticks once finished", () => {
    let d = tickDrill(startDrill("timed", { timed: { durationSec: 1 } }, T0), T0 + 2000);
    const r = applyStrafe(d, strafe(), T0 + 3000);
    expect(r.state).toBe(d);
    expect(r.events).toEqual([]);
    expect(tickDrill(d, T0 + 9000)).toBe(d);
  });
});

describe("focus mode", () => {
  const config = { focus: { direction: "LeftToRight", target: 3, allowDiagonal: true } };

  it("keeps the other direction aside for the comparison", () => {
    const d = startDrill("focus", config, T0);
    const r = applyStrafe(d, strafe({ direction: "RightToLeft", type: "Early", duration: 9000 }), T0);
    expect(r.events).toEqual([]);
    expect(r.state.strafes).toHaveLength(0);
    expect(r.state.otherSide).toHaveLength(1);
  });

  it("finishes at the target and reports the other side", () => {
    const d = startDrill("focus", config, T0);
    const { state, events } = feed(d, [
      strafe({ direction: "RightToLeft" }),
      strafe({ direction: "LeftToRight" }),
      strafe({ direction: "LeftToRight" }),
      strafe({ direction: "LeftToRight" }),
    ], T0 + 20000);
    expect(events).toContain("finished");
    expect(state.status).toBe("finished");
    expect(state.result).toMatchObject({ mode: "focus", direction: "LeftToRight", count: 3, durationSec: 20 });
    expect(state.result.otherSide.count).toBe(1);
  });
});

describe("streak mode", () => {
  const config = { streak: { target: 3 } };

  it("signals the target once and keeps running", () => {
    const d = startDrill("streak", config, T0);
    const { state, events } = feed(d, [strafe(), strafe(), strafe(), strafe()]);
    expect(events.filter((e) => e === "target-reached")).toHaveLength(1);
    expect(state.status).toBe("running");
    expect(state.targetReached).toBe(true);
    expect(state.streak).toBe(4);
  });

  it("resets the streak on a non-Perfect strafe but keeps the best", () => {
    const d = startDrill("streak", config, T0);
    const { state, events } = feed(d, [strafe(), strafe(), strafe({ type: "Late", duration: 8000 }), strafe()]);
    expect(events).not.toContain("target-reached");
    expect(state.streak).toBe(1);
    expect(state.bestStreak).toBe(2);
  });

  it("starts from the previous best streak", () => {
    const d = startDrill("streak", config, T0, 9);
    expect(feed(d, [strafe()]).state.bestStreak).toBe(9);
  });

  it("reports the target in the result when stopped", () => {
    const d = feed(startDrill("streak", config, T0), [strafe(), strafe(), strafe()]).state;
    const stopped = stopDrill(d, T0 + 5000);
    expect(stopped.result).toMatchObject({ mode: "streak", target: 3, targetReached: true, bestStreak: 3 });
  });
});

describe("warm-up mode", () => {
  const config = {
    warmup: {
      phases: [
        { direction: "LeftToRight", count: 2, diagonal: "none" },
        { direction: "any", count: 1, diagonal: "only" },
      ],
    },
  };

  it("moves to the next phase and finishes after the last", () => {
    let d = startDrill("warmup", config, T0);
    let r = feed(d, [strafe({ direction: "LeftToRight" })]);
    expect(r.state.phaseIndex).toBe(0);

    r = feed(r.state, [strafe({ direction: "LeftToRight" })]);
    expect(r.events).toContain("phase-complete");
    expect(r.state.phaseIndex).toBe(1);

    // A non-diagonal strafe does not count in the diagonal-only phase.
    r = feed(r.state, [strafe({ direction: "RightToLeft", is_diagonal: false })]);
    expect(r.state.phaseCounts).toEqual([2, 0]);

    r = feed(r.state, [strafe({ direction: "RightToLeft", is_diagonal: true })], T0 + 30000);
    expect(r.events).toContain("finished");
    expect(r.state.status).toBe("finished");
    expect(r.state.result).toMatchObject({ mode: "warmup", phasesDone: 2, phaseCount: 2, count: 3 });
  });

  it("counts only the completed phases when stopped early", () => {
    const d = feed(startDrill("warmup", config, T0), [strafe(), strafe()]).state;
    const stopped = stopDrill(d, T0 + 8000);
    expect(stopped.result.phasesDone).toBe(1);
  });

  it("can require a shot in a phase", () => {
    const d = startDrill("warmup", { warmup: { phases: [{ direction: "any", count: 1, diagonal: "any", requireShot: true }] } }, T0);
    expect(applyStrafe(d, strafe({ shot_delay: null }), T0).events).toEqual([]);
    expect(applyStrafe(d, strafe({ shot_delay: 40000 }), T0).events).toContain("finished");
  });
});

describe("stopDrill", () => {
  it("ends a running drill with a result and the elapsed time", () => {
    const d = feed(startDrill("timed", {}, T0), [strafe()]).state;
    const stopped = stopDrill(d, T0 + 12400);
    expect(stopped.status).toBe("finished");
    expect(stopped.result.durationSec).toBe(12);
    expect(stopped.result.score).toBeGreaterThan(0);
  });

  it("returns an already finished or missing drill unchanged", () => {
    expect(stopDrill(null, T0)).toBeNull();
    const stopped = stopDrill(startDrill("timed", {}, T0), T0 + 1000);
    expect(stopDrill(stopped, T0 + 5000)).toBe(stopped);
  });
});

describe("drillProgress", () => {
  it("is null without a drill", () => {
    expect(drillProgress(null)).toBeNull();
  });

  it("reports the remaining time of a timed drill", () => {
    let d = startDrill("timed", { timed: { durationSec: 30 } }, T0);
    d = tickDrill(d, T0 + 12000);
    expect(drillProgress(d)).toMatchObject({ mode: "timed", remainingSec: 18, counted: 0, perfectRate: 0 });
  });

  it("reports the target of focus and streak drills", () => {
    const focus = startDrill("focus", { focus: { target: 5, direction: "LeftToRight" } }, T0);
    expect(drillProgress(focus)).toMatchObject({ target: 5, direction: "LeftToRight" });
    const streak = startDrill("streak", { streak: { target: 4 } }, T0);
    expect(drillProgress(streak)).toMatchObject({ target: 4, targetReached: false });
  });

  it("reports the overall warm-up progress", () => {
    const config = { warmup: { phases: [{ direction: "any", count: 2 }, { direction: "any", count: 2 }] } };
    const d = feed(startDrill("warmup", config, T0), [strafe()]).state;
    const p = drillProgress(d);
    expect(p).toMatchObject({ phaseIndex: 0, phaseCount: 2, phaseDone: 1, overall: 0.25 });
  });
});
