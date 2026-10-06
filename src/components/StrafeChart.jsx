import { createSignal, createEffect, onMount } from "solid-js";
import { Chart, registerables } from "chart.js";
import { Bar, Line } from "solid-chartjs";
import { getOccurance } from "../utils/stats";
import { STRAFE_COLORS } from "../utils/settings";

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
        STRAFE_COLORS.early,
        `Early ≤ ${pluginOptions.earlyTarget}ms`
      );
    }

    if (pluginOptions.lateTarget != null && pluginOptions.lateTarget > 0) {
      drawLine(
        pluginOptions.lateTarget,
        STRAFE_COLORS.late,
        `Late ≤ ${pluginOptions.lateTarget}ms`
      );
    }
  },
};

export default function StrafeChart(props) {
  const [viewMode, setViewMode] = createSignal("distribution"); // "distribution" | "trend"
  const labels = Array.from({ length: 201 / 5 + 1 }, (_, i) => i * 5);

  const [distData, setDistData] = createSignal({
    labels,
    datasets: [
      {
        label: "Early",
        data: getOccurance([]),
        borderRadius: 4,
        backgroundColor: STRAFE_COLORS.early,
      },
      {
        label: "Late",
        data: [0],
        borderRadius: 4,
        backgroundColor: STRAFE_COLORS.late,
      },
      {
        label: "Perfect",
        data: [0],
        borderRadius: 4,
        backgroundColor: STRAFE_COLORS.perfect,
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

    setDistData({
      labels,
      datasets: [
        {
          label: "Early",
          data: getOccurance(early),
          borderRadius: 4,
          backgroundColor: STRAFE_COLORS.early,
        },
        {
          label: "Late",
          data: getOccurance(late),
          borderRadius: 4,
          backgroundColor: STRAFE_COLORS.late,
        },
        {
          label: "Perfect (0ms)",
          data: [perfect.length],
          borderRadius: 4,
          backgroundColor: STRAFE_COLORS.perfect,
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

    const trendLabels = recent.map((_, i) => `#${i + 1}`);
    const durationsMs = recent.map((s) => Math.round(s.duration / 1000));
    const pointColors = recent.map((s) => {
      if (s.type === "Perfect") return STRAFE_COLORS.perfect;
      if (s.type === "Early") return STRAFE_COLORS.early;
      return STRAFE_COLORS.late;
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
          label: "Moyenne Glissante",
          data: movingAvg,
          borderColor: "#38bdf8",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
        },
        {
          type: "bar",
          label: "Durée Strafe (ms)",
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
      thresholdLines: {
        enabled: Boolean(props.visualGoals?.enabled),
        earlyTarget: props.visualGoals?.earlyTargetMs ?? 15,
        lateTarget: props.visualGoals?.lateTargetMs ?? 20,
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
        grid: { color: isDark() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        ticks: { color: isDark() ? "#94a3b8" : "#475569" },
        title: {
          display: true,
          text: "Durée (ms)",
          color: isDark() ? "#94a3b8" : "#475569",
        },
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
            ? "Histogramme des Fréquences"
            : "Tendance & Moyenne Glissante (20 derniers)"}
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
            📊 Histogramme
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
            📈 Moyenne Glissante
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
