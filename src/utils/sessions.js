import { getStats } from "./stats";
import { getCs2Metrics } from "./cs2Physics";

const SESSIONS_STORAGE_KEY = "strafe_evaluation_sessions";

export function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load sessions:", e);
    return [];
  }
}

export function saveSessionSnapshot(strafes) {
  if (!strafes || strafes.length === 0) return null;

  const durations = strafes.map((s) => s.duration);
  const stats = getStats(durations);
  const metrics = getCs2Metrics(strafes);

  const perfectCount = strafes.filter((s) => s.type === "Perfect").length;
  const earlyCount = strafes.filter((s) => s.type === "Early").length;
  const lateCount = strafes.filter((s) => s.type === "Late").length;
  const total = strafes.length;

  const session = {
    id: `session_${Date.now()}`,
    timestamp: new Date().toISOString(),
    totalStrafes: total,
    perfectCount,
    earlyCount,
    lateCount,
    perfectRate: Math.round((perfectCount / total) * 100),
    medianDurationMs: Math.round(stats.median / 1000),
    avgDurationMs: Math.round(stats.average / 1000),
    totalShots: metrics.totalShots,
    accurateShots: metrics.accurateShots,
    accurateRate: metrics.accurateRate,
    avgShotDelayMs: metrics.avgShotDelay,
    avgResidualSpeed: metrics.avgResidualSpeed,
  };

  try {
    const sessions = loadSessions();
    const updated = [session, ...sessions].slice(0, 100); // Keep last 100 sessions
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    return session;
  } catch (e) {
    console.error("Failed to save session:", e);
    return null;
  }
}

export function deleteSession(sessionId) {
  try {
    const sessions = loadSessions().filter((s) => s.id !== sessionId);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (e) {
    console.error("Failed to delete session:", e);
    return [];
  }
}

export function clearAllSessions() {
  try {
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    return [];
  } catch (e) {
    console.error("Failed to clear sessions:", e);
    return [];
  }
}
