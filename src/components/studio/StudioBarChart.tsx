"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import type { ComponentStyle, AggregatedRow } from "@/types/studio";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  data: AggregatedRow[];
  estilo: ComponentStyle;
}

export function StudioBarChart({ data, estilo }: Props) {
  const titulo = estilo.titulo;
  const color = estilo.color ?? "#1D4ED8";

  if (data.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
        Sin datos
      </div>
    );
  }

  const chartData = {
    labels: data.map((r) => r.dimension),
    datasets: [
      {
        label: estilo.subtitulo ?? "Valor",
        data: data.map((r) => r.valor),
        backgroundColor: color + "CC",
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: estilo.mostrarLeyenda ?? false },
      title: {
        display: !!titulo,
        text: titulo ?? "",
        font: { size: 12, weight: "bold" as const },
        color: "var(--foreground)",
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, color: "#64748B" },
        grid: { display: false },
      },
      y: {
        ticks: { font: { size: 10 }, color: "#64748B" },
        grid: { color: "#F1F5F9" },
      },
    },
  };

  return (
    <div style={{ height: "100%", padding: "8px 12px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
