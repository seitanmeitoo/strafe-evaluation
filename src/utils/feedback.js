// Post-session feedback built from simple rules (no network, no model).
// Items are stored as { key, params } so the wording can change without touching saved sessions;
// render them with t(`feedback.${item.key}`, item.params).
import { consistencyLabel } from "./analysis";
import { formatKeyDisplay, loadSettings } from "./settings";

const PERFECT_UP = 3; // points of % Perfect counted as progress
const PERFECT_DOWN = 5; // points of % Perfect counted as a drop
const PERFECT_GOOD = 30; // % Perfect worth mentioning on its own
const PERFECT_LOW = 20; // % Perfect under which the advice is about timing
const MEDIAN_GAP = 0.15; // relative median change counted as a change
const MEDIAN_MIN_GAP_MS = 2;
const MEDIAN_FLOOR_MS = 5;
const MEDIAN_LOW_MS = 10;
const CV_PROGRESS = 0.1; // drop of the coefficient of variation counted as progress
const ACCURACY_TARGET = 80; // % accurate shots
const MIN_SHOTS = 5;

const pct = (cv) => Math.round(cv * 100);

function medianChange(previousMs, currentMs) {
  const diff = currentMs - previousMs;
  if (Math.abs(diff) < MEDIAN_MIN_GAP_MS) return 0;
  return diff / Math.max(Math.min(previousMs, currentMs), MEDIAN_FLOOR_MS);
}

function sideLabels() {
  const keys = loadSettings()?.keys || {};
  const left = formatKeyDisplay(keys.left || "A");
  const right = formatKeyDisplay(keys.right || "D");
  return { LeftToRight: `${left} → ${right}`, RightToLeft: `${right} → ${left}` };
}

/** "45 s", "3 min" or "1 h 05" from a number of seconds. */
export function formatDuration(seconds) {
  if (!seconds || seconds < 60) return `${Math.max(0, Math.round(seconds || 0))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Builds the feedback of `session` (a saved session with its `analysis`), compared with
 * `previous` (the session saved just before, may be null). Returns null without analysis.
 */
export function buildFeedback(session, previous = null) {
  const a = session?.analysis;
  if (!a) return null;

  const prev = previous && previous.totalStrafes > 0 ? previous : null;
  const sides = sideLabels();
  const strengths = [];
  const improvements = [];

  // % Perfect
  const perfectDelta = prev ? session.perfectRate - prev.perfectRate : 0;
  if (prev && perfectDelta >= PERFECT_UP) {
    strengths.push({ key: "perfectUp", params: { rate: Math.round(session.perfectRate), delta: Math.round(perfectDelta) } });
  } else if (prev && perfectDelta <= -PERFECT_DOWN) {
    improvements.push({ key: "perfectDown", params: { rate: Math.round(session.perfectRate), delta: Math.round(-perfectDelta) } });
  } else if (session.perfectRate >= PERFECT_GOOD) {
    strengths.push({ key: "perfectGood", params: { rate: Math.round(session.perfectRate) } });
  }

  // Median timing
  if (prev) {
    const change = medianChange(prev.medianDurationMs, session.medianDurationMs);
    if (change <= -MEDIAN_GAP) {
      strengths.push({ key: "medianDown", params: { ms: session.medianDurationMs, prev: prev.medianDurationMs } });
    } else if (change >= MEDIAN_GAP) {
      improvements.push({ key: "medianUp", params: { ms: session.medianDurationMs, prev: prev.medianDurationMs } });
    } else {
      strengths.push({ key: "medianSteady", params: { ms: session.medianDurationMs } });
    }
  } else if (session.medianDurationMs <= MEDIAN_LOW_MS) {
    strengths.push({ key: "medianLow", params: { ms: session.medianDurationMs } });
  }

  // Consistency
  const label = consistencyLabel(a.cv);
  const prevCv = prev?.analysis?.cv;
  if (a.cv != null && prevCv != null && prevCv - a.cv >= CV_PROGRESS) {
    strengths.push({ key: "moreConsistent", params: { cv: pct(a.cv), prev: pct(prevCv) } });
  } else if (label === "steady") {
    strengths.push({ key: "steady", params: { cv: pct(a.cv) } });
  } else if (label === "irregular") {
    improvements.push({ key: "irregular", params: { cv: pct(a.cv) } });
  }

  // CS2 shots
  const enoughShots = (session.totalShots || 0) >= MIN_SHOTS;
  if (enoughShots && session.accurateRate >= ACCURACY_TARGET) {
    strengths.push({ key: "accurateGood", params: { rate: Math.round(session.accurateRate) } });
  } else if (enoughShots) {
    improvements.push({ key: "accurateLow", params: { rate: Math.round(session.accurateRate), target: ACCURACY_TARGET } });
  }

  // Weak side
  if (a.weakSide) {
    const weak = a.weakSide === "LeftToRight" ? a.byDirection.leftToRight : a.byDirection.rightToLeft;
    const strong = a.weakSide === "LeftToRight" ? a.byDirection.rightToLeft : a.byDirection.leftToRight;
    // Mention only the figures that actually differ.
    const perfectDiffers = Math.abs(weak.perfectRate - strong.perfectRate) >= PERFECT_DOWN;
    const medianDiffers = Math.abs(weak.medianMs - strong.medianMs) >= MEDIAN_MIN_GAP_MS;
    const key = perfectDiffers && medianDiffers ? "weakSide" : medianDiffers ? "weakSideMedian" : "weakSidePerfect";
    improvements.unshift({
      key,
      params: {
        side: sides[a.weakSide],
        weakPerfect: Math.round(weak.perfectRate),
        strongPerfect: Math.round(strong.perfectRate),
        weakMedian: Math.round(weak.medianMs),
        strongMedian: Math.round(strong.medianMs),
      },
    });
  }

  // Fatigue
  const fatigue = a.fatigue?.detected
    ? {
        key: "fatigue",
        params: {
          startPerfect: Math.round(a.fatigue.startPerfectRate),
          endPerfect: Math.round(a.fatigue.endPerfectRate),
          startMedian: Math.round(a.fatigue.startMedianMs),
          endMedian: Math.round(a.fatigue.endMedianMs),
        },
      }
    : null;

  // One recommendation, most urgent first
  let recommendation;
  if (fatigue) recommendation = { key: "recBreak", params: {} };
  else if (a.weakSide) recommendation = { key: "recFocusSide", params: { side: sides[a.weakSide] } };
  else if (enoughShots && session.accurateRate < ACCURACY_TARGET) recommendation = { key: "recShootLater", params: {} };
  else if (label === "irregular") recommendation = { key: "recSteady", params: {} };
  else if (session.perfectRate < PERFECT_LOW) recommendation = { key: "recTiming", params: {} };
  else recommendation = { key: "recKeepGoing", params: {} };

  return {
    headline: {
      key: a.durationSec >= 10 ? "headlineWithDuration" : "headline",
      params: { count: session.totalStrafes, duration: formatDuration(a.durationSec) },
    },
    comparedTo: prev ? prev.id : null,
    strengths,
    improvements,
    fatigue,
    recommendation,
  };
}
