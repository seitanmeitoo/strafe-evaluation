import { createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow, PhysicalPosition, availableMonitors } from "@tauri-apps/api/window";
import { calculateSpeedAtShot } from "../utils/cs2Physics";
import { playStrafeSound } from "../utils/audio";
import { loadSettings, saveSettings, getStrafeColors, STRAFE_SYMBOLS, formatKeyDisplay } from "../utils/settings";
import { t } from "../i18n";
import "../App.css";

const OPACITY_STEPS = [0.95, 0.8, 0.6, 0.4];

export default function OverlayApp() {
  const [lastStrafe, setLastStrafe] = createSignal(null);
  const [perfectStreak, setPerfectStreak] = createSignal(0);
  const [totalShots, setTotalShots] = createSignal(0);
  const [accurateShots, setAccurateShots] = createSignal(0);
  const [isLocked, setIsLocked] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(true);
  const [settings, setSettings] = createSignal(loadSettings());

  const opacity = () => settings().overlay?.opacity ?? 0.85;
  const colors = createMemo(() => getStrafeColors(settings().colorblindMode));
  const leftKey = () => formatKeyDisplay(settings().keys?.left || "A");
  const rightKey = () => formatKeyDisplay(settings().keys?.right || "D");

  const lastEvaluation = createMemo(() => {
    const s = lastStrafe();
    if (!s || s.shot_delay == null) return null;
    return calculateSpeedAtShot(s);
  });

  const accuracyRate = createMemo(() => {
    const total = totalShots();
    if (total === 0) return null;
    return Math.round((accurateShots() / total) * 100);
  });

  async function handleToggleLock() {
    const next = !isLocked();
    try {
      await invoke("set_overlay_click_through", { ignore: next });
      setIsLocked(next);
    } catch (e) {
      console.error("Failed to toggle click-through lock:", e);
    }
  }

  function cycleOpacity() {
    const current = opacity();
    const nextIdx = (OPACITY_STEPS.findIndex((s) => Math.abs(s - current) < 0.05) + 1) % OPACITY_STEPS.length;
    const next = OPACITY_STEPS[nextIdx];
    const updated = {
      ...settings(),
      overlay: {
        ...settings().overlay,
        opacity: next,
      },
    };
    setSettings(updated);
    saveSettings(updated);
    emit("settings-changed", updated).catch(() => {});
  }

  async function handleClose() {
    try {
      await invoke("toggle_overlay", { open: false });
    } catch (e) {
      console.error("Failed to hide overlay:", e);
    }
  }

  function handleReset() {
    setLastStrafe(null);
    setPerfectStreak(0);
    setTotalShots(0);
    setAccurateShots(0);
  }

  onMount(() => {
    document.documentElement.classList.add("overlay-mode");
    document.body.classList.add("overlay-mode");

    const currentSettings = loadSettings();
    setSettings(currentSettings);

    // Restore saved window position with off-screen boundary check
    const restorePosition = async () => {
      try {
        const savedPos = localStorage.getItem("strafe_overlay_position");
        if (!savedPos) return;

        const { x, y } = JSON.parse(savedPos);
        if (typeof x !== "number" || typeof y !== "number") return;

        const monitors = await availableMonitors();
        if (monitors && monitors.length > 0) {
          const isVisibleOnAny = monitors.some((m) => {
            const monLeft = m.position.x;
            const monRight = m.position.x + m.size.width;
            const monTop = m.position.y;
            const monBottom = m.position.y + m.size.height;

            return (
              x + 50 > monLeft &&
              x < monRight &&
              y + 30 > monTop &&
              y < monBottom
            );
          });

          if (!isVisibleOnAny) {
            console.warn("Saved overlay position is off-screen, resetting:", { x, y });
            return;
          }
        }

        await appWindow.setPosition(new PhysicalPosition(x, y));
      } catch (e) {
        console.warn("Could not restore overlay position:", e);
      }
    };
    restorePosition();

    // Query initial backend overlay state
    const fetchOverlayState = async () => {
      try {
        const state = await invoke("get_overlay_state");
        if (state) {
          setIsLocked(Boolean(state.is_locked));
          setIsVisible(Boolean(state.is_open));
        }
      } catch (e) {
        console.warn("Failed to get overlay state:", e);
      }
    };
    fetchOverlayState();

    let unlistenStrafe;
    let unlistenLock;
    let unlistenVis;
    let unlistenSettings;
    let unlistenReset;
    let unlistenMove;
    let moveTimeout = null;

    const setupListeners = async () => {
      unlistenStrafe = await listen("strafe", (event) => {
        const payload = event.payload;
        const strafe = {
          type: payload.strafe_type,
          duration: payload.duration,
          shot_delay: payload.shot_delay,
          movement_duration: payload.movement_duration,
          direction: payload.direction || "LeftToRight",
          is_diagonal: Boolean(payload.is_diagonal),
        };

        setLastStrafe(strafe);

        // Update streak
        if (strafe.type === "Perfect") {
          setPerfectStreak((p) => p + 1);
        } else {
          setPerfectStreak(0);
        }

        // Update shot metrics
        if (strafe.shot_delay != null) {
          const evalRes = calculateSpeedAtShot(strafe);
          setTotalShots((t) => t + 1);
          if (evalRes?.isAccurate) {
            setAccurateShots((a) => a + 1);
          }
        }

        // Audio feedback (only play if overlay is currently visible)
        if (settings().audio?.enabled && isVisible()) {
          playStrafeSound(strafe.type, settings().audio?.volume ?? 0.5);
        }
      });

      unlistenLock = await listen("overlay-lock-toggled", (event) => {
        const locked = Boolean(event.payload?.is_locked);
        setIsLocked(locked);
      });

      unlistenVis = await listen("overlay-visibility-toggled", (event) => {
        const visible = Boolean(event.payload?.visible);
        setIsVisible(visible);
      });

      unlistenSettings = await listen("settings-changed", (event) => {
        const newSettings = event.payload || loadSettings();
        setSettings(newSettings);
      });

      unlistenReset = await listen("strafe-reset", () => {
        handleReset();
      });

      // Debounced position saving (300ms)
      unlistenMove = await appWindow.onMoved(({ payload: position }) => {
        if (moveTimeout) clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
          try {
            localStorage.setItem(
              "strafe_overlay_position",
              JSON.stringify({ x: position.x, y: position.y })
            );
          } catch (e) {
            // Ignore
          }
        }, 300);
      });
    };

    setupListeners();

    onCleanup(() => {
      if (moveTimeout) clearTimeout(moveTimeout);
      if (typeof unlistenStrafe === "function") unlistenStrafe();
      if (typeof unlistenLock === "function") unlistenLock();
      if (typeof unlistenVis === "function") unlistenVis();
      if (typeof unlistenSettings === "function") unlistenSettings();
      if (typeof unlistenReset === "function") unlistenReset();
      if (typeof unlistenMove === "function") unlistenMove();
      document.documentElement.classList.remove("overlay-mode");
      document.body.classList.remove("overlay-mode");
    });
  });

  return (
    <div
      className="w-[270px] h-[135px] select-none p-1.5 overflow-hidden flex flex-col justify-between"
      style={{ opacity: opacity() }}
    >
      <div
        className={`w-full h-full rounded-2xl p-2.5 flex flex-col justify-between hud-glass border transition-all duration-150 ${
          isLocked()
            ? "bg-slate-950/85 border-amber-500/40 shadow-lg shadow-amber-950/20"
            : "bg-slate-900/90 border-slate-700/70 shadow-2xl"
        }`}
      >
        {/* Top bar: Drag region & Controls */}
        <div className="flex items-center justify-between text-xs text-slate-300">
          {/* Drag Handle */}
          <div
            data-tauri-drag-region
            className="flex items-center gap-1.5 cursor-move font-semibold text-[11px] text-slate-400 hover:text-slate-200 tracking-wide select-none"
            title={t("overlayApp.dragTooltip")}
          >
            <span className="text-slate-500 font-mono pointer-events-none">⋮⋮</span>
            <span className="pointer-events-none">{t("overlayApp.dragHandle")}</span>
          </div>

          {/* Streak Badge */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold select-none transition-all ${
              perfectStreak() > 0
                ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                : "bg-slate-800/60 text-slate-500"
            }`}
            title={t("overlayApp.streakTooltip")}
          >
            <span>🔥</span>
            <span>{perfectStreak()}</span>
          </div>

          {/* Controls: Opacity, Lock, Close */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={cycleOpacity}
              className="px-1.5 py-0.5 rounded bg-slate-800/70 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white transition-all cursor-pointer font-mono"
              title={t("overlayApp.opacityTooltip")}
            >
              {Math.round(opacity() * 100)}%
            </button>

            <button
              type="button"
              onClick={handleToggleLock}
              className={`p-1 rounded text-[11px] transition-all cursor-pointer flex items-center justify-center ${
                isLocked()
                  ? "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
              }`}
              title={
                isLocked()
                  ? t("overlayApp.lockActiveTooltip")
                  : t("overlayApp.lockInactiveTooltip")
              }
            >
              {isLocked() ? "🔒" : "🔓"}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded bg-slate-800/80 hover:bg-rose-600/80 text-slate-400 hover:text-white text-[11px] transition-all cursor-pointer flex items-center justify-center leading-none"
              title={t("overlayApp.closeTooltip")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Center: Hero Last Strafe Metric */}
        <div className="flex items-center justify-between py-1 px-1">
          {lastStrafe() ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {/* Badge Type */}
                <div
                  className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1"
                  style={{
                    "background-color":
                      lastStrafe().type === "Perfect"
                        ? `${colors().perfect}26`
                        : lastStrafe().type === "Early"
                        ? `${colors().early}26`
                        : `${colors().late}26`,
                    color:
                      lastStrafe().type === "Perfect"
                        ? colors().perfect
                        : lastStrafe().type === "Early"
                        ? colors().early
                        : colors().late,
                    border: `1px solid ${
                      lastStrafe().type === "Perfect"
                        ? `${colors().perfect}60`
                        : lastStrafe().type === "Early"
                        ? `${colors().early}60`
                        : `${colors().late}60`
                    }`,
                  }}
                >
                  <span>
                    {lastStrafe().type === "Perfect"
                      ? STRAFE_SYMBOLS.perfect
                      : lastStrafe().type === "Early"
                      ? STRAFE_SYMBOLS.early
                      : STRAFE_SYMBOLS.late}
                  </span>
                  <span>{lastStrafe().type}</span>
                </div>

                {/* Timing ms */}
                <div className="text-sm font-mono font-extrabold text-white">
                  {lastStrafe().type === "Perfect"
                    ? "0 ms"
                    : `${Math.round(lastStrafe().duration / 1000)} ms`}
                </div>
              </div>

              {/* Direction Indicator */}
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <span>
                  {lastStrafe().direction === "LeftToRight"
                    ? `${leftKey()} ➔ ${rightKey()}`
                    : `${rightKey()} ➔ ${leftKey()}`}
                </span>
                {lastStrafe().is_diagonal && (
                  <span className="text-[10px] px-1 rounded bg-slate-800 text-sky-400 font-mono">
                    ↗
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic text-center w-full py-1">
              {t("overlayApp.waitingStrafe")}
            </div>
          )}
        </div>

        {/* Bottom bar: CS2 Speed at shot & Accuracy */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
          {/* Shot Speed if fired */}
          {lastEvaluation() ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">{t("overlayApp.speed")}</span>
              <span
                className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                  lastEvaluation().isAccurate
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {lastEvaluation().residualSpeed} u/s
              </span>
              <span className="text-slate-400 font-mono">
                +{Math.round((lastStrafe()?.shot_delay || 0) / 1000)}ms
              </span>
            </div>
          ) : (
            <div className="text-slate-500 flex items-center gap-1 font-mono">
              <span>{isLocked() ? t("overlayApp.modeGame") : t("overlayApp.modeMove")}</span>
            </div>
          )}

          {/* Aggregate Accuracy */}
          <div className="flex items-center gap-1">
            {accuracyRate() !== null ? (
              <span className="text-slate-300 font-semibold font-mono">
                🎯 {accuracyRate()}%{" "}
                <span className="text-slate-500 font-normal">
                  ({accurateShots()}/{totalShots()})
                </span>
              </span>
            ) : (
              <span className="text-slate-500 text-[10px]">
                {t("overlayApp.shotsCount", { count: 0 })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
