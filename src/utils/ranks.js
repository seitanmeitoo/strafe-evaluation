// Rank from the recent sessions. Scores are out of 100.

export const RANK_WINDOW = 10; // sessions used for the rank
const MEDIAN_WORST_MS = 50; // median at which the timing part of the score reaches 0

export const DEFAULT_RANKS = [
  { name: "Beginner", min: 0 },
  { name: "Apprentice", min: 20 },
  { name: "Skilled", min: 40 },
  { name: "Expert", min: 60 },
  { name: "Master", min: 80 },
  { name: "Legend", min: 90 },
];

/** Score of one saved session: Perfect rate, short median and, when there were shots, accuracy. */
export function sessionScore(session) {
  if (!session || !session.totalStrafes) return null;
  const perfect = (session.perfectRate || 0) / 100;
  const median = Math.max(0, Math.min(1, 1 - (session.medianDurationMs || 0) / MEDIAN_WORST_MS));
  if ((session.totalShots || 0) > 0) {
    const accuracy = (session.accurateRate || 0) / 100;
    return Math.round((0.4 * perfect + 0.3 * median + 0.3 * accuracy) * 100);
  }
  return Math.round((0.6 * perfect + 0.4 * median) * 100);
}

/** Valid rank list sorted by threshold, always starting at 0. Falls back to the defaults. */
export function normalizeRanks(ranks) {
  if (!Array.isArray(ranks) || ranks.length === 0) return DEFAULT_RANKS.map((r) => ({ ...r }));
  const cleaned = ranks
    .filter((r) => r && typeof r.name === "string" && r.name.trim() !== "" && Number.isFinite(Number(r.min)))
    .map((r) => ({ name: r.name.trim().slice(0, 24), min: Math.max(0, Math.min(100, Math.round(Number(r.min)))) }))
    .sort((a, b) => a.min - b.min);
  if (cleaned.length === 0) return DEFAULT_RANKS.map((r) => ({ ...r }));
  cleaned[0].min = 0;
  return cleaned;
}

/**
 * Current rank from saved sessions (newest first).
 * Returns null without any session, else { name, score, index, next, sessions }.
 */
export function currentRank(sessions, ranks) {
  const scores = (sessions || [])
    .slice(0, RANK_WINDOW)
    .map(sessionScore)
    .filter((s) => s != null);
  if (scores.length === 0) return null;

  const list = normalizeRanks(ranks);
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  let index = 0;
  list.forEach((r, i) => {
    if (score >= r.min) index = i;
  });
  return {
    name: list[index].name,
    score,
    index,
    next: list[index + 1] || null,
    sessions: scores.length,
  };
}
