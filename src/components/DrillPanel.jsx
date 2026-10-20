import { Match, Show, Switch } from "solid-js";
import { t } from "../i18n";

/** "1:05" from seconds. */
function clock(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Drill block of the overlay. props.view = { mode, status, progress, result } (from the main window),
 * props.leftKey / props.rightKey = configured key labels.
 */
export default function DrillPanel(props) {
  const v = () => props.view;
  const p = () => v().progress || {};
  const side = (dir) =>
    dir === "LeftToRight" ? `${props.leftKey} → ${props.rightKey}` : `${props.rightKey} → ${props.leftKey}`;

  const phaseText = (phase) => {
    if (!phase) return "";
    const parts = [phase.direction === "any" ? t("drills.bothSides") : side(phase.direction)];
    if (phase.diagonal === "only") parts.push(t("drills.withDiagonal"));
    if (phase.diagonal === "none") parts.push(t("drills.withoutDiagonal"));
    if (phase.requireShot) parts.push(t("drills.withShot"));
    return parts.join(", ");
  };

  const Big = (q) => <span className="text-[22px] font-extrabold leading-none">{q.children}</span>;
  const Small = (q) => <span className="block text-[11px] text-muted leading-tight text-right">{q.children}</span>;

  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold">{t(`drills.mode_${v().mode}`)}</span>
        <Show when={v().status === "running" && (v().mode === "streak" || v().mode === "warmup")}>
          <span className="text-muted">{t("drills.strafes", { count: p().counted || 0 })}</span>
        </Show>
      </div>

      <Switch>
        <Match when={v().status === "idle"}>
          <p className="text-[12px] text-muted mt-1">{t("drills.idleHint")}</p>
        </Match>

        <Match when={v().status === "finished" && v().result}>
          <div className="flex items-baseline justify-between mt-0.5">
            <Big>{t("drills.score", { score: v().result.score })}</Big>
            <Show when={v().result.recordsBeaten?.length > 0}>
              <span className="text-[11px] font-semibold text-accent">{t("drills.newRecord")}</span>
            </Show>
          </div>
          <p className="text-[11px] text-muted">
            {t("drills.resultLine", {
              count: v().result.count,
              rate: Math.round(v().result.perfectRate),
              median: Math.round(v().result.medianMs),
            })}
          </p>
        </Match>

        <Match when={v().mode === "timed"}>
          <div className="flex items-center justify-between mt-0.5">
            <Big>{clock(p().remainingSec)}</Big>
            <div>
              <Small>{t("drills.strafes", { count: p().counted || 0 })}</Small>
              <Small>{t("drills.perfectRate", { rate: p().perfectRate || 0 })}</Small>
            </div>
          </div>
        </Match>

        <Match when={v().mode === "focus"}>
          <div className="flex items-center justify-between mt-0.5">
            <Big>
              {p().counted || 0} / {p().target}
            </Big>
            <div>
              <Small>{t("drills.sideOnly", { side: side(p().direction) })}</Small>
              <Small>{t("drills.perfectRate", { rate: p().perfectRate || 0 })}</Small>
            </div>
          </div>
        </Match>

        <Match when={v().mode === "streak"}>
          <div className="flex items-center justify-between mt-0.5">
            <Big>{p().streak || 0}</Big>
            <div>
              <Show when={p().targetReached} fallback={<Small>{t("drills.target", { target: p().target })}</Small>}>
                <span className="block text-[11px] font-semibold text-accent text-right">{t("drills.targetReached")}</span>
              </Show>
              <Small>{t("drills.best", { best: p().bestStreak || 0 })}</Small>
            </div>
          </div>
        </Match>

        <Match when={v().mode === "warmup"}>
          <div className="flex items-baseline justify-between mt-0.5 text-[12px]">
            <span className="font-semibold">
              {t("drills.phase", { index: (p().phaseIndex || 0) + 1, count: p().phaseCount })}
            </span>
            <span className="text-muted">
              {p().phaseDone || 0} / {p().phase?.count}
            </span>
          </div>
          <p className="text-[11px] text-muted truncate">{phaseText(p().phase)}</p>
          <div className="mt-1 h-1 rounded bg-line overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${Math.round((p().overall || 0) * 100)}%` }} />
          </div>
        </Match>
      </Switch>
    </div>
  );
}
