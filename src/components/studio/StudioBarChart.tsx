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
      title: { display: false },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, color: "#8A8A8E" },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        ticks: { font: { size: 10 }, color: "#8A8A8E" },
        grid: { color: "rgba(0,0,0,0.06)" },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "10px 12px" }}>
      {titulo && (
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
          {titulo}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
