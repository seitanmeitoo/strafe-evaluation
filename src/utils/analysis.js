// Session analysis: weak side, fatigue and consistency.
// Durations are in microseconds (as sent by the backend). Strafe lists are newest first.
import { getStats } from "./stats";
import { calculateSpeedAtShot } from "./cs2Physics";

export const WEAK_SIDE_MIN_STRAFES = 10;
export const WEAK_SIDE_PERFECT_GAP = 15; // percentage points
export const WEAK_SIDE_MEDIAN_GAP = 0.15; // relative to the better side

export const FATIGUE_MIN_STRAFES = 40;
export const FATIGUE_WINDOW = 20;
export const FATIGUE_PERFECT_DROP = 20; // percentage points
export const FATIGUE_MEDIAN_RISE = 0.3; // relative to the start of the session

export const CV_STEADY = 0.5;
export const CV_IRREGULAR = 1.0;

// Medians this small are mostly measurement noise: relative gaps are computed against at
// least this value, and a gap must also reach MIN_MEDIAN_GAP_MS to count.
const MEDIAN_FLOOR_MS = 5;
const MIN_MEDIAN_GAP_MS = 2;

const round1 = (n) => Math.round(n * 10) / 10;

/** Coefficient of variation (standard deviation / mean), or null with fewer than 2 values. */
export function coefficientOfVariation(durations) {
  if (!durations || durations.length < 2) return null;
  const { average, std_deviation } = getStats(durations);
  if (average === 0) return 0; // every strafe was Perfect: perfectly steady
  return std_deviation / average;
}

/** "steady", "average" or "irregular" (null when there is not enough data). */
export function consistencyLabel(cv) {
  if (cv == null) return null;
  if (cv < CV_STEADY) return "steady";
  if (cv > CV_IRREGULAR) return "irregular";
  return "average";
}

/** Main figures of a list of strafes. Times are in milliseconds. */
export function summarize(strafes = []) {
  const count = strafes.length;
  if (count === 0) {
    return { count: 0, perfectRate: 0, medianMs: 0, stdDevMs: 0, cv: null, shots: 0, accurateRate: null };
  }

  const durations = strafes.map((s) => s.duration || 0);
  const stats = getStats(durations);
  const perfect = strafes.filter((s) => s.type === "Perfect").length;

  const shots = strafes.filter((s) => s.shot_delay != null);
  const accurate = shots.filter((s) => calculateSpeedAtShot(s)?.isAccurate).length;

  const cv = coefficientOfVariation(durations);

  return {
    count,
    perfectRate: round1((perfect / count) * 100),
    medianMs: round1(stats.median / 1000),
    stdDevMs: round1(stats.std_deviation / 1000),
    cv: cv == null ? null : Math.round(cv * 100) / 100,
    shots: shots.length,
    accurateRate: shots.length > 0 ? round1((accurate / shots.length) * 100) : null,
  };
}

/** How much worse `worse` is than `better`, relative to `better` (0 when the gap is too small). */
function relativeMedianGap(better, worse) {
  if (worse - better < MIN_MEDIAN_GAP_MS) return 0;
  return (worse - better) / Math.max(better, MEDIAN_FLOOR_MS);
}

/**
 * Compares A → D (LeftToRight) with D → A (RightToLeft).
 * weakSide is the direction to work on, or null when both sides are close or data is missing.
 */
export function analyzeDirections(strafes = []) {
  const leftToRight = summarize(strafes.filter((s) => s.direction === "LeftToRight"));
  const rightToLeft = summarize(strafes.filter((s) => s.direction === "RightToLeft"));

  const result = { leftToRight, rightToLeft, weakSide: null, perfectGap: 0, medianGap: 0 };
  if (leftToRight.count < WEAK_SIDE_MIN_STRAFES || rightToLeft.count < WEAK_SIDE_MIN_STRAFES) {
    return result;
  }

  const perfectGap = Math.abs(leftToRight.perfectRate - rightToLeft.perfectRate);
  const betterMedian = Math.min(leftToRight.medianMs, rightToLeft.medianMs);
  const worseMedian = Math.max(leftToRight.medianMs, rightToLeft.medianMs);
  const medianGap = relativeMedianGap(betterMedian, worseMedian);

  result.perfectGap = round1(perfectGap);
  result.medianGap = Math.round(medianGap * 100) / 100;

  if (perfectGap >= WEAK_SIDE_PERFECT_GAP) {
    // The Perfect rate decides first: it is what the player sees the most.
    result.weakSide = leftToRight.perfectRate < rightToLeft.perfectRate ? "LeftToRight" : "RightToLeft";
  } else if (medianGap >= WEAK_SIDE_MEDIAN_GAP) {
    result.weakSide = leftToRight.medianMs > rightToLeft.medianMs ? "LeftToRight" : "RightToLeft";
  }
  return result;
}

/**
 * Compares the first and the last FATIGUE_WINDOW strafes of a session.
 * Returns null when the session is shorter than FATIGUE_MIN_STRAFES.
 */
export function analyzeFatigue(strafes = []) {
  if (strafes.length < FATIGUE_MIN_STRAFES) return null;

  const start = summarize(strafes.slice(-FATIGUE_WINDOW)); // oldest strafes
  const end = summarize(strafes.slice(0, FATIGUE_WINDOW)); // newest strafes

  const perfectDrop = round1(start.perfectRate - end.perfectRate);
  const medianRise = Math.round(relativeMedianGap(start.medianMs, end.medianMs) * 100) / 100;

  return {
    start,
    end,
    perfectDrop,
    medianRise,
    detected: perfectDrop >= FATIGUE_PERFECT_DROP || medianRise >= FATIGUE_MEDIAN_RISE,
  };
}

/** Everything stored with a saved session. */
export function analyzeSession(strafes = []) {
  const overall = summarize(strafes);
  const directions = analyzeDirections(strafes);
  const fatigue = analyzeFatigue(strafes);

  const times = strafes
    .map((s) => Date.parse(s.timestamp))
    .filter((t) => !Number.isNaN(t));
  const durationSec = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 1000) : 0;

  return {
    stdDevMs: overall.stdDevMs,
    cv: overall.cv,
    consistency: consistencyLabel(overall.cv),
    durationSec,
    byDirection: {
      leftToRight: directions.leftToRight,
      rightToLeft: directions.rightToLeft,
    },
    weakSide: directions.weakSide,
    perfectGap: directions.perfectGap,
    medianGap: directions.medianGap,
    fatigue: fatigue
      ? {
          detected: fatigue.detected,
          startPerfectRate: fatigue.start.perfectRate,
          endPerfectRate: fatigue.end.perfectRate,
          startMedianMs: fatigue.start.medianMs,
          endMedianMs: fatigue.end.medianMs,
        }
      : null,
  };
}
