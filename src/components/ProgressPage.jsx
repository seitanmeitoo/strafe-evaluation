import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Chart, registerables } from "chart.js";
import { Line } from "solid-chartjs";
import { loadSessions } from "../utils/sessions";
import { progressSeries, sessionRecords, sessionsInRange } from "../utils/progress";
import { currentRank } from "../utils/ranks";
import { loadRecords } from "../utils/drillHistory";
import { t } from "../i18n";

const CHART_FONT = '"Hanken Grotesk Variable", system-ui, sans-serif';
const CHART_THEME = {
  light: { text: "#56684b", grid: "rgba(47, 58, 44, 0.08)", line: "#6e8a5c" },
  dark: { text: "#a3b19a", grid: "rgba(227, 233, 222, 0.08)", line: "#8fae7b" },
};

const RANGES = [
  { id: "7", days: 7, label: "progress.range7" },
  { id: "30", days: 30, label: "progress.range30" },
  { id: "90", days: 90, label: "progress.range90" },
  { id: "all", days: null, label: "progress.rangeAll" },
];

const METRICS = [
  { id: "perfectRate", label: "progress.metricPerfect", unit: "%" },
  { id: "medianMs", label: "progress.metricMedian", unit: " ms" },
  { id: "accurateRate", label: "progress.metricAccuracy", unit: "%" },
];

const tabBtn = (active) =>
  `cursor-pointer select-none transition-colors ${
    active ? "text-ink font-semibold underline underline-offset-4" : "text-muted hover:text-ink"
  }`;

function formatDay(time) {
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Long-term progress: rank, personal bests and a chart of saved sessions. */
export default function ProgressPage(props) {
  const [sessions, setSessions] = createSignal([]);
  const [range, setRange] = createSignal("30");
  const [metric, setMetric] = createSignal("perfectRate");
  const [drillRecords, setDrillRecords] = createSignal(loadRecords());

  onMount(() => {
    Chart.register(...registerables);
    setSessions(loadSessions());
    setDrillRecords(loadRecords());
  });

  const rank = createMemo(() => currentRank(sessions(), props.ranks));
  const records = createMemo(() => sessionRecords(sessions()));
  const series = createMemo(() =>
    progressSeries(sessionsInRange(sessions(), RANGES.find((r) => r.id === range()).days))
  );
  const metricInfo = () => METRICS.find((m) => m.id === metric());
  const hasPoints = () => series().points.some((p) => p[metric()] != null);

  const chartData = createMemo(() => {
    const theme = props.theme === "dark" ? CHART_THEME.dark : CHART_THEME.light;
    const points = series().points;
    return {
      labels: points.map((p) =>
        series().unit === "week" ? t("progress.weekOf", { day: formatDay(p.time) }) : formatDay(p.time)
      ),
      datasets: [
        {
          label: t(metricInfo().label),
          data: points.map((p) => p[metric()]),
          borderColor: theme.line,
          backgroundColor: theme.line,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.25,
          spanGaps: true,
        },
      ],
    };
  });

  const chartOptions = createMemo(() => {
    const theme = props.theme === "dark" ? CHART_THEME.dark : CHART_THEME.light;
    const axis = {
      grid: { color: theme.grid },
      border: { display: false },
      ticks: { color: theme.text, font: { family: CHART_FONT, size: 11 } },
    };
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, precision: 0 } },
      },
    };
  });

  const Best = (p) => (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-muted">{p.label}</span>
      <span className="font-semibold">{p.value}</span>
    </div>
  );

  return (
    <main className="flex-1 min-h-0 px-5 pb-5 flex gap-3">
      {/* Left: rank and personal bests */}
      <section className="w-[300px] shrink-0 bg-panel rounded-xl px-4 py-3 flex flex-col min-h-0 overflow-y-auto no-scrollbar text-[13px]">
        <h2 className="text-base font-bold mb-1">{t("progress.rankTitle")}</h2>
        <Show when={rank()} fallback={<p className="text-muted">{t("progress.rankEmpty")}</p>}>
          <p className="text-[22px] font-extrabold leading-tight">{rank().name}</p>
          <p className="text-[12px] text-muted">
            {t("progress.rankScore", { score: rank().score, count: rank().sessions })}
          </p>
          <Show when={rank().next}>
            <div className="mt-2 h-1 rounded bg-line overflow-hidden">
              <div
                className="h-full bg-accent"
                style={{
                  width: `${Math.round(
                    Math.max(0, Math.min(1, rank().score / Math.max(1, rank().next.min))) * 100
                  )}%`,
                }}
              />
            </div>
            <p className="text-[12px] text-muted mt-1">
              {t("progress.rankNext", { name: rank().next.name, min: rank().next.min })}
            </p>
          </Show>
        </Show>

        <h2 className="text-base font-bold mt-4 mb-1 pt-3 border-t border-line">{t("progress.bestsTitle")}</h2>
        <Best
          label={t("progress.bestPerfect")}
          value={records().bestPerfect ? `${Math.round(records().bestPerfect.value)}%` : "–"}
        />
        <Best
          label={t("progress.bestMedian")}
          value={records().bestMedian ? `${Math.round(records().bestMedian.value)} ms` : "–"}
        />
        <Best
          label={t("progress.bestAccuracy")}
          value={records().bestAccuracy ? `${Math.round(records().bestAccuracy.value)}%` : "–"}
        />
        <Best label={t("progress.bestStreak")} value={drillRecords().bestStreak || "–"} />
        <Best label={t("progress.bestDrillScore")} value={drillRecords().bestDrillScore || "–"} />
        <p className="text-[11px] text-muted mt-1">{t("progress.bestsHint")}</p>

        {props.children}
      </section>

      {/* Right: chart */}
      <section className="flex-1 min-w-0 bg-card border border-line rounded-xl p-3 flex flex-col">
        <div className="flex items-baseline justify-between mb-1">
          <div className="flex gap-3 text-[12px]">
            <For each={METRICS}>
              {(m) => (
                <button type="button" className={tabBtn(metric() === m.id)} onClick={() => setMetric(m.id)}>
                  {t(m.label)}
                </button>
              )}
            </For>
          </div>
          <div className="flex gap-3 text-[12px]">
            <For each={RANGES}>
              {(r) => (
                <button type="button" className={tabBtn(range() === r.id)} onClick={() => setRange(r.id)}>
                  {t(r.label)}
                </button>
              )}
            </For>
          </div>
        </div>
        <p className="text-[11px] text-muted mb-2">
          {series().unit === "week" ? t("progress.perWeek") : t("progress.perDay")}
        </p>

        <div className="relative flex-1 min-h-0">
          <Show
            when={hasPoints()}
            fallback={
              <div className="h-full flex items-center justify-center">
                <p className="max-w-xs text-center text-muted text-[13px]">{t("pages.progressEmpty")}</p>
              </div>
            }
          >
            <Line data={chartData()} options={chartOptions()} />
          </Show>
        </div>
      </section>
    </main>
  );
}
