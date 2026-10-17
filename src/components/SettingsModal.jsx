import { createSignal, createEffect, onCleanup, Show, For } from "solid-js";
import {
  PRESETS,
  DEFAULT_SETTINGS,
  COLORBLIND_PALETTES,
  RAPID_TRIGGER_PRESET,
  SETTINGS_BOUNDS,
  clampNumber,
  cloneSettings,
  normalizeKey,
  formatKeyDisplay,
  STRAFE_SYMBOLS,
  getStrafeColors,
} from "../utils/settings";
import { playStrafeSound } from "../utils/audio";
import { open } from "@tauri-apps/api/shell";
import { t } from "../i18n";
import { CloseIcon } from "./Icons";

// Shared style strings (same look as the buttons of the main window).
const btn =
  "h-8 px-3 rounded-md border border-line bg-card text-ink text-[13px] font-medium hover:border-muted transition-colors cursor-pointer select-none";
const btnSm =
  "h-7 px-2.5 rounded-md border border-line bg-card text-ink text-[12px] font-medium hover:border-muted transition-colors cursor-pointer select-none";
const btnPrimary =
  "h-8 px-3 rounded-md bg-accent text-accent-ink text-[13px] font-semibold hover:opacity-90 transition-opacity cursor-pointer select-none";
const iconBtn =
  "h-8 w-8 flex items-center justify-center rounded-md border border-line bg-card text-ink hover:border-muted transition-colors cursor-pointer select-none";
const choice = (active) =>
  `rounded-md border bg-card text-[13px] transition-colors cursor-pointer select-none ${
    active
      ? "border-accent ring-1 ring-accent text-ink font-semibold"
      : "border-line text-muted hover:border-muted hover:text-ink"
  }`;
const numInput =
  "h-7 bg-card border border-line rounded-md px-2 text-right text-[13px] font-semibold text-ink focus:outline-none focus:border-accent";
const keycap =
  "rounded-md bg-key border-b-2 border-key-edge px-2 py-0.5 text-[12px] font-bold";
