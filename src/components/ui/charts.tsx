"use client";

import { useEffect, useState } from "react";
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
import type { ChartOptions, TooltipItem } from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler
);

// ── Paleta CEDI ──────────────────────────────────────────────────────────────
// Ordenada de más antiguo → más reciente (índice 0 = año más viejo)
export const CEDI_YEAR_COLORS = ["#5C636A", "#34D9F0", "#14DBA0", "#5BF5C7"];
const FONT = "'Inter',-apple-system,system-ui,sans-serif";

function cFont(size = 11) {
  return { family: FONT, size } as const;
}

// Resuelve un token CSS a string en runtime (Chart.js requiere strings de color).
// En SSR / primer paint usa el fallback (valor oscuro), idéntico al tema por
// defecto; en cliente lee el token vigente (oscuro o claro).
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Fuerza re-render de los charts cuando cambia `data-theme` en <html>, para
// re-resolver los colores tomados de tokens CSS.
function useThemeTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setTick((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
}

function baseTooltip() {
  return {
    backgroundColor: cssVar("--chart-tooltip-bg", "#161A1F"),
    titleColor: cssVar("--chart-tooltip-title", "#ECEFF1"),
    bodyColor: cssVar("--chart-tooltip-body", "#C2C8CE"),
    borderColor: cssVar("--chart-tooltip-border", "rgba(255,255,255,0.10)"),
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
    titleFont: cFont(12),
    bodyFont: cFont(11),
  } as const;
}

function baseLegend() {
  return {
    position: "top" as const,
    align: "end" as const,
    labels: { color: cssVar("--chart-axis", "#8B9398"), font: cFont(11), boxWidth: 10, boxHeight: 8, padding: 16 },
  };
}

function baseScalesXY() {
  const grid = cssVar("--chart-grid", "rgba(255,255,255,0.07)");
  const axis = cssVar("--chart-axis", "#8B9398");
  return {
    x: { grid: { color: grid, lineWidth: 1 }, ticks: { color: axis, font: cFont(11) }, border: { display: false } },
    y: { grid: { color: grid, lineWidth: 1 }, ticks: { color: axis, font: cFont(11), maxTicksLimit: 6 }, border: { display: false } },
  };
}

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
  useThemeTick();
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
    scales: baseScalesXY(),
    plugins: {
      legend: baseLegend(),
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          label: (ctx: TooltipItem<"bar">) =>
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
  useThemeTick();
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
    scales: baseScalesXY() as ChartOptions<"line">["scales"],
    plugins: {
      legend: baseLegend(),
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          label: (ctx: TooltipItem<"line">) =>
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
  useThemeTick();
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
        labels: { color: cssVar("--chart-axis", "#8B9398"), font: cFont(11), boxWidth: 10, boxHeight: 8, padding: 12 },
      },
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          label: (ctx: TooltipItem<"doughnut">) => {
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
  color = "#14DBA0",
}: {
  items: HBarItem[];
  label?: string;
  color?: string;
}) {
  useThemeTick();
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
        grid: { color: cssVar("--chart-grid", "rgba(255,255,255,0.07)") },
        ticks: { color: cssVar("--chart-axis", "#8B9398"), font: cFont(10), maxTicksLimit: 5 },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: { color: cssVar("--chart-axis", "#8B9398"), font: cFont(11) },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          label: (ctx: TooltipItem<"bar">) =>
            ` ${Number(ctx.parsed.x ?? 0).toLocaleString("es-CO")}`,
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}
