// Long-term progress from saved sessions (newest first).

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_AFTER_DAYS = 30; // above this span, points are grouped by week
const MIN_STRAFES_FOR_RECORD = 30;
const MIN_SHOTS_FOR_RECORD = 10;

/** Sessions saved within the last `days` days (all of them when days is null). */
export function sessionsInRange(sessions, days, now = Date.now()) {
  const list = Array.isArray(sessions) ? sessions : [];
  if (days == null) return list;
  return list.filter((s) => now - Date.parse(s.timestamp) <= days * DAY_MS);
}

function dayKey(time) {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function weekKey(time) {
  const start = new Date(dayKey(time));
  const shift = (start.getDay() + 6) % 7; // weeks start on Monday
  start.setDate(start.getDate() - shift);
  return start.getTime();
}

/**
 * One point per day (or per week over long spans), oldest first:
 * { time, sessions, strafes, perfectRate, medianMs, accurateRate (null without shots) }.
 * Rates are weighted by strafes (and by shots for accuracy).
 */
export function progressSeries(sessions) {
  const list = (sessions || []).filter((s) => s && s.totalStrafes > 0 && !Number.isNaN(Date.parse(s.timestamp)));
  if (list.length === 0) return { unit: "day", points: [] };

  const times = list.map((s) => Date.parse(s.timestamp));
  const span = (Math.max(...times) - Math.min(...times)) / DAY_MS;
  const unit = span > WEEKLY_AFTER_DAYS ? "week" : "day";
  const keyOf = unit === "week" ? weekKey : dayKey;

  const buckets = new Map();
  for (const s of list) {
    const key = keyOf(Date.parse(s.timestamp));
    const b = buckets.get(key) || { time: key, sessions: 0, strafes: 0, perfect: 0, median: 0, shots: 0, accurate: 0 };
    b.sessions += 1;
    b.strafes += s.totalStrafes;
    b.perfect += (s.perfectRate || 0) * s.totalStrafes;
    b.median += (s.medianDurationMs || 0) * s.totalStrafes;
    b.shots += s.totalShots || 0;
    b.accurate += (s.accurateRate || 0) * (s.totalShots || 0);
    buckets.set(key, b);
  }

  const points = [...buckets.values()]
    .sort((a, b) => a.time - b.time)
    .map((b) => ({
      time: b.time,
      sessions: b.sessions,
      strafes: b.strafes,
      perfectRate: Math.round((b.perfect / b.strafes) * 10) / 10,
      medianMs: Math.round((b.median / b.strafes) * 10) / 10,
      accurateRate: b.shots > 0 ? Math.round((b.accurate / b.shots) * 10) / 10 : null,
    }));
  return { unit, points };
}

/** Personal bests over saved sessions (sessions with too few strafes or shots are ignored). */
export function sessionRecords(sessions) {
  const list = (sessions || []).filter((s) => s && s.totalStrafes >= MIN_STRAFES_FOR_RECORD);
  const best = (items, value, better) =>
    items.reduce((acc, s) => (acc == null || better(value(s), value(acc)) ? s : acc), null);

  const perfect = best(list, (s) => s.perfectRate || 0, (a, b) => a > b);
  const median = best(list, (s) => s.medianDurationMs ?? Infinity, (a, b) => a < b);
  const withShots = list.filter((s) => (s.totalShots || 0) >= MIN_SHOTS_FOR_RECORD);
  const accuracy = best(withShots, (s) => s.accurateRate || 0, (a, b) => a > b);

  return {
    bestPerfect: perfect ? { value: perfect.perfectRate, timestamp: perfect.timestamp } : null,
    bestMedian: median ? { value: median.medianDurationMs, timestamp: median.timestamp } : null,
    bestAccuracy: accuracy ? { value: accuracy.accurateRate, timestamp: accuracy.timestamp } : null,
  };
}
