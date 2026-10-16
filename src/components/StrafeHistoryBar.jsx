import { For, Show, createMemo, createSignal, onMount, onCleanup } from "solid-js";
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

  // Vertical mouse wheel scrolls the strip horizontally (there is no visible scrollbar).
  const onWheel = (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.currentTarget.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  return (
    <div
      className="no-scrollbar h-[76px] shrink-0 flex items-center gap-1.5 px-5 bg-panel overflow-x-auto overflow-y-hidden"
      onWheel={onWheel}
    >
      <Show
        when={strafes().length > 0}
        fallback={<p className="text-[13px] text-muted">{t("history.empty")}</p>}
      >
        <For each={strafes()}>
          {(strafe) => {
            const evalResult = calculateSpeedAtShot(strafe);
            const hasShot = strafe.shot_delay != null;
            const shotMs = hasShot ? Math.round(strafe.shot_delay / 1000) : null;
            const isRightToLeft = strafe.direction === "RightToLeft";

            return (
              <div
                className="shrink-0 w-[112px] h-[58px] whitespace-nowrap rounded-md bg-card px-2 py-1 flex flex-col justify-between text-[12px] leading-tight select-none"
                title={
                  hasShot && evalResult
                    ? `${t(evalResult.isAccurate ? "history.shotAccurate" : "history.shotInaccurate")} ${t("history.delay")}: ${shotMs} ms, ${t("history.residualSpeed")}: ${evalResult.residualSpeed} u/s`
                    : t("history.withoutShot")
                }
              >
                <div className="flex justify-between text-[11px] text-muted">
                  <span>
                    {isRightToLeft ? `${rightKey()} → ${leftKey()}` : `${leftKey()} → ${rightKey()}`}
                  </span>
                  <Show when={strafe.is_diagonal}>
                    <span>{t("history.diagonal")}</span>
                  </Show>
                </div>
                <div className="font-bold" style={{ color: getColor(strafe.type) }}>
                  {getSymbol(strafe.type)} {strafe.type} {draw_time(strafe.duration)}
                </div>
                <div className={`text-[11px] ${hasShot && evalResult?.isAccurate ? "text-accent font-semibold" : "text-muted"}`}>
                  {hasShot && evalResult ? t("history.shot", { ms: shotMs }) : t("history.withoutShot")}
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
