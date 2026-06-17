"use client";

import type { ComponentStyle, AggregatedRow } from "@/types/studio";

interface Props {
  data: AggregatedRow[];
  estilo: ComponentStyle;
  metrica?: string;
  agregacion?: string;
}

function formatValue(v: number, formato?: string): string {
  if (isNaN(v)) return "—";
  switch (formato) {
    case "moneda":
      return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
    case "porcentaje":
      return `${v.toFixed(1)}%`;
    case "decimal":
      return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    default:
      return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
  }
}

export function StudioKPI({ data, estilo, metrica, agregacion }: Props) {
  const total = data.reduce((acc, r) => acc + r.valor, 0);
  const count = data.length;
  const displayValue =
    agregacion === "count"
      ? count
      : agregacion === "avg" && count > 0
      ? total / count
      : total;

  const titulo = estilo.titulo ?? metrica ?? "KPI";
  const color = estilo.color ?? "var(--brand)";

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "16px 20px",
        background: estilo.colorFondo ?? "var(--surface)",
        borderRadius: estilo.bordeRadius ?? 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {titulo}
      </div>
      <div
        style={{
          fontSize: estilo.tamanoTexto ?? 36,
          fontWeight: 800,
          color,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        {formatValue(displayValue, estilo.formatoNumero)}
      </div>
      {estilo.subtitulo && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{estilo.subtitulo}</div>
      )}
    </div>
  );
}
