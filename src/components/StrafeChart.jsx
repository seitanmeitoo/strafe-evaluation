import { createSignal, createEffect, onMount } from "solid-js";
import { Chart, registerables } from "chart.js";
import { Bar, Line } from "solid-chartjs";
import { getOccurance } from "../utils/stats";
import { getStrafeColors, STRAFE_SYMBOLS } from "../utils/settings";
import { t } from "../i18n";

const CHART_FONT = '"Hanken Grotesk Variable", system-ui, sans-serif';

// Theme colors for chart chrome; they mirror the CSS tokens in App.css.
const CHART_THEME = {
  light: { text: "#56684b", legend: "#2f3a2c", grid: "rgba(47, 58, 44, 0.08)" },
  dark: { text: "#a3b19a", legend: "#e3e9de", grid: "rgba(227, 233, 222, 0.08)" },
};

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

    const drawLine = (targetMs, color, labelText, align, row) => {
      if (targetMs == null || isNaN(targetMs) || targetMs < 0) return;
      if (pluginOptions.maxStrafeMs != null && targetMs > pluginOptions.maxStrafeMs) return;

      // Category scale: bar i covers [i*5, i*5+5) ms; interpolate between bar centers.
      const binIndex = targetMs / 5;
      const xPos = x.getPixelForValue(binIndex);

      if (xPos == null || isNaN(xPos)) return;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = color;
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = `600 10px ${CHART_FONT}`;
      ctx.fillStyle = color;
      // Prefer the requested side, but flip it when the label would leave the chart area.
      const width = ctx.measureText(labelText).width;
      let side = align;
      if (side === "right" && xPos - 4 - width < chart.chartArea.left) side = "left";
      if (side === "left" && xPos + 4 + width > chart.chartArea.right) side = "right";
      ctx.textAlign = side;
      ctx.textBaseline = "bottom";
      ctx.fillText(labelText, side === "right" ? xPos - 4 : xPos + 4, top - 2 - row * 12);

      ctx.restore();
    };

    if (pluginOptions.earlyTarget != null && pluginOptions.earlyTarget > 0) {
      drawLine(
        pluginOptions.earlyTarget,
        pluginOptions.earlyColor,
        `${STRAFE_SYMBOLS.early} Early ≤ ${pluginOptions.earlyTarget} ms`,
        "right",
        1
      );
    }

    if (pluginOptions.lateTarget != null && pluginOptions.lateTarget > 0) {
      drawLine(
        pluginOptions.lateTarget,
        pluginOptions.lateColor,
        `${STRAFE_SYMBOLS.late} Late ≤ ${pluginOptions.lateTarget} ms`,
        "left",
        0
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
        borderRadius: 2,
        backgroundColor: colors().early,
      },
      {
        label: `${STRAFE_SYMBOLS.late} Late`,
        data: [0],
        borderRadius: 2,
        backgroundColor: colors().late,
      },
      {
        label: `${STRAFE_SYMBOLS.perfect} Perfect`,
        data: [0],
        borderRadius: 2,
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
          borderRadius: 2,
          backgroundColor: currentColors.early,
        },
        {
          label: `${STRAFE_SYMBOLS.late} ${t("table.late")}`,
          data: getOccurance(late, currentMaxMs),
          borderRadius: 2,
          backgroundColor: currentColors.late,
        },
        {
          label: `${STRAFE_SYMBOLS.perfect} ${t("table.perfect")} (0ms)`,
          data: [perfect.length],
          borderRadius: 2,
          backgroundColor: currentColors.perfect,
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
          borderRadius: 2,
          maxBarThickness: 16,
        },
      ],
    });
  });

  const isDark = () => props.theme === "dark";
  const chartTheme = () => (isDark() ? CHART_THEME.dark : CHART_THEME.light);

  const baseOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 150 },
    font: { family: CHART_FONT },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: chartTheme().legend,
          boxWidth: 10,
          boxHeight: 10,
          font: { family: CHART_FONT, size: 12 },
        },
      },
    },
  });

  const axis = (extra = {}) => ({
    grid: { color: chartTheme().grid },
    border: { display: false },
    ticks: { color: chartTheme().text, font: { family: CHART_FONT, size: 11 } },
    ...extra,
  });

  const distOptions = () => ({
    ...baseOptions(),
    layout: { padding: { top: props.visualGoals?.enabled ? 26 : 4 } },
    scales: {
      x: axis({
        stacked: true,
        grid: { display: false },
        ticks: {
          color: chartTheme().text,
          font: { family: CHART_FONT, size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 11,
        },
      }),
      y: axis({
        stacked: true,
        beginAtZero: true,
        ticks: {
          color: chartTheme().text,
          font: { family: CHART_FONT, size: 11 },
          precision: 0,
        },
      }),
    },
    plugins: {
      ...baseOptions().plugins,
      tooltip: {
        callbacks: {
          afterBody(context) {
            const hasPerfect = context.some((item) => item.datasetIndex === 2);
            if (hasPerfect) {
              return t("chart.perfectNote");
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
    ...baseOptions(),
    scales: {
      x: axis({ grid: { display: false } }),
      y: axis({ beginAtZero: true, ticks: { color: chartTheme().text, font: { family: CHART_FONT, size: 11 }, precision: 0 } }),
    },
  });

  const tabBtn = (active) =>
    `cursor-pointer select-none transition-colors ${
      active ? "text-ink font-semibold underline underline-offset-4" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-base font-bold">
          {viewMode() === "distribution" ? t("chart.distributionTitle") : t("chart.trendTitle")}
        </h2>
        <div className="flex gap-3 text-[12px]">
          <button type="button" className={tabBtn(viewMode() === "distribution")} onClick={() => setViewMode("distribution")}>
            {t("chart.distributionTab")}
          </button>
          <button type="button" className={tabBtn(viewMode() === "trend")} onClick={() => setViewMode("trend")}>
            {t("chart.trendTab")}
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        {viewMode() === "distribution" ? (
          <Bar data={distData()} options={distOptions()} plugins={[thresholdLinesPlugin]} />
        ) : (
          <Line data={trendData()} options={trendOptions()} />
        )}
      </div>
    </div>
  );
}
