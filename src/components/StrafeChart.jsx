import { createSignal, createEffect, onMount } from "solid-js";
import { Chart, registerables } from "chart.js";
import { Bar, Line } from "solid-chartjs";
import { getOccurance } from "../utils/stats";
import { getStrafeColors, STRAFE_SYMBOLS } from "../utils/settings";
import { t } from "../i18n";

const thresholdLinesPlugin = {
  id: "thresholdLines",
  afterDatasetsDraw(chart, args, pluginOptions) {
    if (!pluginOptions || !pluginOptions.enabled) return;

    const {
      ctx,
      chartArea: { top, bottom },
      scales: { x },
    } = chart;
    if (!x) return;

    const drawLine = (targetMs, color, labelText) => {
      if (targetMs == null || isNaN(targetMs) || targetMs < 0) return;
      if (pluginOptions.maxStrafeMs != null && targetMs > pluginOptions.maxStrafeMs) return;

      const binIndex = targetMs / 5;
      const baseIndex = Math.floor(binIndex);
      const frac = binIndex - baseIndex;

      let xPos;
      if (typeof x.getPixelForTick === "function" && x.ticks && x.ticks.length > 0) {
        const i1 = Math.min(Math.max(baseIndex, 0), x.ticks.length - 1);
        const i2 = Math.min(Math.max(baseIndex + 1, 0), x.ticks.length - 1);
        const p1 = x.getPixelForTick(i1);
        const p2 = x.getPixelForTick(i2);
        xPos = p1 + (p2 - p1) * frac;
      } else if (typeof x.getPixelForValue === "function") {
        xPos = x.getPixelForValue(binIndex);
      }

      if (xPos == null || isNaN(xPos)) return;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(labelText, xPos, top - 2);

      ctx.restore();
    };

    if (pluginOptions.earlyTarget != null && pluginOptions.earlyTarget > 0) {
      drawLine(
        pluginOptions.earlyTarget,
        pluginOptions.earlyColor || "#38bdf8",
        `${STRAFE_SYMBOLS.early} Early ≤ ${pluginOptions.earlyTarget}ms`
      );
    }

    if (pluginOptions.lateTarget != null && pluginOptions.lateTarget > 0) {
      drawLine(
        pluginOptions.lateTarget,
        pluginOptions.lateColor || "#fb923c",
        `${STRAFE_SYMBOLS.late} Late ≤ ${pluginOptions.lateTarget}ms`
      );
    }
  },
};

