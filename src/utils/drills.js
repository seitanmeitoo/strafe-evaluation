// Training drills: a small state machine driven by strafe events and a clock.
// Pure functions only: the caller keeps the state and passes `now` (milliseconds).
import { summarize } from "./analysis";

export const DRILL_MODES = ["normal", "timed", "focus", "streak", "warmup"];

export const DEFAULT_DRILL_CONFIG = {
  timed: { durationSec: 60, requireShot: false },
  focus: { direction: "RightToLeft", target: 50, allowDiagonal: true, requireShot: false },
  streak: { target: 10, requireShot: false },
  warmup: {
    phases: [
      { direction: "LeftToRight", count: 20, diagonal: "any", requireShot: false },
      { direction: "RightToLeft", count: 20, diagonal: "any", requireShot: false },
      { direction: "any", count: 15, diagonal: "only", requireShot: false },
      { direction: "any", count: 20, diagonal: "any", requireShot: true },
    ],
  },
};

/** Deep copy of the default configuration, merged with a saved one. */
export function mergeDrillConfig(saved = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_DRILL_CONFIG));
  for (const mode of ["timed", "focus", "streak"]) {
    base[mode] = { ...base[mode], ...(saved?.[mode] || {}) };
  }
  if (Array.isArray(saved?.warmup?.phases) && saved.warmup.phases.length > 0) {
    base.warmup.phases = saved.warmup.phases.map((p) => ({ ...DEFAULT_DRILL_CONFIG.warmup.phases[0], ...p }));
  }
  return base;
}

/** Next mode in the Ctrl + F12 cycle. */
export function nextMode(mode) {
  const i = DRILL_MODES.indexOf(mode);
  return DRILL_MODES[(i + 1) % DRILL_MODES.length];
}

/** Score out of 100: 40 % Perfect rate, 30 % regularity, 30 % short median (0 ms best, 50 ms and more worst). */
export function drillScore(summary) {
  if (!summary || summary.count === 0) return 0;
  const perfect = summary.perfectRate / 100;
  const regularity = summary.cv == null ? 0 : 1 - Math.min(summary.cv, 1);
  const median = Math.max(0, Math.min(1, 1 - summary.medianMs / 50));
  return Math.round((0.4 * perfect + 0.3 * regularity + 0.3 * median) * 100);
}

function currentRules(state) {
  if (state.mode === "warmup") return state.config.phases[state.phaseIndex];
  return state.config;
}

/** Does this strafe count for the drill? (direction, diagonal and shot filters) */
export function acceptsStrafe(state, strafe) {
  if (!state || state.status !== "running") return false;
  const rules = currentRules(state);
  if (!rules) return false;

  if (rules.requireShot && strafe.shot_delay == null) return false;

  if (state.mode === "focus") {
    if (strafe.direction !== rules.direction) return false;
    if (!rules.allowDiagonal && strafe.is_diagonal) return false;
  }
  if (state.mode === "warmup") {
    if (rules.direction !== "any" && strafe.direction !== rules.direction) return false;
    if (rules.diagonal === "only" && !strafe.is_diagonal) return false;
    if (rules.diagonal === "none" && strafe.is_diagonal) return false;
  }
  return true;
}

/** Starts a drill. Returns null for the "normal" mode (no drill). */
export function startDrill(mode, config, now, bestStreak = 0) {
  if (mode === "normal" || !DRILL_MODES.includes(mode)) return null;
  const merged = mergeDrillConfig(config);
  return {
    mode,
    config: merged[mode],
    status: "running",
    startedAt: now,
    endedAt: null,
    elapsedSec: 0,
    strafes: [], // counted strafes, newest first
    otherSide: [], // focus mode: strafes in the other direction, for the comparison
    streak: 0,
    bestStreak, // personal best before this drill, raised as it goes
    targetReached: false,
    phaseIndex: 0,
    phaseCounts: mode === "warmup" ? merged.warmup.phases.map(() => 0) : [],
    result: null,
  };
}

function finish(state, now) {
  const ended = { ...state, status: "finished", endedAt: now, elapsedSec: Math.round((now - state.startedAt) / 1000) };
  return { ...ended, result: drillResult(ended) };
}

/** Stops a running drill early (Ctrl + F10). */
export function stopDrill(state, now) {
  if (!state || state.status !== "running") return state;
  return finish(state, now);
}

