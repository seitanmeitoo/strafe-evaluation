import { For } from "solid-js";
import { draw_time } from "../utils/stats";
import { calculateSpeedAtShot } from "../utils/cs2Physics";

export default function StrafeHistoryBar(props) {
  const strafes = () => props.strafes || props.totalStrafes || [];

  return (
    <div className="flex flex-row p-2 bg-accent/25 h-24 overflow-x-auto overflow-y-hidden w-full items-center">
      <For each={strafes()}>
        {(strafe) => {
          const evalResult = calculateSpeedAtShot(strafe);
          const hasShot = strafe.shot_delay != null;
          const shotMs = hasShot ? Math.round(strafe.shot_delay / 1000) : null;
          const isRightToLeft = strafe.direction === "RightToLeft";

          return (
            <div className="flex shadow-md select-none flex-col border-bright/75 border-t bg-secondary/60 rounded-md justify-between items-center min-w-24 max-w-28 p-1.5 mr-2 h-20 text-xs shrink-0">
              {/* Header: Direction + Diagonal indicator */}
              <div className="flex justify-between items-center w-full px-0.5 text-[10px] text-dark/80 font-semibold">
                <span className="font-bold text-dark">
                  {isRightToLeft ? "D ➔ A" : "A ➔ D"}
                </span>
                {strafe.is_diagonal && (
                  <span className="bg-primary/30 text-dark px-1 rounded text-[9px] font-bold">
                    DIAG
                  </span>
                )}
              </div>

              {/* Main timing info */}
              <div className="text-center my-0.5">
                <p className="font-bold text-dark text-xs">{strafe.type}</p>
                <p className="text-dark/90 font-mono text-[11px]">
                  {draw_time(strafe.duration)}
                </p>
              </div>

              {/* CS2 Shot Accuracy Footer */}
              <div className="w-full text-center">
                {hasShot && evalResult ? (
                  <div
                    className={`rounded px-1 py-0.5 text-[10px] font-bold truncate ${
                      evalResult.isAccurate
                        ? "bg-primary text-white"
                        : "bg-rose-600/80 text-white"
                    }`}
                    title={`Délai: ${shotMs}ms | Vitesse résiduelle: ${evalResult.residualSpeed} u/s`}
                  >
                    🎯 {shotMs}ms ({evalResult.residualSpeed}u/s)
                  </div>
                ) : (
                  <span className="text-[10px] text-dark/40 italic">
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