export default function StrafeChart(props) {
  const [viewMode, setViewMode] = createSignal("distribution"); // "distribution" | "trend"
  const maxMs = () => Math.max(50, Math.min(500, props.maxStrafeMs || 250));
  const labels = () => Array.from({ length: Math.floor(maxMs() / 5) + 1 }, (_, i) => i * 5);
  const colors = () => getStrafeColors(props.colorblindMode);

  const [distData, setDistData] = createSignal({
    labels: labels(),
    datasets: [
      {
        label: `${STRAFE_SYMBOLS.early} Early`,
        data: getOccurance([], maxMs()),
        borderRadius: 4,
        backgroundColor: colors().early,
      },
      {
        label: `${STRAFE_SYMBOLS.late} Late`,
        data: [0],
        borderRadius: 4,
        backgroundColor: colors().late,
      },
      {
        label: `${STRAFE_SYMBOLS.perfect} Perfect`,
        data: [0],
        borderRadius: 4,
        backgroundColor: colors().perfect,
      },
    ],
  });

  const [trendData, setTrendData] = createSignal({
    labels: [],
    datasets: [],
  });

  onMount(() => {
    Chart.register(...registerables);
  });

  // Update distribution histogram data
  createEffect(() => {
    const early = props.earlyStrafes || [];
    const late = props.lateStrafes || [];
    const perfect = props.perfectStrafes || [];
    const currentColors = colors();
    const currentMaxMs = maxMs();
    const currentLabels = labels();

    setDistData({
      labels: currentLabels,
      datasets: [
        {
          label: `${STRAFE_SYMBOLS.early} ${t("table.early")}`,
          data: getOccurance(early, currentMaxMs),
          borderRadius: 4,
          backgroundColor: currentColors.early,
        },
        {
          label: `${STRAFE_SYMBOLS.late} ${t("table.late")}`,
          data: getOccurance(late, currentMaxMs),
          borderRadius: 4,
          backgroundColor: currentColors.late,
        },
        {
          label: `${STRAFE_SYMBOLS.perfect} ${t("table.perfect")} (0ms)`,
          data: [perfect.length],
          borderRadius: 4,
          backgroundColor: currentColors.perfect,
          borderWidth: 1,
          borderColor: "#ffffff",
        },
      ],
    });
  });

  // Update rolling average trend data (last 20 strafes)
  createEffect(() => {
    const allStrafes = props.strafes || [];
    const recent = [...allStrafes].slice(0, 20).reverse(); // oldest to newest among last 20
    const currentColors = colors();

    const trendLabels = recent.map((_, i) => `#${i + 1}`);
    const durationsMs = recent.map((s) => Math.round(s.duration / 1000));
    const pointColors = recent.map((s) => {
      if (s.type === "Perfect") return currentColors.perfect;
      if (s.type === "Early") return currentColors.early;
      return currentColors.late;
    });

    // Compute simple moving average (window of 5)
    const movingAvg = durationsMs.map((_, idx, arr) => {
      const windowStart = Math.max(0, idx - 4);
      const sub = arr.slice(windowStart, idx + 1);
      const sum = sub.reduce((a, b) => a + b, 0);
      return Math.round(sum / sub.length);
    });

    setTrendData({
      labels: trendLabels,
      datasets: [
        {
          type: "line",
          label: t("chart.rollingAvgLabel"),
          data: movingAvg,
          borderColor: currentColors.early,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
        },
        {
          type: "bar",
          label: t("chart.singleDurationLabel"),
          data: durationsMs,
          backgroundColor: pointColors,
          borderRadius: 4,
          maxBarThickness: 16,
        },
      ],
    });
  });

  const isDark = () => props.theme !== "light";

  const distOptions = () => ({
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        stacked: true,
        grid: { color: isDark() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        ticks: { color: isDark() ? "#94a3b8" : "#475569" },
      },
      y: {
        stacked: true,
        grid: { color: isDark() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        ticks: { color: isDark() ? "#94a3b8" : "#475569" },
      },
    },
    plugins: {
      legend: {
        labels: { color: isDark() ? "#cbd5e1" : "#334155" },
      },
      tooltip: {
        callbacks: {
          afterBody(context) {
            const hasPerfect = context.some((item) => item.datasetIndex === 2);
            if (hasPerfect) {
              return "Note: Perfect = 0 ms";
            }
            return "";
          },
        },
      },
      thresholdLines: {
        enabled: Boolean(props.visualGoals?.enabled),
        earlyTarget: props.visualGoals?.earlyTargetMs ?? 15,
        earlyColor: colors().early,
        lateTarget: props.visualGoals?.lateTargetMs ?? 20,
        lateColor: colors().late,
        maxStrafeMs: maxMs(),
      },
    },
  });

  const trendOptions = () => ({
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        grid: { color: isDark() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        ticks: { color: isDark() ? "#94a3b8" : "#475569" },
      },
      y: {
        beginAtZero: true,
        grid: { color: isDark() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        ticks: { color: isDark() ? "#94a3b8" : "#475569" },
      },
    },
    plugins: {
      legend: {
        labels: { color: isDark() ? "#cbd5e1" : "#334155" },
      },
    },
  });

  return (
    <div className="w-full flex flex-col h-full justify-between">
      {/* Mode Switcher */}
      <div className="flex justify-between items-center mb-1 px-1">
        <span className="text-xs font-semibold text-slate-400">
          {viewMode() === "distribution"
            ? t("chart.distributionTitle")
            : t("chart.trendTitle")}
        </span>
        <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg text-[11px] font-semibold">
          <button
            type="button"
            className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
              viewMode() === "distribution"
                ? "bg-slate-700 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setViewMode("distribution")}
          >
            {t("chart.distributionTab")}
          </button>
          <button
            type="button"
            className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
              viewMode() === "trend"
                ? "bg-slate-700 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setViewMode("trend")}
          >
            {t("chart.trendTab")}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-grow flex items-center justify-center">
        {viewMode() === "distribution" ? (
          <Bar
            data={distData()}
            options={distOptions()}
            plugins={[thresholdLinesPlugin]}
            width={4}
            height={3}
          />
        ) : (
          <Line data={trendData()} options={trendOptions()} width={4} height={3} />
        )}
      </div>
    </div>
  );
}
