import { For } from "solid-js";
import { draw_time } from "../utils/stats";
import { calculateSpeedAtShot } from "../utils/cs2Physics";

export default function StrafeHistoryBar(props) {
  const strafes = () => props.strafes || props.totalStrafes || [];

  return (
    <div className="flex flex-row p-2 bg-slate-900/60 dark:bg-slate-900/90 h-24 overflow-x-auto overflow-y-hidden w-full items-center border-t border-slate-700/40">
      <For each={strafes()}>
        {(strafe) => {
          const evalResult = calculateSpeedAtShot(strafe);
          const hasShot = strafe.shot_delay != null;
          const shotMs = hasShot ? Math.round(strafe.shot_delay / 1000) : null;
          const isRightToLeft = strafe.direction === "RightToLeft";

          const typeColor =
            strafe.type === "Perfect"
              ? "text-emerald-400 border-emerald-500/40"
              : strafe.type === "Early"
              ? "text-sky-400 border-sky-500/40"
              : "text-amber-400 border-amber-500/40";

          return (
            <div className={`flex shadow-md select-none flex-col border bg-slate-800/90 rounded-lg justify-between items-center min-w-24 max-w-28 p-1.5 mr-2 h-20 text-xs shrink-0 ${typeColor}`}>
              {/* Header: Direction + Diagonal indicator */}
              <div className="flex justify-between items-center w-full px-0.5 text-[10px] text-slate-300 font-semibold">
                <span className="font-bold">
                  {isRightToLeft ? "D ➔ A" : "A ➔ D"}
                </span>
                {strafe.is_diagonal && (
                  <span className="bg-sky-500/20 text-sky-300 px-1 rounded text-[9px] font-bold">
                    DIAG
                  </span>
                )}
              </div>

              {/* Main timing info */}
              <div className="text-center my-0.5">
                <p className="font-bold text-xs">{strafe.type}</p>
                <p className="text-slate-300 font-mono text-[11px]">
                  {draw_time(strafe.duration)}
                </p>
              </div>

              {/* CS2 Shot Accuracy Footer */}
              <div className="w-full text-center">
                {hasShot && evalResult ? (
                  <div
                    className={`rounded px-1 py-0.5 text-[10px] font-bold truncate ${
                      evalResult.isAccurate
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                    title={`Délai: ${shotMs}ms | Vitesse résiduelle: ${evalResult.residualSpeed} u/s`}
                  >
                    🎯 {shotMs}ms ({evalResult.residualSpeed}u/s)
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 italic">
                    sans tir
                  </span>
                )}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
