import { createSignal, onMount, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import StatsTable from "./components/StatsTable";
import StrafeChart from "./components/StrafeChart";
import KeyVisualizer from "./components/KeyVisualizer";
import StrafeHistoryBar from "./components/StrafeHistoryBar";
import "./App.css";

export default function App() {
  const [totalStrafes, setTotalStrafes] = createSignal([]);
  const [earlyStrafes, setEarlyStrafes] = createSignal([]);
  const [lateStrafes, setLateStrafes] = createSignal([]);
  const [perfectStrafes, setPerfectStrafes] = createSignal([]);

  function resetStrafes() {
    setEarlyStrafes([]);
    setLateStrafes([]);
    setPerfectStrafes([]);
    setTotalStrafes([]);
  }

  onMount(() => {
    let unlistenStrafe;

    const setupListener = async () => {
      unlistenStrafe = await listen("strafe", (event) => {
        const strafe = {
          type: event.payload.strafe_type,
          duration: event.payload.duration,
        };

        switch (strafe.type) {
          case "Early":
            setEarlyStrafes((prev) => [strafe.duration, ...prev]);
            break;
          case "Late":
            setLateStrafes((prev) => [strafe.duration, ...prev]);
            break;
          case "Perfect":
            setPerfectStrafes((prev) => [strafe.duration, ...prev]);
            break;
        }
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
    <div class="w-screen h-screen bg-bright text-dark flex flex-col">
      <div className="flex justify-center items-center select-none pointer-events-none">
        <h1 className="mr-3 drop-shadow-lg py-4 text-4xl pointer-events-none font-bold text-center text-bright text-stroke italic">
          PatrikZero's
        </h1>
        <h1 className="py-4 text-4xl font-bold text-center pointer-events-none">
          Strafe Evaluation
        </h1>
      </div>

      <div className="justify-between flex-grow flex">
        <div className="flex flex-col rounded-xl border-t border-white m-4 p-4 w-[50%] bg-secondary/50 shadow-xl">
          <div className="flex justify-between mb-2">
            <h2 className="select-none text-2xl font-bold">Statistics</h2>
            <button
              className="text-bright select-none shadow-md px-2 rounded-md bg-primary hover:scale-110 cursor-pointer"
              type="button"
              onClick={resetStrafes}
            >
              Reset
            </button>
          </div>
          <StatsTable
            earlyStrafes={earlyStrafes()}
            lateStrafes={lateStrafes()}
            perfectStrafes={perfectStrafes()}
          />
        </div>

        <div className="flex flex-col m-4 justify-center rounded-xl w-[50%]">
          <StrafeChart
            earlyStrafes={earlyStrafes()}
            lateStrafes={lateStrafes()}
            perfectStrafes={perfectStrafes()}
          />
        </div>
      </div>

      <div className="h-32 mb-4 flex items-center justify-center">
        <KeyVisualizer />
      </div>

      <StrafeHistoryBar strafes={totalStrafes()} />
    </div>
  );
}
