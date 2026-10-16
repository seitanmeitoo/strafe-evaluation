import { For, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { draw_time } from "../utils/stats";
import { calculateSpeedAtShot } from "../utils/cs2Physics";
import { getStrafeColors, STRAFE_SYMBOLS, loadSettings, formatKeyDisplay } from "../utils/settings";
import { t } from "../i18n";

export default function StrafeHistoryBar(props) {
  const strafes = createMemo(() => {
    const list = props.strafes || props.totalStrafes || [];
    return list.slice(0, 100);
  });
  const colors = createMemo(() => getStrafeColors(props.colorblindMode));

  const [currentKeys, setCurrentKeys] = createSignal(loadSettings().keys || { left: "A", right: "D" });

  onMount(() => {
    let unlisten;
    listen("settings-changed", (e) => {
      if (e.payload?.keys) {
        setCurrentKeys(e.payload.keys);
      }
    }).then((fn) => { unlisten = fn; });

    onCleanup(() => {
      if (typeof unlisten === "function") unlisten();
    });
  });

  const getColor = (type) => {
    const c = colors();
    if (type === "Perfect") return c.perfect;
    if (type === "Early") return c.early;
    return c.late;
  };

  const getSymbol = (type) => {
    if (type === "Perfect") return STRAFE_SYMBOLS.perfect;
    if (type === "Early") return STRAFE_SYMBOLS.early;
    return STRAFE_SYMBOLS.late;
  };

  const leftKey = () => formatKeyDisplay(props.keys?.left || currentKeys().left || "A");
  const rightKey = () => formatKeyDisplay(props.keys?.right || currentKeys().right || "D");

  return (
    <div className="flex flex-row p-2 bg-slate-900/60 dark:bg-slate-900/90 h-24 overflow-x-auto overflow-y-hidden w-full items-center border-t border-slate-700/40">
      <For each={strafes()}>
        {(strafe) => {
          const evalResult = calculateSpeedAtShot(strafe);
          const hasShot = strafe.shot_delay != null;
          const shotMs = hasShot ? Math.round(strafe.shot_delay / 1000) : null;
          const isRightToLeft = strafe.direction === "RightToLeft";

          return (
            <div
              className="flex shadow-md select-none flex-col border bg-slate-800/90 rounded-lg justify-between items-center min-w-24 max-w-28 p-1.5 mr-2 h-20 text-xs shrink-0"
              style={{
                "border-color": `${getColor(strafe.type)}66`,
              }}
            >
              {/* Header: Direction + Diagonal indicator */}
              <div className="flex justify-between items-center w-full px-0.5 text-[10px] text-slate-300 font-semibold">
                <span className="font-bold">
                  {isRightToLeft ? `${rightKey()} ➔ ${leftKey()}` : `${leftKey()} ➔ ${rightKey()}`}
                </span>
                {strafe.is_diagonal && (
                  <span className="bg-sky-500/20 text-sky-300 px-1 rounded text-[9px] font-bold">
                    DIAG
                  </span>
                )}
              </div>

              {/* Main timing info with distinctive shape symbol */}
              <div className="text-center my-0.5">
                <p
                  className="font-bold text-xs flex items-center justify-center gap-1"
                  style={{ color: getColor(strafe.type) }}
                >
                  <span>{getSymbol(strafe.type)}</span>
                  <span>{strafe.type}</span>
                </p>
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
                    title={`${t("history.delay")}: ${shotMs}ms | ${t("history.residualSpeed")}: ${evalResult.residualSpeed} u/s`}
                  >
                    🎯 {shotMs}ms ({evalResult.residualSpeed}u/s)
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 italic">
                    {t("history.withoutShot")}
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
