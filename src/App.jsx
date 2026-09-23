import { createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import StatsTable from "./components/StatsTable";
import StrafeChart from "./components/StrafeChart";
import KeyVisualizer from "./components/KeyVisualizer";
import StrafeHistoryBar from "./components/StrafeHistoryBar";
import Cs2MetricsCard from "./components/Cs2MetricsCard";
import { getCs2Metrics } from "./utils/cs2Physics";
import "./App.css";

export default function App() {
  const [totalStrafes, setTotalStrafes] = createSignal([]);
  const [directionFilter, setDirectionFilter] = createSignal("all");
  const [requireShotOnly, setRequireShotOnly] = createSignal(false);

  function resetStrafes() {
    setTotalStrafes([]);
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

    const setupListener = async () => {
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

        setTotalStrafes((prev) => [strafe, ...prev]);
      });
    };

    setupListener();

    onCleanup(() => {
      if (typeof unlistenStrafe === "function") {
        unlistenStrafe();
      }
    });
  });

  return (
    <div className="w-screen h-screen bg-bright text-dark flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="flex justify-center items-center select-none pointer-events-none py-2">
        <h1 className="mr-3 drop-shadow-lg text-3xl font-bold text-center text-bright text-stroke italic">
          PatrikZero's
        </h1>
        <h1 className="text-3xl font-bold text-center">
          Strafe Evaluation <span className="text-sm font-semibold px-2 py-0.5 rounded bg-primary text-white ml-2">CS2 Engine</span>
        </h1>
      </div>

      {/* Main dashboard content */}
      <div className="justify-between flex-grow flex px-4 gap-4 overflow-hidden">
        {/* Left column: Controls, CS2 Metrics & Detailed Stats */}
        <div className="flex flex-col rounded-xl border-t border-white p-4 w-[50%] bg-secondary/50 shadow-xl overflow-y-auto">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h2 className="select-none text-xl font-bold">Statistics</h2>

            {/* Direction filter segmented control */}
            <div className="flex items-center gap-1 bg-dark/10 p-1 rounded-lg text-xs font-semibold select-none">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter() === "all"
                    ? "bg-primary text-white shadow-sm"
                    : "text-dark/70 hover:text-dark"
                }`}
                onClick={() => setDirectionFilter("all")}
              >
                Tous
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter() === "LeftToRight"
                    ? "bg-primary text-white shadow-sm"
                    : "text-dark/70 hover:text-dark"
                }`}
                onClick={() => setDirectionFilter("LeftToRight")}
              >
                A ➔ D
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter() === "RightToLeft"
                    ? "bg-primary text-white shadow-sm"
                    : "text-dark/70 hover:text-dark"
                }`}
                onClick={() => setDirectionFilter("RightToLeft")}
              >
                D ➔ A
              </button>
            </div>

            {/* Actions: require shot toggle & reset */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer select-none font-semibold ${
                  requireShotOnly()
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white/40 text-dark/80 border-dark/20 hover:bg-white/60"
                }`}
                onClick={toggleRequireShot}
                title="Si activé, filtre pour n'enregistrer que les strafes accompagnés d'un tir mouse1"
              >
                {requireShotOnly() ? "🎯 Tirs seuls" : "🎯 Tous"}
              </button>

              <button
                className="text-bright text-xs font-semibold select-none shadow-md px-2.5 py-1 rounded-md bg-dark/80 hover:bg-dark cursor-pointer transition-all"
                type="button"
                onClick={resetStrafes}
              >
                Reset
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
          />
        </div>

        {/* Right column: Histogram Chart */}
        <div className="flex flex-col justify-center rounded-xl w-[50%] p-2 bg-secondary/20 shadow-inner">
          <StrafeChart
            earlyStrafes={earlyStrafes()}
            lateStrafes={lateStrafes()}
            perfectStrafes={perfectStrafes()}
          />
        </div>
      </div>

      {/* Center visualizer: WASD + Mouse1 */}
      <div className="h-28 flex items-center justify-center my-1">
        <KeyVisualizer />
      </div>

      {/* Bottom history bar */}
      <StrafeHistoryBar strafes={filteredStrafes()} />
    </div>
  );
}
