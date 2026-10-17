// Profile export / import: settings, sessions, drill history and records in one JSON file,
// written by the backend to Documents\Strafe Evolution.
import { invoke } from "@tauri-apps/api/tauri";
import { loadSettings, saveSettings } from "./settings";
import { loadSessions } from "./sessions";
import { loadDrillHistory, loadRecords } from "./drillHistory";

const PROFILE_APP = "Strafe Evolution";
const PROFILE_VERSION = 1;
const SESSIONS_KEY = "strafe_evaluation_sessions";
const DRILLS_KEY = "strafe_evolution_drills";
const RECORDS_KEY = "strafe_evolution_records";
const MAX_SESSIONS = 1000;
const MAX_DRILLS = 200;

const pad = (n) => String(n).padStart(2, "0");

export function profileFileName(date = new Date()) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `strafe-profile-${day}-${time}.json`;
}

export function buildProfile() {
  return {
    app: PROFILE_APP,
    version: PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    sessions: loadSessions(),
    drills: loadDrillHistory(),
    records: loadRecords(),
  };
}

/** Writes the profile file. Resolves with its full path. */
export async function exportProfile() {
  const content = JSON.stringify(buildProfile(), null, 2);
  return invoke("export_profile", { fileName: profileFileName(), content });
}

/** Profile files available for import, newest first. */
export async function listProfiles() {
  return invoke("list_profiles");
}

function unionBy(current, incoming, keyOf, max) {
  const seen = new Set(current.map(keyOf));
  const merged = [...current, ...incoming.filter((item) => item && !seen.has(keyOf(item)))];
  return merged
    .sort((a, b) => Date.parse(b.timestamp || b.startedAt) - Date.parse(a.timestamp || a.startedAt))
    .slice(0, max);
}

/**
 * Merges a parsed profile into the local data: its settings replace the current ones,
 * sessions and drills are added (no duplicates), records keep the best values.
 * Returns how many sessions and drills were added. Throws on an invalid file.
 */
export function applyProfile(profile) {
  if (!profile || profile.app !== PROFILE_APP || typeof profile.version !== "number") {
    throw new Error("not a Strafe Evolution profile");
  }
  if (profile.version > PROFILE_VERSION) {
    throw new Error("profile made by a newer version of the app");
  }

  if (profile.settings && typeof profile.settings === "object") {
    // Write as-is, then reload through loadSettings so every value is validated.
    saveSettings(profile.settings);
    saveSettings(loadSettings());
  }

  const sessionsBefore = loadSessions();
  const sessions = unionBy(sessionsBefore, Array.isArray(profile.sessions) ? profile.sessions : [], (s) => s.id, MAX_SESSIONS);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

  const drillsBefore = loadDrillHistory();
  const drills = unionBy(
    drillsBefore,
    Array.isArray(profile.drills) ? profile.drills : [],
    (d) => `${d.mode}|${d.startedAt}`,
    MAX_DRILLS
  );
  localStorage.setItem(DRILLS_KEY, JSON.stringify(drills));

  const records = loadRecords();
  const incoming = profile.records || {};
  localStorage.setItem(
    RECORDS_KEY,
    JSON.stringify({
      bestStreak: Math.max(records.bestStreak, Number(incoming.bestStreak) || 0),
      bestDrillScore: Math.max(records.bestDrillScore, Number(incoming.bestDrillScore) || 0),
    })
  );

  return {
    sessionsAdded: Math.max(0, sessions.length - sessionsBefore.length),
    drillsAdded: Math.max(0, drills.length - drillsBefore.length),
  };
}

/** Reads a profile file from the app folder and merges it. */
export async function importProfile(fileName) {
  const text = await invoke("read_profile", { fileName });
  return applyProfile(JSON.parse(text));
}
