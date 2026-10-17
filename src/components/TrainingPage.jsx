import { createSignal, createEffect, For, Index, Show, Switch, Match } from "solid-js";
import { DEFAULT_DRILL_CONFIG, DRILL_MODES } from "../utils/drills";
import { formatKeyDisplay } from "../utils/settings";
import { loadDrillHistory, clearDrillHistory, loadRecords } from "../utils/drillHistory";
import DrillPanel from "./DrillPanel";
import { t } from "../i18n";
import { CloseIcon } from "./Icons";

export default function TrainingPage(props) {
  const [history, setHistory] = createSignal(loadDrillHistory());
  const [records, setRecords] = createSignal(loadRecords());

  const isRunning = () => props.drills.drill()?.status === "running";

  createEffect(() => {
    if (props.drills.drill()?.status === "finished") {
      setHistory(loadDrillHistory());
      setRecords(loadRecords());
    }
  });

  const leftLabel = () => formatKeyDisplay(props.keys?.left || "A");
  const rightLabel = () => formatKeyDisplay(props.keys?.right || "D");

  function handleClearHistory() {
    if (confirm(t("training.clearConfirm"))) {
      clearDrillHistory();
      setHistory([]);
    }
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      // Compact form for the narrow history table: "Oct 17 15:14".
      const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${day} ${time}`;
    } catch {
      return iso;
    }
  }

  function saveDefaultMode(checked) {
    const defaultMode = checked ? props.drills.mode() : "normal";
    props.onSaveDrills({ ...props.drillSettings, defaultMode });
  }

  function updateTimed(patch) {
    props.onSaveDrills({
      ...props.drillSettings,
      timed: { ...(props.drillSettings?.timed || DEFAULT_DRILL_CONFIG.timed), ...patch },
    });
  }

  function updateFocus(patch) {
    props.onSaveDrills({
      ...props.drillSettings,
      focus: { ...(props.drillSettings?.focus || DEFAULT_DRILL_CONFIG.focus), ...patch },
    });
  }

  function updateStreak(patch) {
    props.onSaveDrills({
      ...props.drillSettings,
      streak: { ...(props.drillSettings?.streak || DEFAULT_DRILL_CONFIG.streak), ...patch },
    });
  }

  const warmupPhases = () =>
    props.drillSettings?.warmup?.phases || DEFAULT_DRILL_CONFIG.warmup.phases;

  function updateWarmupPhase(index, patch) {
    const next = warmupPhases().map((p, i) => (i === index ? { ...p, ...patch } : p));
    props.onSaveDrills({
      ...props.drillSettings,
      warmup: { ...(props.drillSettings?.warmup || DEFAULT_DRILL_CONFIG.warmup), phases: next },
    });
  }

  function addWarmupPhase() {
    if (warmupPhases().length >= 8) return;
    const newPhase = { direction: "any", count: 20, diagonal: "any", requireShot: false };
    const next = [...warmupPhases(), newPhase];
    props.onSaveDrills({
      ...props.drillSettings,
      warmup: { ...(props.drillSettings?.warmup || DEFAULT_DRILL_CONFIG.warmup), phases: next },
    });
  }

  function removeWarmupPhase(index) {
    if (warmupPhases().length <= 1) return;
    const next = warmupPhases().filter((_, i) => i !== index);
    props.onSaveDrills({
      ...props.drillSettings,
      warmup: { ...(props.drillSettings?.warmup || DEFAULT_DRILL_CONFIG.warmup), phases: next },
    });
  }

  function resetWarmupPhases() {
    const defaultPhases = JSON.parse(JSON.stringify(DEFAULT_DRILL_CONFIG.warmup.phases));
    props.onSaveDrills({
      ...props.drillSettings,
      warmup: { ...(props.drillSettings?.warmup || DEFAULT_DRILL_CONFIG.warmup), phases: defaultPhases },
    });
  }

  const choiceBtn = (active) =>
    `h-7 px-2.5 rounded-md border bg-card text-[12px] font-medium transition-colors cursor-pointer select-none ${
      active
        ? "!border-accent text-ink font-semibold"
        : "border-line text-muted hover:border-muted hover:text-ink"
    }`;

  const filterBtn = (active, disabled) =>
    `select-none transition-colors ${
      disabled
        ? "opacity-50 cursor-not-allowed text-muted"
        : `cursor-pointer ${
            active
              ? "text-ink font-semibold underline underline-offset-4"
              : "text-muted hover:text-ink"
          }`
    }`;

  const keycap = "rounded-md bg-key border-b-2 border-key-edge px-2 py-0.5 text-[12px] font-bold";
  const selectCls =
    "h-7 bg-card border border-line rounded-md px-1 text-[11px] text-ink focus:outline-none focus:border-accent cursor-pointer";
  const numInputCls =
    "w-12 h-7 bg-card border border-line rounded-md px-1 text-right text-[11px] font-semibold text-ink focus:outline-none focus:border-accent";

  return (
    <main className="flex-1 min-h-0 px-5 pb-5 flex gap-3">
      {/* Left column: mode choice + configuration */}
      <section className="w-[380px] shrink-0 bg-panel rounded-xl p-4 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
        <div className="space-y-4">
          {/* 1. Mode selector */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <For each={DRILL_MODES}>
              {(mode) => (
                <button
                  type="button"
                  className={filterBtn(props.drills.mode() === mode, isRunning())}
                  disabled={isRunning()}
                  onClick={() => props.drills.selectMode(mode)}
                  title={t(`drills.mode_${mode}`)}
                >
                  {t(`training.modeShort_${mode}`)}
                </button>
              )}
            </For>
          </div>

          {/* 2. Start at launch checkbox (hidden in Free play) */}
          <Show when={props.drills.mode() !== "normal"}>
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <input
                id="start-at-launch"
                type="checkbox"
                className="accent-[rgb(var(--color-accent))] cursor-pointer"
                checked={props.drillSettings?.defaultMode === props.drills.mode()}
                onChange={(e) => saveDefaultMode(e.target.checked)}
              />
              <label htmlFor="start-at-launch" className="cursor-pointer hover:text-ink select-none">
                {t("training.startAtLaunch")}
              </label>
            </div>
          </Show>

          {/* 3. Configuration of the selected mode */}
          <Switch>
            {/* Free play */}
            <Match when={props.drills.mode() === "normal"}>
              <div className="py-2">
                <p className="text-[12px] text-muted">{t("training.freePlayHint")}</p>
              </div>
            </Match>

            {/* Timed */}
            <Match when={props.drills.mode() === "timed"}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[12px] font-medium text-muted">{t("training.duration")}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <For
                      each={[
                        { sec: 30, label: "timed30s" },
                        { sec: 60, label: "timed60s" },
                        { sec: 120, label: "timed2min" },
                        { sec: 300, label: "timed5min" },
                      ]}
                    >
                      {(item) => (
                        <button
                          type="button"
                          className={choiceBtn(
                            (props.drillSettings?.timed?.durationSec ?? 60) === item.sec
                          )}
                          onClick={() => updateTimed({ durationSec: item.sec })}
                        >
                          {t(`training.${item.label}`)}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-muted hover:text-ink select-none">
                  <input
                    type="checkbox"
                    className="accent-[rgb(var(--color-accent))] cursor-pointer"
                    checked={props.drillSettings?.timed?.requireShot ?? false}
                    onChange={(e) => updateTimed({ requireShot: e.target.checked })}
                  />
                  <span>{t("training.shotsOnly")}</span>
                </label>
              </div>
            </Match>

            {/* Focus */}
            <Match when={props.drills.mode() === "focus"}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[12px] font-medium text-muted">{t("training.side")}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={choiceBtn(
                        (props.drillSettings?.focus?.direction || "RightToLeft") === "LeftToRight"
                      )}
                      onClick={() => updateFocus({ direction: "LeftToRight" })}
                    >
                      {`${leftLabel()} → ${rightLabel()}`}
                    </button>
                    <button
                      type="button"
                      className={choiceBtn(
                        (props.drillSettings?.focus?.direction || "RightToLeft") === "RightToLeft"
                      )}
                      onClick={() => updateFocus({ direction: "RightToLeft" })}
                    >
                      {`${rightLabel()} → ${leftLabel()}`}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[12px] font-medium text-muted">{t("training.target")}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <For each={[20, 50, 100]}>
                      {(count) => (
                        <button
                          type="button"
                          className={choiceBtn(
                            (props.drillSettings?.focus?.target ?? 50) === count
                          )}
                          onClick={() => updateFocus({ target: count })}
                        >
                          {t("training.targetStrafes", { count })}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-muted hover:text-ink select-none">
                    <input
                      type="checkbox"
                      className="accent-[rgb(var(--color-accent))] cursor-pointer"
                      checked={props.drillSettings?.focus?.allowDiagonal ?? true}
                      onChange={(e) => updateFocus({ allowDiagonal: e.target.checked })}
                    />
                    <span>{t("training.includeDiagonals")}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-muted hover:text-ink select-none">
                    <input
                      type="checkbox"
                      className="accent-[rgb(var(--color-accent))] cursor-pointer"
                      checked={props.drillSettings?.focus?.requireShot ?? false}
                      onChange={(e) => updateFocus({ requireShot: e.target.checked })}
                    />
                    <span>{t("training.shotsOnly")}</span>
                  </label>
                </div>
              </div>
            </Match>

            {/* Streak */}
            <Match when={props.drills.mode() === "streak"}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[12px] font-medium text-muted">{t("training.target")}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <For each={[5, 10, 20, 50]}>
                      {(count) => (
                        <button
                          type="button"
                          className={choiceBtn(
                            (props.drillSettings?.streak?.target ?? 10) === count
                          )}
                          onClick={() => updateStreak({ target: count })}
                        >
                          {t("training.streakTarget", { count })}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-muted hover:text-ink select-none">
                  <input
                    type="checkbox"
                    className="accent-[rgb(var(--color-accent))] cursor-pointer"
                    checked={props.drillSettings?.streak?.requireShot ?? false}
                    onChange={(e) => updateStreak({ requireShot: e.target.checked })}
                  />
                  <span>{t("training.shotsOnly")}</span>
                </label>
              </div>
            </Match>

            {/* Warm-up */}
            <Match when={props.drills.mode() === "warmup"}>
              <div className="space-y-2">
                <Index each={warmupPhases()}>
                  {(phase, index) => (
                    <div className="flex items-center gap-1.5 py-0.5 text-[12px]">
                      <span className="text-[11px] font-semibold text-muted w-4 shrink-0">
                        #{index + 1}
                      </span>
                      <select
                        className={selectCls}
                        value={phase().direction}
                        onChange={(e) => updateWarmupPhase(index, { direction: e.target.value })}
                      >
                        <option value="any">{t("training.directionBoth")}</option>
                        <option value="LeftToRight">{`${leftLabel()} → ${rightLabel()}`}</option>
                        <option value="RightToLeft">{`${rightLabel()} → ${leftLabel()}`}</option>
                      </select>

                      <input
                        type="number"
                        min="5"
                        max="200"
                        className={numInputCls}
                        value={phase().count}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (raw === "") {
                            e.target.value = phase().count;
                            return;
                          }
                          const num = Number(raw);
                          if (isNaN(num)) {
                            e.target.value = phase().count;
                            return;
                          }
                          const clamped = Math.max(5, Math.min(200, Math.round(num)));
                          updateWarmupPhase(index, { count: clamped });
                          e.target.value = clamped;
                        }}
                      />

                      <select
                        className={selectCls}
                        value={phase().diagonal}
                        onChange={(e) => updateWarmupPhase(index, { diagonal: e.target.value })}
                      >
                        <option value="any">{t("training.diagonalAny")}</option>
                        <option value="only">{t("training.diagonalOnly")}</option>
                        <option value="none">{t("training.diagonalNone")}</option>
                      </select>

                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-muted hover:text-ink shrink-0 select-none">
                        <input
                          type="checkbox"
                          className="accent-[rgb(var(--color-accent))] cursor-pointer"
                          checked={phase().requireShot}
                          onChange={(e) =>
                            updateWarmupPhase(index, { requireShot: e.target.checked })
                          }
                        />
                        <span>{t("training.shot")}</span>
                      </label>

                      <Show when={warmupPhases().length > 1}>
                        <button
                          type="button"
                          className="h-6 w-6 shrink-0 ml-auto flex items-center justify-center rounded text-muted hover:text-ink hover:bg-card cursor-pointer"
                          onClick={() => removeWarmupPhase(index)}
                          title={t("training.removePhase")}
                          aria-label={t("training.removePhase")}
                        >
                          <CloseIcon size={11} />
                        </button>
                      </Show>
                    </div>
                  )}
                </Index>

                <div className="flex items-center gap-4 pt-1.5">
                  <Show when={warmupPhases().length < 8}>
                    <button
                      type="button"
                      className="text-[12px] text-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                      onClick={addWarmupPhase}
                    >
                      {t("training.addPhase")}
                    </button>
                  </Show>
                  <button
                    type="button"
                    className="text-[12px] text-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                    onClick={resetWarmupPhases}
                  >
                    {t("training.resetWarmup")}
                  </button>
                </div>
              </div>
            </Match>
          </Switch>
        </div>

        {/* 4. Start / Stop button */}
        <div className="mt-auto pt-4 shrink-0">
          <button
            type="button"
            className="w-full h-8 px-4 rounded-md bg-accent text-accent-ink text-[13px] font-semibold hover:opacity-90 transition-opacity cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={props.drills.mode() === "normal"}
            onClick={() => {
              if (isRunning()) {
                props.drills.stop();
              } else {
                props.drills.start();
              }
            }}
          >
            {isRunning() ? t("training.stopDrill") : t("training.startDrill")}
          </button>
        </div>
      </section>

      {/* Right column: current drill, shortcuts, records, history */}
      <section className="flex-1 min-w-0 bg-card border border-line rounded-xl p-4 flex flex-col min-h-0 overflow-hidden">
        {/* 1. Current drill (hidden in Free play) */}
        <div className="shrink-0 pb-3 border-b border-line">
          <Show
            when={props.drills.mode() !== "normal"}
            fallback={
              <div className="py-1">
                <p className="text-[11px] font-semibold">{t("drills.mode_normal")}</p>
                <p className="text-[12px] text-muted mt-1">{t("training.freePlayShortcut")}</p>
              </div>
            }
          >
            <DrillPanel
              view={props.drills.snapshot()}
              leftKey={leftLabel()}
              rightKey={rightLabel()}
            />
          </Show>
        </div>

        {/* 2. Shortcuts */}
        <div className="shrink-0 py-2.5 border-b border-line space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="font-medium">{t("training.shortcutsTitle")}</span>
            <span className="text-[11px]">{t("training.shortcutsNotice")}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-muted">{t("training.shortcutCycle")}</span>
              <span className={keycap}>Ctrl + F12</span>
            </div>
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-muted">{t("training.shortcutToggle")}</span>
              <span className={keycap}>Ctrl + F10</span>
            </div>
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-muted">{t("training.shortcutReset")}</span>
              <span className={keycap}>Ctrl + F9</span>
            </div>
          </div>
        </div>

        {/* 3. Records */}
        <div className="shrink-0 py-2.5 border-b border-line">
          <div className="text-[11px] text-muted mb-1.5 font-medium">
            {t("training.recordsTitle")}
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <span className="block text-[11px] text-muted">{t("training.bestStreak")}</span>
              <span className="text-[16px] font-bold">{records().bestStreak}</span>
            </div>
            <div>
              <span className="block text-[11px] text-muted">{t("training.bestScore")}</span>
              <span className="text-[16px] font-bold">{records().bestDrillScore}</span>
            </div>
          </div>
        </div>

        {/* 4. History */}
        <div className="flex-1 min-h-0 flex flex-col pt-2.5">
          <div className="flex items-baseline justify-between mb-1.5 shrink-0">
            <span className="text-[11px] text-muted font-medium">
              {t("training.historyTitle")}
            </span>
            <Show when={history().length > 0}>
              <button
                type="button"
                className="text-[11px] text-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                onClick={handleClearHistory}
              >
                {t("training.clearHistory")}
              </button>
            </Show>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            <Show
              when={history().length > 0}
              fallback={
                <p className="text-[12px] text-muted py-6 text-center">
                  {t("training.historyEmpty")}
                </p>
              }
            >
              <table className="w-full text-[11px] text-right">
                <thead className="sticky top-0 bg-card text-muted border-b border-line">
                  <tr>
                    <th className="text-left font-normal py-1 pr-1 whitespace-nowrap">{t("training.tableDate")}</th>
                    <th className="text-left font-normal px-1 whitespace-nowrap">{t("training.tableMode")}</th>
                    <th className="font-normal px-1 whitespace-nowrap">{t("training.tableStrafes")}</th>
                    <th className="font-normal px-1 whitespace-nowrap">{t("training.tablePerfect")}</th>
                    <th className="font-normal px-1 whitespace-nowrap">{t("training.tableMedian")}</th>
                    <th className="font-normal pl-1 whitespace-nowrap">{t("training.tableScore")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={history()}>
                    {(h) => (
                      <tr className="border-b border-line/40 last:border-b-0">
                        <td className="text-left py-1 pr-1 text-muted whitespace-nowrap">
                          {formatDate(h.startedAt)}
                        </td>
                        <td className="text-left px-1 font-medium whitespace-nowrap">
                          {t(`training.modeShort_${h.mode}`)}
                        </td>
                        <td className="px-1 whitespace-nowrap">{h.count ?? 0}</td>
                        <td className="px-1 whitespace-nowrap">{Math.round(h.perfectRate ?? 0)}%</td>
                        <td className="px-1 whitespace-nowrap">{Math.round(h.medianMs ?? 0)} ms</td>
                        <td className="pl-1 font-semibold whitespace-nowrap">{h.score ?? 0}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>
        </div>
      </section>
    </main>
  );
}
