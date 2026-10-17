import { createSignal, createMemo, createEffect, onMount, onCleanup, Show } from "solid-js";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow, PhysicalPosition, LogicalSize, availableMonitors } from "@tauri-apps/api/window";
import { calculateSpeedAtShot } from "../utils/cs2Physics";
import { playStrafeSound } from "../utils/audio";
import { loadSettings, saveSettings, getStrafeColors, STRAFE_SYMBOLS, formatKeyDisplay } from "../utils/settings";
import { t } from "../i18n";
import { CloseIcon, LockIcon } from "./Icons";
import DrillPanel from "./DrillPanel";
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
  const [drillView, setDrillView] = createSignal({ mode: "normal", status: "idle", progress: null, result: null });
  const isDrillMode = () => drillView().mode !== "normal";

  const opacity = () => settings().overlay?.opacity ?? 0.85;
  const colors = createMemo(() => getStrafeColors(settings().colorblindMode));
  const leftKey = () => formatKeyDisplay(settings().keys?.left || "A");
  const rightKey = () => formatKeyDisplay(settings().keys?.right || "D");

  const typeColor = (type) =>
    type === "Perfect" ? colors().perfect : type === "Early" ? colors().early : colors().late;
  const typeSymbol = (type) =>
    type === "Perfect" ? STRAFE_SYMBOLS.perfect : type === "Early" ? STRAFE_SYMBOLS.early : STRAFE_SYMBOLS.late;

  // Taller window while a drill mode is selected, to fit the drill panel.
  createEffect(() => {
    const height = isDrillMode() ? 180 : 135;
    appWindow.setSize(new LogicalSize(270, height)).catch((e) => console.warn("Could not resize overlay:", e));
  });

  // Follow the app theme (each window has its own <html>).
  createEffect(() => {
    document.documentElement.classList.toggle("dark", settings().theme === "dark");
  });

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
    let unlistenDrill;
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

      // Drills run in the main window; the overlay only shows their state.
      unlistenDrill = await listen("drill-state", (event) => {
        if (event.payload) setDrillView(event.payload);
      });
      emit("drill-state-request", {}).catch(() => {});

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
      if (typeof unlistenDrill === "function") unlistenDrill();
      document.documentElement.classList.remove("overlay-mode");
      document.body.classList.remove("overlay-mode");
    });
  });

  const iconBtn =
    "h-6 min-w-6 px-1 rounded border border-line bg-card text-muted hover:text-ink text-[11px] flex items-center justify-center cursor-pointer";

  return (
    <div
      className={`w-[270px] select-none p-1.5 overflow-hidden ${isDrillMode() ? "h-[180px]" : "h-[135px]"}`}
      style={{ opacity: opacity() }}
    >
      <div
        className={`w-full h-full rounded-xl px-3 py-2 flex flex-col justify-between bg-surface text-ink border hud-glass ${
          isLocked() ? "border-accent" : "border-line"
        }`}
      >
        {/* Top bar: drag handle, Perfect streak and controls */}
        <div className="flex items-center gap-2">
          <div
            data-tauri-drag-region
            className="flex-1 flex items-center gap-1.5 cursor-move text-[11px] font-semibold text-muted hover:text-ink"
            title={t("overlayApp.dragTooltip")}
          >
            <span className="pointer-events-none">⋮⋮</span>
            <span className="pointer-events-none">{t("overlayApp.dragHandle")}</span>
          </div>

          <span
            className="text-[11px] font-bold"
            style={{ color: perfectStreak() > 0 ? colors().perfect : undefined }}
            title={t("overlayApp.streakTooltip")}
          >
            {STRAFE_SYMBOLS.perfect} {perfectStreak()}
          </span>

          <button type="button" onClick={cycleOpacity} className={iconBtn} title={t("overlayApp.opacityTooltip")}>
            {Math.round(opacity() * 100)}%
          </button>
          <button
            type="button"
            onClick={handleToggleLock}
            className={`${iconBtn} ${isLocked() ? "!border-accent !text-accent" : ""}`}
            title={isLocked() ? t("overlayApp.lockActiveTooltip") : t("overlayApp.lockInactiveTooltip")}
          >
            <LockIcon open={!isLocked()} size={12} />
          </button>
          <button type="button" onClick={handleClose} className={iconBtn} title={t("overlayApp.closeTooltip")}>
            <CloseIcon size={11} />
          </button>
        </div>

        {/* Drill mode, progress or result */}
        <Show when={isDrillMode()}>
          <DrillPanel view={drillView()} leftKey={leftKey()} rightKey={rightKey()} />
        </Show>

        {/* Last strafe */}
        {lastStrafe() ? (
          <div className="flex items-baseline justify-between">
            <span className="text-[19px] font-extrabold leading-none" style={{ color: typeColor(lastStrafe().type) }}>
              {typeSymbol(lastStrafe().type)} {lastStrafe().type}{" "}
              {lastStrafe().type === "Perfect" ? "0" : Math.round(lastStrafe().duration / 1000)} ms
            </span>
            <span className="text-[12px] text-muted">
              {lastStrafe().direction === "LeftToRight"
                ? `${leftKey()} → ${rightKey()}`
                : `${rightKey()} → ${leftKey()}`}
              {lastStrafe().is_diagonal ? ` ${t("history.diagonal")}` : ""}
            </span>
          </div>
        ) : (
          <p className="text-[12px] text-muted">{t("overlayApp.waitingStrafe")}</p>
        )}

        {/* Bottom bar: speed at shot and session accuracy */}
        <div className="flex items-center justify-between pt-1 border-t border-line text-[11px]">
          {lastEvaluation() ? (
            <span className="text-muted">
              {t("overlayApp.speed")}{" "}
              <span
                className="font-bold"
                style={{ color: lastEvaluation().isAccurate ? colors().perfect : colors().late }}
              >
                {lastEvaluation().residualSpeed} u/s
              </span>{" "}
              +{Math.round((lastStrafe()?.shot_delay || 0) / 1000)} ms
            </span>
          ) : (
            <span className="text-muted">{isLocked() ? t("overlayApp.modeGame") : t("overlayApp.modeMove")}</span>
          )}

          {accuracyRate() !== null ? (
            <span className="font-semibold">
              {accuracyRate()}% <span className="text-muted font-normal">({accurateShots()}/{totalShots()})</span>
            </span>
          ) : (
            <span className="text-muted">{t("overlayApp.shotsCount", { count: 0 })}</span>
          )}
        </div>
      </div>
    </div>
  );
}