/** Advances the clock. Ends a timed drill when its time is up. */
export function tickDrill(state, now) {
  if (!state || state.status !== "running") return state;
  const elapsedSec = Math.floor((now - state.startedAt) / 1000);
  if (state.mode === "timed" && elapsedSec >= state.config.durationSec) {
    return finish(state, state.startedAt + state.config.durationSec * 1000);
  }
  return elapsedSec === state.elapsedSec ? state : { ...state, elapsedSec };
}

/**
 * Feeds one strafe to the drill. Returns { state, events } where events lists what happened:
 * "counted", "target-reached" (streak), "phase-complete" (warm-up) and "finished".
 */
export function applyStrafe(state, strafe, now) {
  if (!state || state.status !== "running") return { state, events: [] };

  if (!acceptsStrafe(state, strafe)) {
    if (state.mode === "focus" && strafe.direction !== state.config.direction) {
      return { state: { ...state, otherSide: [strafe, ...state.otherSide] }, events: [] };
    }
    return { state, events: [] };
  }

  const events = ["counted"];
  let next = { ...state, strafes: [strafe, ...state.strafes] };

  const streak = strafe.type === "Perfect" ? state.streak + 1 : 0;
  next.streak = streak;
  next.bestStreak = Math.max(state.bestStreak, streak);

  if (state.mode === "streak" && !state.targetReached && streak >= state.config.target) {
    next.targetReached = true;
    events.push("target-reached");
  }

  if (state.mode === "focus" && next.strafes.length >= state.config.target) {
    events.push("finished");
    return { state: finish(next, now), events };
  }

  if (state.mode === "warmup") {
    const phaseCounts = [...state.phaseCounts];
    phaseCounts[state.phaseIndex] += 1;
    next.phaseCounts = phaseCounts;
    if (phaseCounts[state.phaseIndex] >= state.config.phases[state.phaseIndex].count) {
      if (state.phaseIndex + 1 >= state.config.phases.length) {
        events.push("finished");
        return { state: finish(next, now), events };
      }
      next.phaseIndex = state.phaseIndex + 1;
      events.push("phase-complete");
    }
  }

  return { state: next, events };
}

/** Results of a finished (or stopped) drill. */
export function drillResult(state) {
  const summary = summarize(state.strafes);
  const result = {
    mode: state.mode,
    startedAt: new Date(state.startedAt).toISOString(),
    durationSec: state.elapsedSec,
    ...summary,
    score: drillScore(summary),
    bestStreak: state.bestStreak,
  };
  if (state.mode === "focus") {
    result.direction = state.config.direction;
    result.otherSide = summarize(state.otherSide);
  }
  if (state.mode === "streak") {
    result.target = state.config.target;
    result.targetReached = state.targetReached;
  }
  if (state.mode === "warmup") {
    result.phasesDone = state.phaseCounts.filter((c, i) => c >= state.config.phases[i].count).length;
    result.phaseCount = state.config.phases.length;
  }
  return result;
}

/** Progress of a running drill, as shown in the overlay. */
export function drillProgress(state) {
  if (!state) return null;
  const counted = state.strafes.length;
  const perfect = state.strafes.filter((s) => s.type === "Perfect").length;
  const base = {
    mode: state.mode,
    status: state.status,
    counted,
    perfectRate: counted ? Math.round((perfect / counted) * 100) : 0,
    streak: state.streak,
    bestStreak: state.bestStreak,
  };
  switch (state.mode) {
    case "timed":
      return { ...base, remainingSec: Math.max(0, state.config.durationSec - state.elapsedSec) };
    case "focus":
      return { ...base, target: state.config.target, direction: state.config.direction };
    case "streak":
      return { ...base, target: state.config.target, targetReached: state.targetReached };
    case "warmup": {
      const phase = state.config.phases[state.phaseIndex];
      const total = state.config.phases.reduce((acc, p) => acc + p.count, 0);
      const done = state.phaseCounts.reduce((acc, c) => acc + c, 0);
      return {
        ...base,
        phaseIndex: state.phaseIndex,
        phaseCount: state.config.phases.length,
        phase,
        phaseDone: state.phaseCounts[state.phaseIndex],
        overall: total ? Math.min(1, done / total) : 0,
      };
    }
    default:
      return base;
  }
}
