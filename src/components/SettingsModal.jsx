import { createSignal, createEffect, onCleanup, Show, For } from "solid-js";
import {
  PRESETS,
  DEFAULT_SETTINGS,
  COLORBLIND_PALETTES,
  RAPID_TRIGGER_PRESET,
  SETTINGS_BOUNDS,
  clampNumber,
  normalizeKey,
  formatKeyDisplay,
  STRAFE_SYMBOLS,
} from "../utils/settings";
import { playStrafeSound } from "../utils/audio";
import { open } from "@tauri-apps/api/shell";
import { t } from "../i18n";

export default function SettingsModal(props) {
  const [keys, setKeys] = createSignal({ ...DEFAULT_SETTINGS.keys });
  const [perfectThresholdMs, setPerfectThresholdMs] = createSignal(
    DEFAULT_SETTINGS.perfectThresholdMs
  );
  const [maxStrafeMs, setMaxStrafeMs] = createSignal(
    DEFAULT_SETTINGS.maxStrafeMs
  );
  const [goalsEnabled, setGoalsEnabled] = createSignal(
    DEFAULT_SETTINGS.visualGoals.enabled
  );
  const [earlyTargetMs, setEarlyTargetMs] = createSignal(
    DEFAULT_SETTINGS.visualGoals.earlyTargetMs
  );
  const [lateTargetMs, setLateTargetMs] = createSignal(
    DEFAULT_SETTINGS.visualGoals.lateTargetMs
  );
  const [theme, setTheme] = createSignal(DEFAULT_SETTINGS.theme);
  const [colorblindMode, setColorblindMode] = createSignal(
    DEFAULT_SETTINGS.colorblindMode
  );
  const [audioEnabled, setAudioEnabled] = createSignal(
    DEFAULT_SETTINGS.audio.enabled
  );
  const [audioVolume, setAudioVolume] = createSignal(
    DEFAULT_SETTINGS.audio.volume
  );
  const [overlayOpacity, setOverlayOpacity] = createSignal(
    DEFAULT_SETTINGS.overlay.opacity
  );
  const [overlayAutoStart, setOverlayAutoStart] = createSignal(
    DEFAULT_SETTINGS.overlay.autoStart
  );
  const [activeRebind, setActiveRebind] = createSignal(null);
  const [rebindError, setRebindError] = createSignal(null);
  const [rapidTriggerNotice, setRapidTriggerNotice] = createSignal(false);

  function handleCancel() {
    setActiveRebind(null);
    setRebindError(null);
    props.onClose();
  }

  // Sync state whenever modal is opened
  createEffect(() => {
    if (props.isOpen && props.currentSettings) {
      const s = props.currentSettings;
      setKeys({ ...s.keys });
      setPerfectThresholdMs(s.perfectThresholdMs);
      setMaxStrafeMs(s.maxStrafeMs);
      setGoalsEnabled(Boolean(s.visualGoals?.enabled));
      setEarlyTargetMs(s.visualGoals?.earlyTargetMs ?? 15);
      setLateTargetMs(s.visualGoals?.lateTargetMs ?? 20);
      setTheme(s.theme || "dark");
      setColorblindMode(s.colorblindMode || "default");
      setAudioEnabled(
        typeof s.audio?.enabled === "boolean" ? s.audio.enabled : true
      );
      setAudioVolume(typeof s.audio?.volume === "number" ? s.audio.volume : 0.5);
      setOverlayOpacity(
        typeof s.overlay?.opacity === "number" ? s.overlay.opacity : 0.85
      );
      setOverlayAutoStart(Boolean(s.overlay?.autoStart));
      setActiveRebind(null);
      setRebindError(null);
      setRapidTriggerNotice(false);
    }
  });

  // Key capture listener when rebinding
  createEffect(() => {
    const rebindingDirection = activeRebind();
    if (!rebindingDirection) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setActiveRebind(null);
        setRebindError(null);
        return;
      }

      const captured = normalizeKey(e.key);
      if (!captured) {
        setRebindError(t("settings.unsupportedKey"));
        return;
      }

      // Check if key is already assigned to another direction
      const currentKeys = keys();
      const duplicateDir = Object.entries(currentKeys).find(
        ([dir, k]) => dir !== rebindingDirection && k.toUpperCase() === captured.toUpperCase()
      );
      if (duplicateDir) {
        setRebindError(t("settings.duplicateKey", { key: captured }));
        return;
      }

      setRebindError(null);
      setKeys((prev) => ({
        ...prev,
        [rebindingDirection]: captured,
      }));
      setActiveRebind(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    });
  });

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (preset) {
      setKeys({ ...preset.keys });
      setRebindError(null);
    }
  }

  function applyRapidTriggerPreset() {
    setPerfectThresholdMs(RAPID_TRIGGER_PRESET.perfectThresholdMs);
    setMaxStrafeMs(RAPID_TRIGGER_PRESET.maxStrafeMs);
    setGoalsEnabled(RAPID_TRIGGER_PRESET.visualGoals.enabled);
    setEarlyTargetMs(RAPID_TRIGGER_PRESET.visualGoals.earlyTargetMs);
    setLateTargetMs(RAPID_TRIGGER_PRESET.visualGoals.lateTargetMs);
    setRapidTriggerNotice(true);
    setRebindError(null);
    setTimeout(() => setRapidTriggerNotice(false), 4000);
  }

  function handleReset() {
    setKeys({ ...DEFAULT_SETTINGS.keys });
    setPerfectThresholdMs(DEFAULT_SETTINGS.perfectThresholdMs);
    setMaxStrafeMs(DEFAULT_SETTINGS.maxStrafeMs);
    setGoalsEnabled(DEFAULT_SETTINGS.visualGoals.enabled);
    setEarlyTargetMs(DEFAULT_SETTINGS.visualGoals.earlyTargetMs);
    setLateTargetMs(DEFAULT_SETTINGS.visualGoals.lateTargetMs);
    setTheme(DEFAULT_SETTINGS.theme);
    setColorblindMode(DEFAULT_SETTINGS.colorblindMode);
    setAudioEnabled(DEFAULT_SETTINGS.audio.enabled);
    setAudioVolume(DEFAULT_SETTINGS.audio.volume);
    setOverlayOpacity(DEFAULT_SETTINGS.overlay.opacity);
    setOverlayAutoStart(DEFAULT_SETTINGS.overlay.autoStart);
    setActiveRebind(null);
    setRebindError(null);
  }

  function handleSave() {
    props.onSave({
      keys: keys(),
      perfectThresholdMs: clampNumber(
        perfectThresholdMs(),
        SETTINGS_BOUNDS.perfectThresholdMs.min,
        SETTINGS_BOUNDS.perfectThresholdMs.max,
        DEFAULT_SETTINGS.perfectThresholdMs
      ),
      maxStrafeMs: clampNumber(
        maxStrafeMs(),
        SETTINGS_BOUNDS.maxStrafeMs.min,
        SETTINGS_BOUNDS.maxStrafeMs.max,
        DEFAULT_SETTINGS.maxStrafeMs
      ),
      visualGoals: {
        enabled: goalsEnabled(),
        earlyTargetMs: clampNumber(
          earlyTargetMs(),
          SETTINGS_BOUNDS.earlyTargetMs.min,
          SETTINGS_BOUNDS.earlyTargetMs.max,
          DEFAULT_SETTINGS.visualGoals.earlyTargetMs
        ),
        lateTargetMs: clampNumber(
          lateTargetMs(),
          SETTINGS_BOUNDS.lateTargetMs.min,
          SETTINGS_BOUNDS.lateTargetMs.max,
          DEFAULT_SETTINGS.visualGoals.lateTargetMs
        ),
      },
      theme: theme(),
      colorblindMode: colorblindMode(),
      audio: {
        enabled: audioEnabled(),
        volume: clampNumber(
          audioVolume(),
          SETTINGS_BOUNDS.audioVolume.min,
          SETTINGS_BOUNDS.audioVolume.max,
          DEFAULT_SETTINGS.audio.volume
        ),
      },
      overlay: {
        opacity: clampNumber(
          overlayOpacity(),
          SETTINGS_BOUNDS.overlayOpacity.min,
          SETTINGS_BOUNDS.overlayOpacity.max,
          DEFAULT_SETTINGS.overlay.opacity
        ),
        autoStart: overlayAutoStart(),
      },
    });
    props.onClose();
  }

  function testSound(type) {
    playStrafeSound(type, audioVolume());
  }

  return (
    <Show when={props.isOpen}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCancel();
          }
        }}
      >
        <div className="bg-[#1e293b] text-white rounded-2xl shadow-2xl border border-slate-700 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-[#0f172a]">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                {t("settings.title")}
              </h2>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={handleCancel}
              title={t("settings.close")}
            >
              ✕
            </button>
          </div>

          {/* Modal body */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-130px)] text-sm">
            {/* Theme Section */}
            <div>
              <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider block mb-2">
                {t("settings.themeSection")}
              </label>
              <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/60 text-xs max-w-xs">
                <button
                  type="button"
                  className={`flex-1 py-1 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    theme() === "dark"
                      ? "bg-sky-500 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => setTheme("dark")}
                >
                  {t("settings.themeDark")}
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    theme() === "light"
                      ? "bg-sky-500 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => setTheme("light")}
                >
                  {t("settings.themeLight")}
                </button>
              </div>
            </div>

            {/* Colorblind Mode & Accessibility */}
            <div className="border-t border-slate-700/60 pt-4 space-y-2">
              <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider block">
                {t("settings.colorblindSection")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <For each={Object.values(COLORBLIND_PALETTES)}>
                  {(pal) => (
                    <button
                      type="button"
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        colorblindMode() === pal.id
                          ? "bg-slate-800 border-sky-400 shadow-md ring-1 ring-sky-400/40"
                          : "bg-slate-900/50 hover:bg-slate-850 border-slate-700/60 text-slate-300"
                      }`}
                      onClick={() => setColorblindMode(pal.id)}
                    >
                      <span className="text-xs font-semibold block">
                        {t(`settings.colorblind${pal.id.charAt(0).toUpperCase() + pal.id.slice(1)}`)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] text-black font-black"
                          style={{ "background-color": pal.early }}
                          title="Early"
                        >
                          {STRAFE_SYMBOLS.early}
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] text-black font-black"
                          style={{ "background-color": pal.late }}
                          title="Late"
                        >
                          {STRAFE_SYMBOLS.late}
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] text-black font-black"
                          style={{ "background-color": pal.perfect }}
                          title="Perfect"
                        >
                          {STRAFE_SYMBOLS.perfect}
                        </span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t("settings.colorblindHint")}
              </p>
            </div>

            {/* Audio Feedback section */}
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                  {t("settings.audioSection")}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={audioEnabled()}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                    className="accent-sky-500 rounded cursor-pointer"
                  />
                  <span>{t("settings.audioEnable")}</span>
                </label>
              </div>

              <Show when={audioEnabled()}>
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-300">{t("settings.audioVolume")}</span>
                    <span className="text-xs font-mono font-bold text-sky-400">
                      {Math.round(audioVolume() * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="w-full accent-sky-500 cursor-pointer"
                    value={audioVolume()}
                    onInput={(e) => setAudioVolume(parseFloat(e.target.value) || 0)}
                  />

                  {/* Audio preview buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">{t("settings.audioTest")}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs hover:bg-emerald-500/30 cursor-pointer transition-all"
                        onClick={() => testSound("Perfect")}
                      >
                        ✨ Perfect
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs hover:bg-sky-500/30 cursor-pointer transition-all"
                        onClick={() => testSound("Early")}
                      >
                        ⏱️ Early
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs hover:bg-amber-500/30 cursor-pointer transition-all"
                        onClick={() => testSound("Late")}
                      >
                        ⏱️ Late
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            {/* In-Game Overlay HUD Mode */}
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>🪟</span>
                  <span>{t("settings.overlaySection")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={overlayAutoStart()}
                    onChange={(e) => setOverlayAutoStart(e.target.checked)}
                    className="accent-sky-500 rounded cursor-pointer"
                  />
                  <span>{t("settings.overlayAutoStart")}</span>
                </label>
              </div>

              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">{t("settings.overlayOpacity")}</span>
                  <span className="text-xs font-mono font-bold text-sky-400">
                    {Math.round(overlayOpacity() * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  className="w-full accent-sky-500 cursor-pointer"
                  value={overlayOpacity()}
                  onInput={(e) => setOverlayOpacity(parseFloat(e.target.value) || 0.85)}
                />

                {/* Shortcuts & Click-Through explanation */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      {t("settings.overlayToggleShortcut")}
                    </div>
                    <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">Alt + O</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      {t("settings.overlayLockShortcut")}
                    </div>
                    <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">Ctrl + F11</div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 {t("settings.overlayHint")}
                </p>
              </div>
            </div>

            {/* Section 1: Key Rebinding */}
            <div className="border-t border-slate-700/60 pt-4">
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                  {t("settings.keysSection")}
                </label>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[11px] text-slate-400 mr-1">
                  {t("settings.keysPresetLabel")}
                </span>
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  onClick={() => applyPreset("qwerty")}
                >
                  QWERTY
                </button>
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  onClick={() => applyPreset("azerty")}
                >
                  AZERTY
                </button>
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  onClick={() => applyPreset("arrows")}
                >
                  {t("settings.presetArrows")}
                </button>
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  onClick={() => applyPreset("esdf")}
                >
                  ESDF
                </button>
              </div>

              {/* Grid 2x2 of movement keys */}
              <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                {/* Left */}
                <div className="flex items-center justify-between bg-slate-800/70 p-2 rounded-lg border border-slate-700/60">
                  <span className="text-xs text-slate-300 font-medium">
                    {t("settings.keyLeft")}
                  </span>
                  <button
                    type="button"
                    className={`min-w-14 px-2 py-1 rounded font-mono font-bold text-center text-xs transition-all cursor-pointer border ${
                      activeRebind() === "left"
                        ? "bg-amber-500 text-slate-900 border-amber-400 animate-pulse"
                        : "bg-slate-900 text-sky-400 border-slate-700 hover:border-slate-500"
                    }`}
                    onClick={() => setActiveRebind("left")}
                  >
                    {activeRebind() === "left" ? "..." : formatKeyDisplay(keys().left)}
                  </button>
                </div>

                {/* Right */}
                <div className="flex items-center justify-between bg-slate-800/70 p-2 rounded-lg border border-slate-700/60">
                  <span className="text-xs text-slate-300 font-medium">
                    {t("settings.keyRight")}
                  </span>
                  <button
                    type="button"
                    className={`min-w-14 px-2 py-1 rounded font-mono font-bold text-center text-xs transition-all cursor-pointer border ${
                      activeRebind() === "right"
                        ? "bg-amber-500 text-slate-900 border-amber-400 animate-pulse"
                        : "bg-slate-900 text-sky-400 border-slate-700 hover:border-slate-500"
                    }`}
                    onClick={() => setActiveRebind("right")}
                  >
                    {activeRebind() === "right" ? "..." : formatKeyDisplay(keys().right)}
                  </button>
                </div>

                {/* Forward */}
                <div className="flex items-center justify-between bg-slate-800/70 p-2 rounded-lg border border-slate-700/60">
                  <span className="text-xs text-slate-300 font-medium">
                    {t("settings.keyForward")}
                  </span>
                  <button
                    type="button"
                    className={`min-w-14 px-2 py-1 rounded font-mono font-bold text-center text-xs transition-all cursor-pointer border ${
                      activeRebind() === "forward"
                        ? "bg-amber-500 text-slate-900 border-amber-400 animate-pulse"
                        : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
                    }`}
                    onClick={() => setActiveRebind("forward")}
                  >
                    {activeRebind() === "forward" ? "..." : formatKeyDisplay(keys().forward)}
                  </button>
                </div>

                {/* Backward */}
                <div className="flex items-center justify-between bg-slate-800/70 p-2 rounded-lg border border-slate-700/60">
                  <span className="text-xs text-slate-300 font-medium">
                    {t("settings.keyBackward")}
                  </span>
                  <button
                    type="button"
                    className={`min-w-14 px-2 py-1 rounded font-mono font-bold text-center text-xs transition-all cursor-pointer border ${
                      activeRebind() === "backward"
                        ? "bg-amber-500 text-slate-900 border-amber-400 animate-pulse"
                        : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
                    }`}
                    onClick={() => setActiveRebind("backward")}
                  >
                    {activeRebind() === "backward" ? "..." : formatKeyDisplay(keys().backward)}
                  </button>
                </div>
              </div>

              <Show when={rebindError()}>
                <p className="text-xs text-rose-400 font-medium bg-rose-950/40 border border-rose-800/50 rounded-lg p-2 text-center mt-2">
                  {rebindError()}
                </p>
              </Show>
            </div>

            {/* Section 2: Tolerances */}
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider block">
                {t("settings.tolerancesSection")}
              </label>

              {/* Perfect Threshold */}
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-200">
                    {t("settings.perfectWindow")}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-right font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                      value={perfectThresholdMs()}
                      onInput={(e) =>
                        setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                      }
                    />
                    <span className="text-xs text-slate-400">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  className="w-full accent-emerald-500 cursor-pointer"
                  value={perfectThresholdMs()}
                  onInput={(e) =>
                    setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                  }
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  {t("settings.perfectWindowDesc")}
                </p>
              </div>

              {/* Max strafe duration */}
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-200">
                    {t("settings.maxDuration")}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="10"
                      min="50"
                      max="500"
                      className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-right font-bold text-sky-400 focus:outline-none focus:border-sky-400"
                      value={maxStrafeMs()}
                      onInput={(e) =>
                        setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                      }
                    />
                    <span className="text-xs text-slate-400">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  className="w-full accent-sky-500 cursor-pointer"
                  value={maxStrafeMs()}
                  onInput={(e) =>
                    setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                  }
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  {t("settings.maxDurationDesc")}
                </p>
              </div>
            </div>

            {/* Section 3: Visual Goals */}
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                  {t("settings.goalsSection")}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={goalsEnabled()}
                    onChange={(e) => setGoalsEnabled(e.target.checked)}
                    className="accent-sky-500 rounded cursor-pointer"
                  />
                  <span>{t("settings.goalsEnable")}</span>
                </label>
              </div>

              <Show when={goalsEnabled()}>
                <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                  {/* Early goal */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className="text-xs font-medium text-slate-200">
                        {t("settings.goalsEarly")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 font-bold text-white focus:outline-none focus:border-sky-400 text-sm"
                        value={earlyTargetMs()}
                        onInput={(e) =>
                          setEarlyTargetMs(parseInt(e.target.value, 10) || 15)
                        }
                      />
                      <span className="text-xs text-slate-400">ms</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {t("settings.goalsEarlyDesc")}
                    </p>
                  </div>

                  {/* Late goal */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-xs font-medium text-slate-200">
                        {t("settings.goalsLate")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 font-bold text-white focus:outline-none focus:border-amber-400 text-sm"
                        value={lateTargetMs()}
                        onInput={(e) =>
                          setLateTargetMs(parseInt(e.target.value, 10) || 20)
                        }
                      />
                      <span className="text-xs text-slate-400">ms</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {t("settings.goalsLateDesc")}
                    </p>
                  </div>
                </div>
              </Show>
            </div>

            {/* Rapid Trigger & Analog Keyboards Section */}
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider block">
                ⚡ {t("settings.rapidTriggerSection")}
              </label>
              <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2.5">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t("settings.rapidTriggerDesc")}
                </p>
                <button
                  type="button"
                  className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  onClick={applyRapidTriggerPreset}
                >
                  {t("settings.rapidTriggerPresetBtn")}
                </button>
                <Show when={rapidTriggerNotice()}>
                  <p className="text-[11px] text-emerald-400 font-semibold text-center animate-in fade-in">
                    ✓ {t("settings.rapidTriggerApplied")}
                  </p>
                </Show>
              </div>
            </div>

            {/* About Section */}
            <div className="border-t border-slate-700/60 pt-4 space-y-2">
              <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider block">
                {t("settings.aboutTitle")}
              </label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t("settings.aboutText")}
              </p>
              <button
                type="button"
                className="text-xs text-sky-400 hover:text-sky-300 underline cursor-pointer transition-colors"
                onClick={async () => {
                  try {
                    await open("https://github.com/patrikzudel/strafe-evaluation");
                  } catch (e) {
                    console.error("Failed to open original project URL:", e);
                  }
                }}
              >
                {t("settings.aboutLink")}
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-slate-700 bg-[#0f172a] flex justify-between items-center">
            <button
              type="button"
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-all cursor-pointer"
              onClick={handleReset}
            >
              {t("settings.defaultBtn")}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-slate-300 hover:text-white px-4 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-all cursor-pointer"
                onClick={handleCancel}
              >
                {t("settings.cancelBtn")}
              </button>
              <button
                type="button"
                className="text-xs font-bold text-white px-5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 shadow-md transition-all cursor-pointer"
                onClick={handleSave}
              >
                {t("settings.saveBtn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
