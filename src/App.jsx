import { createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import StatsTable from "./components/StatsTable";
import StrafeChart from "./components/StrafeChart";
import KeyVisualizer from "./components/KeyVisualizer";
import StrafeHistoryBar from "./components/StrafeHistoryBar";
import Cs2MetricsCard from "./components/Cs2MetricsCard";
import SettingsModal from "./components/SettingsModal";
import SessionsModal from "./components/SessionsModal";
import SessionSummaryModal from "./components/SessionSummaryModal";
import ProgressPage from "./components/ProgressPage";
import TrainingPage from "./components/TrainingPage";
import { LockIcon } from "./components/Icons";
import { getCs2Metrics } from "./utils/cs2Physics";
import { loadSettings, saveSettings, PRESETS } from "./utils/settings";
import { playStrafeSound } from "./utils/audio";
import { exportStrafesToCsv } from "./utils/exportCsv";
import { saveSessionSnapshot } from "./utils/sessions";
import { createDrillController } from "./utils/drillController";
import { t } from "./i18n";
import "./App.css";

export default function App() {
  const [totalStrafes, setTotalStrafes] = createSignal([]);
  const [directionFilter, setDirectionFilter] = createSignal("all");
  const [requireShotOnly, setRequireShotOnly] = createSignal(false);
  const [settings, setSettings] = createSignal(loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [isSessionsOpen, setIsSessionsOpen] = createSignal(false);
  const [isOverlayOpen, setIsOverlayOpen] = createSignal(false);
  const [isOverlayLocked, setIsOverlayLocked] = createSignal(false);
  const [isCurrentSessionSaved, setIsCurrentSessionSaved] = createSignal(false);
  const [lastSavedSession, setLastSavedSession] = createSignal(null);
  const [summarySession, setSummarySession] = createSignal(null);
  const [page, setPage] = createSignal("live"); // "live" | "progress" | "training"
  const drills = createDrillController(settings);

  function resetStrafes() {
    const list = totalStrafes();
    if (list.length >= 3 && !isCurrentSessionSaved()) {
      const saved = saveSessionSnapshot(list);
      if (saved) setSummarySession(saved);
    }
    setIsCurrentSessionSaved(false);
    setLastSavedSession(null);
    setTotalStrafes([]);
    emit("strafe-reset", {}).catch(() => {});
  }

  function handleSaveCurrentSession() {
    const list = totalStrafes();
    if (list.length === 0) {
      alert(t("dashboard.noStrafeToSave"));
      return;
    }
    if (isCurrentSessionSaved() && lastSavedSession()) {
      setSummarySession(lastSavedSession());
      return;
    }
    const saved = saveSessionSnapshot(list);
    if (saved) {
      setIsCurrentSessionSaved(true);
      setLastSavedSession(saved);
      setSummarySession(saved);
    }
  }

  function handleExportCsv() {
    exportStrafesToCsv(filteredStrafes());
  }

  async function toggleRequireShot() {
    const next = !requireShotOnly();
    setRequireShotOnly(next);
    try {
      await invoke("set_require_shot", { requireShot: next });
    } catch (e) {
      console.error("Failed to update require_shot state:", e);
    }
  }

  async function toggleOverlay() {
    const next = !isOverlayOpen();
    try {
      const res = await invoke("toggle_overlay", { open: next });
      setIsOverlayOpen(res);
    } catch (e) {
      console.error("Failed to toggle overlay:", e);
    }
  }

  async function toggleOverlayLock() {
    try {
      const res = await invoke("toggle_overlay_lock_cmd");
      setIsOverlayLocked(res);
    } catch (e) {
      console.error("Failed to toggle overlay lock:", e);
    }
  }

  async function handleSaveSettings(newSettings) {
    const syncErrors = [];

    try {
      await invoke("set_monitored_keys", { keys: newSettings.keys });
    } catch (e) {
      console.error("Failed to sync monitored keys to backend:", e);
      syncErrors.push(t("settings.syncErrorKeys", { error: e }));
    }

    try {
      await invoke("set_thresholds", {
        perfectThresholdMs: newSettings.perfectThresholdMs,
        maxStrafeMs: newSettings.maxStrafeMs,
      });
    } catch (e) {
      console.error("Failed to sync thresholds to backend:", e);
      syncErrors.push(t("settings.syncErrorThresholds", { error: e }));
    }

    if (syncErrors.length > 0) {
      alert(t("settings.syncErrorBackend") + "\n" + syncErrors.join("\n"));
      return;
    }

    setSettings(newSettings);
    saveSettings(newSettings);
    emit("settings-changed", newSettings).catch(() => {});
  }

  function toggleTheme() {
    const nextTheme = settings().theme === "light" ? "dark" : "light";
    const updated = { ...settings(), theme: nextTheme };
    setSettings(updated);
    saveSettings(updated);
    emit("settings-changed", updated).catch(() => {});
  }

  function saveDrillSettings(newDrills) {
    const updated = { ...settings(), drills: newDrills };
    setSettings(updated);
    saveSettings(updated);
    emit("settings-changed", updated).catch(() => {});
  }

  const isDark = () => settings().theme !== "light";

  // Apply the theme on <html> so the color tokens also reach body and modals.
  createEffect(() => {
    document.documentElement.classList.toggle("dark", isDark());
  });

  const filteredStrafes = createMemo(() => {
    const list = totalStrafes();
    const filter = directionFilter();
    if (filter === "all") return list;
    return list.filter((s) => s.direction === filter);
  });

  const earlyStrafes = createMemo(() =>
    filteredStrafes()
      .filter((s) => s.type === "Early")
      .map((s) => s.duration)
  );

  const lateStrafes = createMemo(() =>
    filteredStrafes()
      .filter((s) => s.type === "Late")
      .map((s) => s.duration)
  );

  const perfectStrafes = createMemo(() =>
    filteredStrafes()
      .filter((s) => s.type === "Perfect")
      .map((s) => s.duration)
  );

  const cs2Metrics = createMemo(() => getCs2Metrics(filteredStrafes()));

  onMount(() => {
    let unlistenStrafe;
    let unlistenSettings;
    let unlistenOverlayVis;
    let unlistenOverlayLock;
    let unlistenDrillHotkey;
    let unlistenDrillRequest;

    const setupApp = async () => {
      const hasStoredSettings = Boolean(
        localStorage.getItem("strafe_evaluation_settings")
      );
      let current = settings();

      // 1. Register listeners FIRST so no event is missed during initialization
      unlistenStrafe = await listen("strafe", (event) => {
        const payload = event.payload;
        const strafe = {
          type: payload.strafe_type,
          duration: payload.duration,
          shot_delay: payload.shot_delay,
          movement_duration: payload.movement_duration,
          direction: payload.direction || "LeftToRight",
          is_diagonal: Boolean(payload.is_diagonal),
          timestamp: new Date().toISOString(),
        };

        // Audio feedback on strafe completion (only when overlay is closed)
        if (settings().audio?.enabled && !isOverlayOpen()) {
          playStrafeSound(strafe.type, settings().audio?.volume ?? 0.5);
        }

        setTotalStrafes((prev) => [strafe, ...prev]);
        setIsCurrentSessionSaved(false);
        drills.handleStrafe(strafe);
      });

      unlistenDrillHotkey = await listen("drill-hotkey", (e) => {
        drills.handleHotkey(e.payload?.action);
      });

      // The overlay asks for the drill state when it opens.
      unlistenDrillRequest = await listen("drill-state-request", () => drills.broadcast());
      drills.broadcast();

      unlistenSettings = await listen("settings-changed", (e) => {
        if (e.payload) {
          setSettings(e.payload);
        }
      });

      unlistenOverlayVis = await listen("overlay-visibility-toggled", (e) => {
        setIsOverlayOpen(Boolean(e.payload?.visible));
      });

      unlistenOverlayLock = await listen("overlay-lock-toggled", (e) => {
        setIsOverlayLocked(Boolean(e.payload?.is_locked));
      });

      // 2. Perform backend invokes independently without blocking on single error
      try {
        const backendSettings = await invoke("get_settings");
        if (!hasStoredSettings && backendSettings?.detected_layout === "AZERTY") {
          current = {
            ...current,
            keys: { ...PRESETS.azerty.keys },
          };
          setSettings(current);
          saveSettings(current);
        }
      } catch (e) {
        console.error("Initial layout query error:", e);
      }

      try {
        await invoke("set_monitored_keys", { keys: current.keys });
      } catch (e) {
        console.error("Initial set_monitored_keys error:", e);
      }

      try {
        await invoke("set_thresholds", {
          perfectThresholdMs: current.perfectThresholdMs,
          maxStrafeMs: current.maxStrafeMs,
        });
      } catch (e) {
        console.error("Initial set_thresholds error:", e);
      }

      try {
        const overlayState = await invoke("get_overlay_state");
        if (overlayState) {
          setIsOverlayOpen(Boolean(overlayState.is_open));
          setIsOverlayLocked(Boolean(overlayState.is_locked));
        }
        if (current.overlay?.autoStart && !overlayState?.is_open) {
          const res = await invoke("toggle_overlay", { open: true });
          setIsOverlayOpen(res);
        }
      } catch (e) {
        console.error("Initial overlay sync error:", e);
      }
    };

    setupApp();

    onCleanup(() => {
      if (typeof unlistenStrafe === "function") unlistenStrafe();
      if (typeof unlistenSettings === "function") unlistenSettings();
      if (typeof unlistenOverlayVis === "function") unlistenOverlayVis();
      if (typeof unlistenOverlayLock === "function") unlistenOverlayLock();
      if (typeof unlistenDrillHotkey === "function") unlistenDrillHotkey();
      if (typeof unlistenDrillRequest === "function") unlistenDrillRequest();
      drills.dispose();
    });
  });

  const btn =
    "h-8 px-3 rounded-md border border-line bg-card text-ink text-[13px] font-medium hover:border-muted transition-colors cursor-pointer select-none";

  const PAGES = [
    { id: "live", label: "pages.live" },
    { id: "progress", label: "pages.progress" },
    { id: "training", label: "pages.training" },
  ];

  const filterBtn = (active) =>
    `cursor-pointer select-none transition-colors ${
      active ? "text-ink font-semibold underline underline-offset-4" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="w-screen h-screen min-w-[800px] min-h-[620px] flex flex-col overflow-hidden bg-surface text-ink">
      {/* Header */}
      <header className="h-[48px] shrink-0 flex items-center gap-2 px-5">
        <h1 className="text-[21px] font-extrabold tracking-tight select-none mr-auto">
          {t("app.title")}
        </h1>

        <button type="button" className={btn} onClick={() => setIsSessionsOpen(true)} title={t("sessions.title")}>
          {t("header.sessions")}
        </button>

        <button
          type="button"
          className={`${btn} ${isOverlayOpen() ? "!bg-accent !border-accent !text-accent-ink" : ""}`}
          onClick={toggleOverlay}
          title={isOverlayOpen() ? t("header.overlayHide") : t("header.overlayShow")}
          aria-pressed={isOverlayOpen()}
        >
          {t("header.overlay")}
        </button>

        {isOverlayOpen() && (
          <button
            type="button"
            className={`${btn} flex items-center gap-1.5`}
            onClick={toggleOverlayLock}
            title={isOverlayLocked() ? t("header.lockModeGame") : t("header.lockModeEdit")}
          >
            <LockIcon open={!isOverlayLocked()} />
            <span>{isOverlayLocked() ? t("header.passThrough") : t("header.draggable")}</span>
          </button>
        )}

        <button
          type="button"
          className={btn}
          onClick={toggleTheme}
          title={isDark() ? t("header.themeLight") : t("header.themeDark")}
        >
          {isDark() ? t("settings.themeLight") : t("settings.themeDark")}
        </button>

        <button type="button" className={btn} onClick={() => setIsSettingsOpen(true)} title={t("header.settings")}>
          {t("header.settingsLabel")}
        </button>
      </header>

      {/* Page tabs */}
      <nav className="h-[30px] shrink-0 flex items-start gap-5 px-5 text-[14px]">
        <For each={PAGES}>
          {(p) => (
            <button
              type="button"
              className={filterBtn(page() === p.id)}
              onClick={() => setPage(p.id)}
              aria-current={page() === p.id ? "page" : undefined}
            >
              {t(p.label)}
            </button>
          )}
        </For>
      </nav>

      <Show when={page() === "progress"}>
        <ProgressPage />
      </Show>

      <Show when={page() === "training"}>
        <TrainingPage
          drills={drills}
          drillSettings={settings().drills}
          keys={settings().keys}
          onSaveDrills={saveDrillSettings}
        />
      </Show>

      <Show when={page() === "live"}>
      {/* Main dashboard content */}
      <main className="flex-1 min-h-0 flex gap-3 px-5">
        {/* Left: statistics */}
        <section className="w-[330px] shrink-0 bg-panel rounded-xl px-4 py-3 flex flex-col">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-base font-bold">{t("dashboard.statsTitle")}</h2>
            <div className="flex gap-3 text-[12px]">
              <button type="button" className={filterBtn(directionFilter() === "all")} onClick={() => setDirectionFilter("all")}>
                {t("dashboard.filterAll")}
              </button>
              <button type="button" className={filterBtn(directionFilter() === "LeftToRight")} onClick={() => setDirectionFilter("LeftToRight")}>
                {t("dashboard.filterAtoD")}
              </button>
              <button type="button" className={filterBtn(directionFilter() === "RightToLeft")} onClick={() => setDirectionFilter("RightToLeft")}>
                {t("dashboard.filterDtoA")}
              </button>
            </div>
          </div>

          <StatsTable
            earlyStrafes={earlyStrafes()}
            lateStrafes={lateStrafes()}
            perfectStrafes={perfectStrafes()}
            colorblindMode={settings().colorblindMode}
          />

          <Cs2MetricsCard metrics={cs2Metrics()} />
        </section>

        {/* Right: chart */}
        <section className="flex-1 min-w-0 bg-card border border-line rounded-xl p-3 flex flex-col">
          <StrafeChart
            earlyStrafes={earlyStrafes()}
            lateStrafes={lateStrafes()}
            perfectStrafes={perfectStrafes()}
            strafes={filteredStrafes()}
            visualGoals={settings().visualGoals}
            theme={settings().theme}
            colorblindMode={settings().colorblindMode}
            maxStrafeMs={settings().maxStrafeMs}
          />
        </section>
      </main>

      {/* Keys and session actions */}
      <div className="h-[104px] shrink-0 flex items-center gap-6 px-5">
        <KeyVisualizer keys={settings().keys} />

        <div className="ml-auto grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`${btn} ${requireShotOnly() ? "!border-accent !text-accent font-semibold" : ""}`}
            onClick={toggleRequireShot}
            title={t("dashboard.shotsOnlyTooltip")}
            aria-pressed={requireShotOnly()}
          >
            {t("dashboard.shotsOnly")}
          </button>
          <button type="button" className={btn} onClick={handleExportCsv} title={t("dashboard.csvTooltip")}>
            {t("dashboard.csvExport")}
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-md bg-accent text-accent-ink text-[13px] font-semibold hover:opacity-90 transition-opacity cursor-pointer select-none"
            onClick={handleSaveCurrentSession}
            title={t("dashboard.saveSessionTooltip")}
          >
            {t("dashboard.saveSession")}
          </button>
          <button type="button" className={btn} onClick={resetStrafes} title={t("dashboard.resetTooltip")}>
            {t("dashboard.reset")}
          </button>
        </div>
      </div>

      {/* Bottom history strip */}
      <StrafeHistoryBar strafes={filteredStrafes()} colorblindMode={settings().colorblindMode} />
      </Show>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen()}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings()}
        onSave={handleSaveSettings}
      />

      {/* Sessions History Modal */}
      <SessionsModal
        isOpen={isSessionsOpen()}
        onClose={() => setIsSessionsOpen(false)}
      />

      {/* End-of-session summary */}
      <SessionSummaryModal session={summarySession()} onClose={() => setSummarySession(null)} />
    </div>
  );
}
