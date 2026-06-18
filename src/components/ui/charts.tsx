"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler
);

// ── Paleta CEDI ──────────────────────────────────────────────────────────────
// Ordenada de más antiguo → más reciente (índice 0 = año más viejo)
export const CEDI_YEAR_COLORS = ["#94A3B8", "#60A5FA", "#1D4ED8", "#1E3A8A"];
const GRID = "rgba(0,0,0,0.06)";
const TIP_BG = "#0f172a";
const FONT = "-apple-system,'Helvetica Neue',system-ui,sans-serif";

function cFont(size = 11) {
  return { family: FONT, size } as const;
}

const BASE_TOOLTIP = {
  backgroundColor: TIP_BG,
  titleColor: "#f8fafc",
  bodyColor: "#cbd5e1",
  borderWidth: 0,
  cornerRadius: 8,
  padding: 10,
  titleFont: cFont(12),
  bodyFont: cFont(11),
} as const;

const BASE_LEGEND = {
  position: "top" as const,
  align: "end" as const,
  labels: { color: "#64748b", font: cFont(11), boxWidth: 10, boxHeight: 8, padding: 16 },
};

const BASE_SCALES_XY = {
  x: {
    grid: { color: GRID, lineWidth: 1 },
    ticks: { color: "#94A3B8", font: cFont(11) },
    border: { display: false },
  },
  y: {
    grid: { color: GRID, lineWidth: 1 },
    ticks: { color: "#94A3B8", font: cFont(11), maxTicksLimit: 6 },
    border: { display: false },
  },
};

// ── ChartCard ────────────────────────────────────────────────────────────────

export function ChartCard({
  title,
  hint,
  height = 240,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  height?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="cedi-panel" style={{ gap: 12 }}>
      <div className="cedi-panel-head" style={{ paddingBottom: 0 }}>
        <div>
          <h2 style={{ fontSize: 13 }}>{title}</h2>
          {hint && <p style={{ fontSize: 11, marginTop: 2 }}>{hint}</p>}
        </div>
        {actions}
      </div>
      <div style={{ height, position: "relative" }}>{children}</div>
    </section>
  );
}

// ── BarGroupedChart ──────────────────────────────────────────────────────────

export interface BarDataset {
  label: string;
  data: number[];
}

export function BarGroupedChart({
  labels,
  datasets,
}: {
  labels: string[];
  datasets: BarDataset[];
}) {
  const isEmpty = !datasets.length || datasets.every((d) => d.data.every((v) => v === 0));
  if (isEmpty)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted2)", fontSize: 13 }}>
        Sin datos
      </div>
    );

  const chartData = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: CEDI_YEAR_COLORS[i % CEDI_YEAR_COLORS.length],
      borderRadius: 4,
      borderSkipped: false as const,
      barPercentage: 0.82,
      categoryPercentage: 0.72,
    })),
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    scales: BASE_SCALES_XY,
    plugins: {
      legend: BASE_LEGEND,
      tooltip: {
        ...BASE_TOOLTIP,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            ` ${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toLocaleString("es-CO")}`,
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

// ── LineTrendChart ───────────────────────────────────────────────────────────

export function LineTrendChart({
  labels,
  datasets,
}: {
  labels: string[];
  datasets: BarDataset[];
}) {
  const isEmpty = !datasets.length || datasets.every((d) => d.data.every((v) => v === 0));
  if (isEmpty)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted2)", fontSize: 13 }}>
        Sin datos
      </div>
    );

  const chartData = {
    labels,
    datasets: datasets.map((ds, i) => {
      const color = CEDI_YEAR_COLORS[i % CEDI_YEAR_COLORS.length];
      return {
        label: ds.label,
        data: ds.data,
        borderColor: color,
        backgroundColor: color + "18",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: i === datasets.length - 1 ? ("origin" as const) : false,
        tension: 0.35,
      };
    }),
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    scales: BASE_SCALES_XY as ChartOptions<"line">["scales"],
    plugins: {
      legend: BASE_LEGEND,
      tooltip: {
        ...BASE_TOOLTIP,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            ` ${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toLocaleString("es-CO")}`,
        },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}

// ── DonutChart ───────────────────────────────────────────────────────────────

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const hasData = segments.some((s) => s.value > 0);

  const chartData = {
    labels: segments.map((s) => s.label),
    datasets: [
      {
        data: segments.map((s) => s.value),
        backgroundColor: segments.map(
          (s, i) => s.color ?? CEDI_YEAR_COLORS[CEDI_YEAR_COLORS.length - 1 - (i % CEDI_YEAR_COLORS.length)]
        ),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    animation: { duration: 600 },
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#64748b", font: cFont(11), boxWidth: 10, boxHeight: 8, padding: 12 },
      },
      tooltip: {
        ...BASE_TOOLTIP,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const v = Number(ctx.parsed ?? 0);
            const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
            return ` ${ctx.label}: ${v.toLocaleString("es-CO")} (${pct}%)`;
          },
        },
      },
    },
  };

  if (!hasData)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", border: "6px solid var(--border)" }} />
        <span style={{ color: "var(--muted2)", fontSize: 12 }}>Sin datos</span>
      </div>
    );

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <Doughnut data={chartData} options={options} />
      {centerValue !== undefined && (
        <div
          style={{
            position: "absolute",
            top: "38%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {typeof centerValue === "number" ? centerValue.toLocaleString("es-CO") : centerValue}
          </div>
          {centerLabel && (
            <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 2 }}>{centerLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── HBarChart — horizontal bars para Top N ───────────────────────────────────

export interface HBarItem {
  label: string;
  value: number;
}

export function HBarChart({
  items,
  label = "Valor",
  color = "#1D4ED8",
}: {
  items: HBarItem[];
  label?: string;
  color?: string;
}) {
  if (!items.length)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted2)", fontSize: 13 }}>
        Sin datos
      </div>
    );

  const chartData = {
    labels: items.map((i) => i.label),
    datasets: [
      {
        label,
        data: items.map((i) => i.value),
        backgroundColor: color,
        borderRadius: 4,
        borderSkipped: false as const,
        barPercentage: 0.85,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    scales: {
      x: {
        grid: { color: GRID },
        ticks: { color: "#94A3B8", font: cFont(10), maxTicksLimit: 5 },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: { color: "#475569", font: cFont(11) },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...BASE_TOOLTIP,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            ` ${Number(ctx.parsed.x ?? 0).toLocaleString("es-CO")}`,
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}
