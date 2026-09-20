import { createSignal, createEffect, onMount } from "solid-js";
import { Chart, registerables } from "chart.js";
import { Bar } from "solid-chartjs";
import { getOccurance } from "../utils/stats";

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

  const chartOptions = {
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
  };

  return (
    <div>
      <Bar data={chartData()} options={chartOptions} width={4} height={3} />
    </div>
  );
}
