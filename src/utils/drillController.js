// Runs the training drill in the main window and shares its state with the overlay.
import { createSignal } from "solid-js";
import { emit } from "@tauri-apps/api/event";
import { applyStrafe, drillProgress, nextMode, startDrill, stopDrill, tickDrill } from "./drills";
import { loadRecords, saveDrillResult, updateRecords } from "./drillHistory";
import { playDrillSound } from "./audio";

const TICK_MS = 250;
const RESULT_DISPLAY_MS = 10000;

/**
 * getSettings: accessor returning the current settings (drill config in settings.drills).
 * Returns signals and actions; call dispose() when the window closes.
 */
export function createDrillController(getSettings) {
  const [mode, setMode] = createSignal(getSettings()?.drills?.defaultMode || "normal");
  const [drill, setDrill] = createSignal(null);
  let tickTimer = null;
  let resultTimer = null;

  const volume = () => (getSettings()?.audio?.enabled ? getSettings()?.audio?.volume ?? 0.5 : 0);

  function snapshot() {
    const d = drill();
    return {
      mode: mode(),
      status: d?.status || "idle",
      progress: d ? drillProgress(d) : null,
      result: d?.result || null,
    };
  }

  function broadcast() {
    emit("drill-state", snapshot()).catch(() => {});
  }

  function clearTimers() {
    if (tickTimer) clearInterval(tickTimer);
    if (resultTimer) clearTimeout(resultTimer);
    tickTimer = null;
    resultTimer = null;
  }

  function onFinished(state) {
    clearTimers();
    saveDrillResult(state.result);
    const beaten = updateRecords(state.result);
    playDrillSound(beaten.length > 0 ? "record" : "end", volume());
    setDrill({ ...state, result: { ...state.result, recordsBeaten: beaten } });
    broadcast();
    // Show the result for a while, then go back to the selected mode, ready to start again.
    resultTimer = setTimeout(() => {
      setDrill(null);
      broadcast();
    }, RESULT_DISPLAY_MS);
  }

  function start() {
    if (mode() === "normal") return;
    clearTimers();
    const state = startDrill(mode(), getSettings()?.drills, Date.now(), loadRecords().bestStreak);
    setDrill(state);
    playDrillSound("start", volume());
    broadcast();
    tickTimer = setInterval(() => {
      const current = drill();
      if (!current || current.status !== "running") return;
      const next = tickDrill(current, Date.now());
      if (next === current) return;
      if (next.status === "finished") onFinished(next);
      else {
        setDrill(next);
        broadcast();
      }
    }, TICK_MS);
  }

  function stop() {
    const current = drill();
    if (!current || current.status !== "running") return;
    onFinished(stopDrill(current, Date.now()));
  }

  function selectMode(next) {
    if (drill()?.status === "running") return; // never switch mode in the middle of a drill
    clearTimers();
    setDrill(null);
    setMode(next);
    broadcast();
  }

  function handleHotkey(action) {
    const running = drill()?.status === "running";
    if (action === "cycle") selectMode(nextMode(mode()));
    else if (action === "toggle") running ? stop() : start();
    else if (action === "reset") {
      if (running) start(); // restart the same drill from zero
      else {
        clearTimers();
        setDrill(null);
        broadcast();
      }
    }
  }

  function handleStrafe(strafe) {
    const current = drill();
    if (!current || current.status !== "running") return;
    const { state, events } = applyStrafe(current, strafe, Date.now());
    if (state.status === "finished") {
      onFinished(state);
      return;
    }
    setDrill(state);
    if (events.includes("phase-complete")) playDrillSound("phase", volume());
    if (events.includes("target-reached")) playDrillSound("target", volume());
    if (events.length > 0) broadcast();
  }

  return {
    mode,
    drill,
    snapshot,
    broadcast,
    start,
    stop,
    selectMode,
    handleHotkey,
    handleStrafe,
    dispose: clearTimers,
  };
}
