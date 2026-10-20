import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/tauri", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/tauri";
import { session } from "../test/fixtures";
import { loadDrillHistory, loadRecords } from "./drillHistory";
import { applyProfile, buildProfile, exportProfile, importProfile, listProfiles, profileFileName } from "./profile";
import { loadSessions } from "./sessions";
import { loadSettings, saveSettings } from "./settings";

const SESSIONS_KEY = "strafe_evaluation_sessions";
const DRILLS_KEY = "strafe_evolution_drills";
const RECORDS_KEY = "strafe_evolution_records";

const drill = (startedAt, overrides = {}) => ({ mode: "timed", startedAt, count: 10, score: 50, bestStreak: 3, ...overrides });
const profile = (overrides = {}) => ({ app: "Strafe Evolution", version: 1, ...overrides });
const store = (key, value) => localStorage.setItem(key, JSON.stringify(value));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
});

describe("profileFileName", () => {
  it("builds a sortable name from the local date", () => {
    expect(profileFileName(new Date(2025, 0, 5, 9, 4, 7))).toBe("strafe-profile-2025-01-05-090407.json");
  });
});

describe("buildProfile", () => {
  it("collects settings, sessions, drills and records", () => {
    store(SESSIONS_KEY, [session({ id: "a" })]);
    store(DRILLS_KEY, [drill("2025-01-01T10:00:00.000Z")]);
    store(RECORDS_KEY, { bestStreak: 4, bestDrillScore: 60 });
    const p = buildProfile();
    expect(p).toMatchObject({ app: "Strafe Evolution", version: 1 });
    expect(p.sessions).toHaveLength(1);
    expect(p.drills).toHaveLength(1);
    expect(p.records).toEqual({ bestStreak: 4, bestDrillScore: 60 });
    expect(p.settings).toEqual(loadSettings());
    expect(Number.isNaN(Date.parse(p.exportedAt))).toBe(false);
  });
});

describe("exportProfile / listProfiles / importProfile", () => {
  it("sends the file name and its JSON content to the backend", async () => {
    vi.mocked(invoke).mockResolvedValue("C:\\Docs\\profile.json");
    const path = await exportProfile();
    expect(path).toBe("C:\\Docs\\profile.json");
    const [command, args] = vi.mocked(invoke).mock.calls[0];
    expect(command).toBe("export_profile");
    expect(args.fileName).toMatch(/^strafe-profile-.*\.json$/);
    expect(JSON.parse(args.content).app).toBe("Strafe Evolution");
  });

  it("lists the profile files", async () => {
    vi.mocked(invoke).mockResolvedValue(["a.json"]);
    expect(await listProfiles()).toEqual(["a.json"]);
    expect(invoke).toHaveBeenCalledWith("list_profiles");
  });

  it("reads then merges a profile file", async () => {
    vi.mocked(invoke).mockResolvedValue(JSON.stringify(profile({ sessions: [session({ id: "x" })] })));
    const result = await importProfile("a.json");
    expect(invoke).toHaveBeenCalledWith("read_profile", { fileName: "a.json" });
    expect(result).toEqual({ sessionsAdded: 1, drillsAdded: 0 });
  });

  it("rejects a file that is not JSON", async () => {
    vi.mocked(invoke).mockResolvedValue("not json");
    await expect(importProfile("a.json")).rejects.toThrow();
  });
});