const accentCls = "accent-[rgb(var(--color-accent))]";
const sectionBase = "py-4 border-t border-line first:border-t-0";
const section = `${sectionBase} space-y-3`;
const sectionTitle = "text-[13px] font-semibold";
const desc = "text-[12px] text-muted";

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
      // Keep the settings this modal does not edit (drill configuration, ...).
      ...cloneSettings(props.currentSettings),
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

  const colors = () => getStrafeColors(colorblindMode());

  const keyRows = [
    { dir: "left", label: "settings.keyLeft" },
    { dir: "right", label: "settings.keyRight" },
    { dir: "forward", label: "settings.keyForward" },
    { dir: "backward", label: "settings.keyBackward" },
  ];

  return (
    <Show when={props.isOpen}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCancel();
          }
        }}
      >
        <div className="bg-surface text-ink rounded-xl border border-line shadow-lg w-full max-w-xl max-h-[calc(100vh-48px)] flex flex-col overflow-hidden text-[13px]">
          {/* Header */}
          <div className="h-12 shrink-0 flex justify-between items-center px-5 border-b border-line">
            <h2 className="text-base font-bold">{t("settings.title")}</h2>
            <button
              type="button"
              className={iconBtn}
              onClick={handleCancel}
              title={t("settings.close")}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Modal body */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5">
            {/* Theme */}
            <div className={`${sectionBase} flex items-center justify-between`}>
              <h3 className={sectionTitle}>{t("settings.themeSection")}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${choice(theme() === "dark")} h-8 w-20`}
                  onClick={() => setTheme("dark")}
                >
                  {t("settings.themeDark")}
                </button>
                <button
                  type="button"
                  className={`${choice(theme() === "light")} h-8 w-20`}
                  onClick={() => setTheme("light")}
                >
                  {t("settings.themeLight")}
                </button>
              </div>
            </div>

            {/* Colors */}
            <div className={section}>
              <h3 className={sectionTitle}>{t("settings.colorblindSection")}</h3>
              <div className="grid grid-cols-3 gap-2">
                <For each={Object.values(COLORBLIND_PALETTES)}>
                  {(pal) => (
                    <button
                      type="button"
                      className={`${choice(colorblindMode() === pal.id)} px-3 py-2 flex items-center justify-between gap-2 text-left`}
                      onClick={() => setColorblindMode(pal.id)}
                    >
                      <span>
                        {t(`settings.colorblind${pal.id.charAt(0).toUpperCase() + pal.id.slice(1)}`)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] text-black font-black"
                          style={{ "background-color": pal.early }}
                          title={t("table.early")}
                        >
                          {STRAFE_SYMBOLS.early}
                        </span>
                        <span
                          className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] text-black font-black"
                          style={{ "background-color": pal.late }}
                          title={t("table.late")}
                        >
                          {STRAFE_SYMBOLS.late}
                        </span>
                        <span
                          className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] text-black font-black"
                          style={{ "background-color": pal.perfect }}
                          title={t("table.perfect")}
                        >
                          {STRAFE_SYMBOLS.perfect}
                        </span>
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <p className={desc}>{t("settings.colorblindHint")}</p>
            </div>

            {/* Audio feedback */}
            <div className={section}>
              <div className="flex justify-between items-center">
                <h3 className={sectionTitle}>{t("settings.audioSection")}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioEnabled()}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                    className={`${accentCls} cursor-pointer`}
                  />
                  <span>{t("settings.audioEnable")}</span>
                </label>
              </div>

              <Show when={audioEnabled()}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>{t("settings.audioVolume")}</span>
                    <span className="font-semibold">{Math.round(audioVolume() * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className={`w-full ${accentCls} cursor-pointer`}
                    value={audioVolume()}
                    onInput={(e) => setAudioVolume(parseFloat(e.target.value) || 0)}
                  />

                  {/* Audio preview buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={desc}>{t("settings.audioTest")}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className={btnSm} onClick={() => testSound("Perfect")}>
                        {t("table.perfect")}
                      </button>
                      <button type="button" className={btnSm} onClick={() => testSound("Early")}>
                        {t("table.early")}
                      </button>
                      <button type="button" className={btnSm} onClick={() => testSound("Late")}>
                        {t("table.late")}
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            {/* In-game overlay */}
            <div className={section}>
              <div className="flex justify-between items-center">
                <h3 className={sectionTitle}>{t("settings.overlaySection")}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overlayAutoStart()}
                    onChange={(e) => setOverlayAutoStart(e.target.checked)}
                    className={`${accentCls} cursor-pointer`}
                  />
                  <span>{t("settings.overlayAutoStart")}</span>
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>{t("settings.overlayOpacity")}</span>
                  <span className="font-semibold">{Math.round(overlayOpacity() * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  className={`w-full ${accentCls} cursor-pointer`}
                  value={overlayOpacity()}
                  onInput={(e) => setOverlayOpacity(parseFloat(e.target.value) || 0.85)}
                />
              </div>

              {/* Shortcuts */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span>{t("settings.overlayToggleShortcut")}</span>
                  <span className={keycap}>Alt + O</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{t("settings.overlayLockShortcut")}</span>
                  <span className={keycap}>Ctrl + F11</span>
                </div>
              </div>
              <p className={desc}>{t("settings.overlayHint")}</p>
            </div>

            {/* Movement keys */}
            <div className={section}>
              <h3 className={sectionTitle}>{t("settings.keysSection")}</h3>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${desc} mr-1`}>{t("settings.keysPresetLabel")}</span>
                <button type="button" className={btnSm} onClick={() => applyPreset("qwerty")}>
                  QWERTY
                </button>
                <button type="button" className={btnSm} onClick={() => applyPreset("azerty")}>
                  AZERTY
                </button>
                <button type="button" className={btnSm} onClick={() => applyPreset("arrows")}>
                  {t("settings.presetArrows")}
                </button>
                <button type="button" className={btnSm} onClick={() => applyPreset("esdf")}>
                  ESDF
                </button>
              </div>

              {/* 2x2 grid of movement keys */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <For each={keyRows}>
                  {(row) => (
                    <div className="flex items-center justify-between">
                      <span>{t(row.label)}</span>
                      <button
                        type="button"
                        className={`min-w-14 h-8 px-2 rounded-md font-bold text-center text-[13px] cursor-pointer transition-colors ${
                          activeRebind() === row.dir
                            ? "bg-key-on border-b border-key-edge translate-y-[3px]"
                            : "bg-key border-b-4 border-key-edge hover:border-muted"
                        }`}
                        onClick={() => setActiveRebind(row.dir)}
                      >
                        {activeRebind() === row.dir ? "..." : formatKeyDisplay(keys()[row.dir])}
                      </button>
                    </div>
                  )}
                </For>
              </div>

              <Show when={rebindError()}>
                <p className="text-[12px] font-medium text-center rounded-md border border-line bg-panel px-3 py-1.5">
                  {rebindError()}
                </p>
              </Show>
            </div>

            {/* Tolerances */}
            <div className={`${sectionBase} space-y-4`}>
              <h3 className={sectionTitle}>{t("settings.tolerancesSection")}</h3>

              {/* Perfect threshold */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t("settings.perfectWindow")}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      className={`w-16 ${numInput}`}
                      value={perfectThresholdMs()}
                      onInput={(e) =>
                        setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                      }
                    />
                    <span className={desc}>ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  className={`w-full ${accentCls} cursor-pointer`}
                  value={perfectThresholdMs()}
                  onInput={(e) =>
                    setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                  }
                />
                <p className={desc}>{t("settings.perfectWindowDesc")}</p>
              </div>

              {/* Max strafe duration */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t("settings.maxDuration")}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="10"
                      min="50"
                      max="500"
                      className={`w-16 ${numInput}`}
                      value={maxStrafeMs()}
                      onInput={(e) =>
                        setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                      }
                    />
                    <span className={desc}>ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  className={`w-full ${accentCls} cursor-pointer`}
                  value={maxStrafeMs()}
                  onInput={(e) =>
                    setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                  }
                />
                <p className={desc}>{t("settings.maxDurationDesc")}</p>
              </div>
            </div>

            {/* Visual goals */}
            <div className={section}>
              <div className="flex justify-between items-center">
                <h3 className={sectionTitle}>{t("settings.goalsSection")}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={goalsEnabled()}
                    onChange={(e) => setGoalsEnabled(e.target.checked)}
                    className={`${accentCls} cursor-pointer`}
                  />
                  <span>{t("settings.goalsEnable")}</span>
                </label>
              </div>

              <Show when={goalsEnabled()}>
                <div className="grid grid-cols-2 gap-x-8">
                  {/* Early goal */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span style={{ color: colors().early }}>{STRAFE_SYMBOLS.early}</span>
                      <span>{t("settings.goalsEarly")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className={`w-20 ${numInput}`}
                        value={earlyTargetMs()}
                        onInput={(e) =>
                          setEarlyTargetMs(parseInt(e.target.value, 10) || 15)
                        }
                      />
                      <span className={desc}>ms</span>
                    </div>
                    <p className={desc}>{t("settings.goalsEarlyDesc")}</p>
                  </div>

                  {/* Late goal */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span style={{ color: colors().late }}>{STRAFE_SYMBOLS.late}</span>
                      <span>{t("settings.goalsLate")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className={`w-20 ${numInput}`}
                        value={lateTargetMs()}
                        onInput={(e) =>
                          setLateTargetMs(parseInt(e.target.value, 10) || 20)
                        }
                      />
                      <span className={desc}>ms</span>
                    </div>
                    <p className={desc}>{t("settings.goalsLateDesc")}</p>
                  </div>
                </div>
              </Show>
            </div>

            {/* Rapid Trigger / analog keyboards */}
            <div className={section}>
              <h3 className={sectionTitle}>{t("settings.rapidTriggerSection")}</h3>
              <p className={desc}>{t("settings.rapidTriggerDesc")}</p>
              <div className="flex items-center gap-3">
                <button type="button" className={btn} onClick={applyRapidTriggerPreset}>
                  {t("settings.rapidTriggerPresetBtn")}
                </button>
                <Show when={rapidTriggerNotice()}>
                  <p className="text-[12px] font-semibold">{t("settings.rapidTriggerApplied")}</p>
                </Show>
              </div>
            </div>

            {/* About */}
            <div className={`${sectionBase} space-y-2`}>
              <h3 className={sectionTitle}>{t("settings.aboutTitle")}</h3>
              <p className={desc}>{t("settings.aboutText")}</p>
              <button
                type="button"
                className="text-[13px] font-medium text-ink underline underline-offset-4 hover:text-accent cursor-pointer transition-colors"
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
          <div className="h-14 shrink-0 px-5 border-t border-line flex justify-between items-center">
            <button type="button" className={btn} onClick={handleReset}>
              {t("settings.defaultBtn")}
            </button>

            <div className="flex items-center gap-2">
              <button type="button" className={btn} onClick={handleCancel}>
                {t("settings.cancelBtn")}
              </button>
              <button type="button" className={btnPrimary} onClick={handleSave}>
                {t("settings.saveBtn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
