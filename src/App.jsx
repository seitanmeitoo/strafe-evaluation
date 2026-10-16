import { createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import StatsTable from "./components/StatsTable";
import StrafeChart from "./components/StrafeChart";
import KeyVisualizer from "./components/KeyVisualizer";
import StrafeHistoryBar from "./components/StrafeHistoryBar";
import Cs2MetricsCard from "./components/Cs2MetricsCard";
import SettingsModal from "./components/SettingsModal";
import SessionsModal from "./components/SessionsModal";
import { getCs2Metrics } from "./utils/cs2Physics";
import { loadSettings, saveSettings, PRESETS } from "./utils/settings";
import { playStrafeSound } from "./utils/audio";
import { exportStrafesToCsv } from "./utils/exportCsv";
import { saveSessionSnapshot } from "./utils/sessions";
import { t, language, setLanguage } from "./i18n";
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

  function resetStrafes() {
    const list = totalStrafes();
    if (list.length >= 3 && !isCurrentSessionSaved()) {
      saveSessionSnapshot(list);
    }
    setIsCurrentSessionSaved(false);
    setTotalStrafes([]);
    emit("strafe-reset", {}).catch(() => {});
  }

  function handleSaveCurrentSession() {
    const list = totalStrafes();
    if (list.length === 0) {
      alert(t("dashboard.noStrafeToSave"));
      return;
    }
    if (isCurrentSessionSaved()) {
      alert(t("dashboard.sessionSaved", { count: list.length }));
      return;
    }
    const saved = saveSessionSnapshot(list);
    if (saved) {
      setIsCurrentSessionSaved(true);
      alert(t("dashboard.sessionSaved", { count: saved.totalStrafes }));
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
      syncErrors.push(`Touches : ${e}`);
    }

    try {
      await invoke("set_thresholds", {
        perfectThresholdMs: newSettings.perfectThresholdMs,
        maxStrafeMs: newSettings.maxStrafeMs,
      });
    } catch (e) {
      console.error("Failed to sync thresholds to backend:", e);
      syncErrors.push(`Seuils : ${e}`);
    }

    if (syncErrors.length > 0) {
      alert("Erreur de synchronisation avec le backend :\n" + syncErrors.join("\n"));
      return;
    }

    setSettings(newSettings);
    saveSettings(newSettings);
    if (newSettings.language) {
      setLanguage(newSettings.language);
    }
    emit("settings-changed", newSettings).catch(() => {});
  }

  function toggleTheme() {
    const nextTheme = settings().theme === "light" ? "dark" : "light";
    const updated = { ...settings(), theme: nextTheme };
    setSettings(updated);
    saveSettings(updated);
    emit("settings-changed", updated).catch(() => {});
  }

  function toggleLanguage() {
    const nextLang = language() === "fr" ? "en" : "fr";
    setLanguage(nextLang);
    const updated = { ...settings(), language: nextLang };
    setSettings(updated);
    saveSettings(updated);
    emit("settings-changed", updated).catch(() => {});
  }

  const isDark = () => settings().theme !== "light";

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

    const setupApp = async () => {
      const hasStoredSettings = Boolean(
        localStorage.getItem("strafe_evaluation_settings")
      );
      let current = settings();

      if (current.language) {
        setLanguage(current.language);
      }

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
      });

      unlistenSettings = await listen("settings-changed", (e) => {
        if (e.payload) {
          setSettings(e.payload);
          if (e.payload.language && e.payload.language !== language()) {
            setLanguage(e.payload.language);
          }
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
    });
  });

  return (
    <div
      className={`w-screen h-screen flex flex-col justify-between overflow-hidden transition-colors duration-200 ${
        isDark() ? "bg-[#0f172a] text-slate-100 dark" : "bg-slate-100 text-slate-800"
      }`}
    >
      {/* Header */}
      <div
        className={`flex justify-between items-center px-6 py-2 border-b ${
          isDark()
            ? "bg-[#0f172a] border-slate-800"
            : "bg-white/80 border-slate-200"
        }`}
      >
        {/* Left header actions: Sessions history, Theme toggle & Language switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${
              isDark()
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
            onClick={() => setIsSessionsOpen(true)}
            title={t("sessions.title")}
          >
            <span>📈</span>
            <span>{t("header.sessions")}</span>
          </button>

          <button
            type="button"
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer border ${
              isDark()
                ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
            onClick={toggleTheme}
            title={isDark() ? t("header.themeLight") : t("header.themeDark")}
          >
            {isDark() ? "🌙" : "☀️"}
          </button>

          {/* Quick Language switcher */}
          <button
            type="button"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              isDark()
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
            onClick={toggleLanguage}
            title={language() === "fr" ? "Switch to English" : "Passer en Français"}
          >
            {language() === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
          </button>
        </div>

        {/* Center: Title */}
        <div className="flex justify-center items-center select-none pointer-events-none">
          <h1 className="mr-3 drop-shadow-lg text-2xl font-bold text-center text-slate-200 text-stroke italic">
            {t("app.title")}
          </h1>
          <h1 className="text-2xl font-bold text-center tracking-wide">
            {t("app.subtitle")}{" "}
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500 text-white ml-2">
              {t("app.engineVersion")}
            </span>
          </h1>
        </div>

        {/* Right header actions: Overlay HUD toggle, Lock toggle & Settings */}
        <div className="flex items-center gap-2">
          {/* Overlay In-Game Button */}
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${
              isOverlayOpen()
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-950/20"
                : isDark()
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
            onClick={toggleOverlay}
            title={
              isOverlayOpen()
                ? t("header.overlayHide")
                : t("header.overlayShow")
            }
          >
            <span>🪟</span>
            <span>{t("header.overlay")}</span>
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isOverlayOpen() ? "bg-emerald-300 animate-pulse" : "bg-slate-500"
              }`}
            />
          </button>

          {/* Quick Click-Through lock toggle if overlay is open */}
          {isOverlayOpen() && (
            <button
              type="button"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${
                isOverlayLocked()
                  ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500"
                  : isDark()
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                  : "bg-white hover:bg-slate-50 text-amber-700 border-slate-300"
              }`}
              onClick={toggleOverlayLock}
              title={
                isOverlayLocked()
                  ? t("header.lockModeGame")
                  : t("header.lockModeEdit")
              }
            >
              <span>{isOverlayLocked() ? "🔒" : "🔓"}</span>
              <span className="hidden sm:inline">
                {isOverlayLocked() ? t("header.passThrough") : t("header.draggable")}
              </span>
            </button>
          )}

          <button
            type="button"
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all cursor-pointer shadow-sm border ${
              isDark()
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
            onClick={() => setIsSettingsOpen(true)}
            title={t("header.settings")}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main dashboard content */}
      <div className="justify-between flex-grow flex px-4 gap-4 overflow-hidden py-2">
        {/* Left column: Controls, CS2 Metrics & Detailed Stats */}
        <div
          className={`flex flex-col rounded-2xl p-4 w-[50%] shadow-xl overflow-y-auto border ${
            isDark()
              ? "bg-[#1e293b]/85 border-slate-700/60"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h2 className="select-none text-lg font-bold tracking-tight">
              {t("dashboard.statsTitle")}
            </h2>

            {/* Direction filter segmented control */}
            <div
              className={`flex items-center gap-1 p-1 rounded-lg text-xs font-semibold select-none border ${
                isDark() ? "bg-slate-900/60 border-slate-700/50" : "bg-slate-100 border-slate-200"
              }`}
            >
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter() === "all"
                    ? "bg-sky-500 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setDirectionFilter("all")}
              >
                {t("dashboard.filterAll")}
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter() === "LeftToRight"
                    ? "bg-sky-500 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setDirectionFilter("LeftToRight")}
              >
                {t("dashboard.filterAtoD")}
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter() === "RightToLeft"
                    ? "bg-sky-500 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setDirectionFilter("RightToLeft")}
              >
                {t("dashboard.filterDtoA")}
              </button>
            </div>

            {/* Actions: Require shot toggle, CSV Export, Session save & Reset */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer select-none font-semibold ${
                  requireShotOnly()
                    ? "bg-sky-500 text-white border-sky-400 shadow-sm"
                    : isDark()
                    ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                }`}
                onClick={toggleRequireShot}
                title={t("dashboard.shotsOnlyTooltip")}
              >
                {requireShotOnly() ? t("dashboard.shotsOnly") : t("dashboard.shotsAll")}
              </button>

              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer select-none font-semibold ${
                  isDark()
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                }`}
                onClick={handleExportCsv}
                title={t("dashboard.csvTooltip")}
              >
                {t("dashboard.csvExport")}
              </button>

              <button
                type="button"
                className={`text-xs px-2 py-1 rounded-lg border transition-all cursor-pointer select-none font-semibold ${
                  isDark()
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                }`}
                onClick={handleSaveCurrentSession}
                title={t("dashboard.saveSessionTooltip")}
              >
                {t("dashboard.saveSession")}
              </button>

              <button
                className="text-white text-xs font-semibold select-none shadow-md px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 cursor-pointer transition-all"
                type="button"
                onClick={resetStrafes}
                title={t("dashboard.resetTooltip")}
              >
                {t("dashboard.reset")}
              </button>
            </div>
          </div>

          {/* CS2 Tactical Precision Metrics */}
          <Cs2MetricsCard metrics={cs2Metrics()} />

          {/* Timing Stats Table */}
          <StatsTable
            earlyStrafes={earlyStrafes()}
            lateStrafes={lateStrafes()}
            perfectStrafes={perfectStrafes()}
            colorblindMode={settings().colorblindMode}
          />
          <div
            className="text-[10px] text-slate-400 text-center mt-1 cursor-help select-none"
            title={
              language() === "fr"
                ? "Les strafes Perfect (écart sous le seuil) ont une durée comptabilisée à 0 ms dans la colonne Tous."
                : "Perfect strafes (sub-threshold timing) have their duration recorded as 0 ms in the All column."
            }
          >
            ℹ️ {language() === "fr" ? "Perfect = 0 ms dans « Tous »" : "Perfect = 0 ms in 'All'"}
          </div>
        </div>

        {/* Right column: Histogram Chart & Trend Mode */}
        <div
          className={`flex flex-col justify-center rounded-2xl w-[50%] p-3 shadow-xl border ${
            isDark()
              ? "bg-[#1e293b]/85 border-slate-700/60"
              : "bg-white border-slate-200"
          }`}
        >
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
        </div>
      </div>

      {/* Center visualizer: Keys + Mouse1 */}
      <div className="h-28 flex items-center justify-center my-0.5">
        <KeyVisualizer keys={settings().keys} />
      </div>

      {/* Bottom history bar */}
      <StrafeHistoryBar
        strafes={filteredStrafes()}
        colorblindMode={settings().colorblindMode}
      />

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
    </div>
  );
}