describe("applyProfile", () => {
  describe("invalid files", () => {
    it.each([
      ["null", null],
      ["a string", "profile"],
      ["another app", { app: "Other", version: 1 }],
      ["a missing version", { app: "Strafe Evolution" }],
      ["a text version", { app: "Strafe Evolution", version: "1" }],
    ])("throws on %s", (_, value) => {
      expect(() => applyProfile(value)).toThrow("not a Strafe Evolution profile");
    });

    it("throws on a newer version and leaves the data untouched", () => {
      store(SESSIONS_KEY, [session({ id: "keep" })]);
      expect(() => applyProfile(profile({ version: 2, sessions: [session({ id: "new" })] }))).toThrow("newer version");
      expect(loadSessions().map((s) => s.id)).toEqual(["keep"]);
    });
  });

  describe("sessions", () => {
    it("adds new sessions, newest first, and counts them", () => {
      const old = session({ id: "old", timestamp: "2025-01-01T10:00:00.000Z" });
      const recent = session({ id: "recent", timestamp: "2025-03-01T10:00:00.000Z" });
      store(SESSIONS_KEY, [old]);
      const result = applyProfile(profile({ sessions: [recent] }));
      expect(result.sessionsAdded).toBe(1);
      expect(loadSessions().map((s) => s.id)).toEqual(["recent", "old"]);
    });

    it("does not duplicate a session that already exists, and keeps the local copy", () => {
      store(SESSIONS_KEY, [session({ id: "a", perfectRate: 10 })]);
      const result = applyProfile(profile({ sessions: [session({ id: "a", perfectRate: 99 })] }));
      expect(result.sessionsAdded).toBe(0);
      expect(loadSessions()).toHaveLength(1);
      expect(loadSessions()[0].perfectRate).toBe(10);
    });

    it("is idempotent", () => {
      const file = profile({ sessions: [session({ id: "a" }), session({ id: "b" })] });
      expect(applyProfile(file).sessionsAdded).toBe(2);
      expect(applyProfile(file).sessionsAdded).toBe(0);
      expect(loadSessions()).toHaveLength(2);
    });

    it("keeps at most 1000 sessions, the newest ones", () => {
      const many = Array.from({ length: 1005 }, (_, i) =>
        session({ id: `s${i}`, timestamp: new Date(Date.UTC(2025, 0, 1) + i * 60000).toISOString() })
      );
      applyProfile(profile({ sessions: many }));
      const saved = loadSessions();
      expect(saved).toHaveLength(1000);
      expect(saved[0].id).toBe("s1004");
    });

    it("ignores a sessions field that is not a list and null entries", () => {
      expect(applyProfile(profile({ sessions: "oops" }))).toEqual({ sessionsAdded: 0, drillsAdded: 0 });
      expect(applyProfile(profile({ sessions: [null, session({ id: "ok" })] })).sessionsAdded).toBe(1);
    });

    it("does not import the same session twice from one file", () => {
      const dup = session({ id: "dup" });
      expect(applyProfile(profile({ sessions: [dup, { ...dup }] })).sessionsAdded).toBe(1);
      expect(loadSessions()).toHaveLength(1);
    });
  });

  describe("drills", () => {
    it("uses mode and start time to find duplicates", () => {
      store(DRILLS_KEY, [drill("2025-01-01T10:00:00.000Z")]);
      const result = applyProfile(
        profile({
          drills: [
            drill("2025-01-01T10:00:00.000Z"), // same drill
            drill("2025-01-01T10:00:00.000Z", { mode: "focus" }), // other mode
            drill("2025-01-02T10:00:00.000Z"), // other time
          ],
        })
      );
      expect(result.drillsAdded).toBe(2);
      expect(loadDrillHistory()).toHaveLength(3);
    });

    it("keeps at most 200 drills", () => {
      const many = Array.from({ length: 210 }, (_, i) => drill(new Date(Date.UTC(2025, 0, 1) + i * 60000).toISOString()));
      applyProfile(profile({ drills: many }));
      expect(loadDrillHistory()).toHaveLength(200);
    });
  });

  describe("records", () => {
    it("keeps the best of the local and imported values", () => {
      store(RECORDS_KEY, { bestStreak: 10, bestDrillScore: 40 });
      applyProfile(profile({ records: { bestStreak: 5, bestDrillScore: 80 } }));
      expect(loadRecords()).toEqual({ bestStreak: 10, bestDrillScore: 80 });
    });

    it("ignores invalid imported values", () => {
      store(RECORDS_KEY, { bestStreak: 2, bestDrillScore: 3 });
      applyProfile(profile({ records: { bestStreak: "lots", bestDrillScore: null } }));
      expect(loadRecords()).toEqual({ bestStreak: 2, bestDrillScore: 3 });
    });

    it("works without a records field", () => {
      expect(() => applyProfile(profile())).not.toThrow();
      expect(loadRecords()).toEqual({ bestStreak: 0, bestDrillScore: 0 });
    });
  });

  describe("settings", () => {
    it("replaces the current settings with the imported ones", () => {
      const imported = loadSettings();
      imported.keys = { ...imported.keys, left: "Q", right: "E" };
      applyProfile(profile({ settings: imported }));
      expect(loadSettings().keys).toMatchObject({ left: "Q", right: "E" });
    });

    it("validates imported values through loadSettings", () => {
      const imported = { ...loadSettings(), keys: { left: "A", right: "A" } };
      applyProfile(profile({ settings: imported }));
      const keys = loadSettings().keys;
      expect(keys.left).not.toBe(keys.right);
    });

    it("keeps the current settings when the file has none", () => {
      const current = loadSettings();
      saveSettings(current);
      applyProfile(profile({ settings: "nope" }));
      expect(loadSettings()).toEqual(current);
    });
  });
});
