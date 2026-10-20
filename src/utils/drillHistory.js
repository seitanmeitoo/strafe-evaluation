// Saved drill results and personal records (local storage).
const DRILLS_KEY = "strafe_evolution_drills";
const RECORDS_KEY = "strafe_evolution_records";
const MAX_DRILLS = 200;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Failed to read ${key}:`, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write ${key}:`, e);
  }
}

/** Drill results, newest first. */
export function loadDrillHistory() {
  const list = read(DRILLS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveDrillResult(result) {
  if (!result) return;
  write(DRILLS_KEY, [result, ...loadDrillHistory()].slice(0, MAX_DRILLS));
}

export function clearDrillHistory() {
  write(DRILLS_KEY, []);
}

/** Personal records: { bestStreak, bestDrillScore }. */
export function loadRecords() {
  const r = read(RECORDS_KEY, {});
  return {
    bestStreak: Number.isFinite(r?.bestStreak) ? r.bestStreak : 0,
    bestDrillScore: Number.isFinite(r?.bestDrillScore) ? r.bestDrillScore : 0,
  };
}

/** Raises the records with a finished drill. Returns the list of records that were beaten. */
export function updateRecords(result) {
  const records = loadRecords();
  const beaten = [];
  if ((result?.bestStreak || 0) > records.bestStreak) {
    records.bestStreak = result.bestStreak;
    beaten.push("bestStreak");
  }
  if ((result?.count || 0) > 0 && (result?.score || 0) > records.bestDrillScore) {
    records.bestDrillScore = result.score;
    beaten.push("bestDrillScore");
  }
  if (beaten.length > 0) write(RECORDS_KEY, records);
  return beaten;
}
