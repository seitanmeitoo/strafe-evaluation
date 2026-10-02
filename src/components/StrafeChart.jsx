import { createSignal, createEffect, onMount } from "solid-js";
import { Chart, registerables } from "chart.js";
import { Bar } from "solid-chartjs";
import { getOccurance } from "../utils/stats";

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

      // X bins are every 5ms: 0, 5, 10, ...
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

      // Label badge
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
        "#10b981",
        `Early ≤ ${pluginOptions.earlyTarget}ms`
      );
    }

    if (pluginOptions.lateTarget != null && pluginOptions.lateTarget > 0) {
      drawLine(
        pluginOptions.lateTarget,
        "#f59e0b",
        `Late ≤ ${pluginOptions.lateTarget}ms`
      );
    }
  },
};

export default function StrafeChart(props) {
  const labels = Array.from({ length: 201 / 5 + 1 }, (_, i) => i * 5);

  const [chartData, setChartData] = createSignal({
    labels,
    datasets: [
      {
        label: "Early",
        data: getOccurance([]),
        backgroundColor: "#a5c5ae",
      },
      {
        label: "Late",
        data: [0],
        borderRadius: 5,
        backgroundColor: "#8cb5a8",
      },
    ],
  });

  onMount(() => {
    Chart.register(...registerables);
  });

  createEffect(() => {
    const early = props.earlyStrafes || [];
    const late = props.lateStrafes || [];
    const perfect = props.perfectStrafes || [];

    setChartData({
      labels,
      datasets: [
        {
          label: "Early",
          data: getOccurance(early),
          borderRadius: 5,
          backgroundColor: "#a5c5ae",
        },
        {
          label: "Late",
          data: getOccurance(late),
          borderRadius: 5,
          backgroundColor: "#8cb5a8",
        },
        {
          label: "Perfect",
          data: [perfect.length],
          borderRadius: 5,
          backgroundColor: "#b5ac8c",
        },
      ],
    });
  });

  const chartOptions = () => ({
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
      },
    },
    plugins: {
      thresholdLines: {
        enabled: Boolean(props.visualGoals?.enabled),
        earlyTarget: props.visualGoals?.earlyTargetMs ?? 15,
        lateTarget: props.visualGoals?.lateTargetMs ?? 20,
      },
    },
  });

  return (
    <div>
      <Bar
        data={chartData()}
        options={chartOptions()}
        plugins={[thresholdLinesPlugin]}
        width={4}
        height={3}
      />
    </div>
  );
}
