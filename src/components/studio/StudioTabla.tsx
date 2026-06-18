"use client";

import { useState } from "react";
import type { ComponentStyle, RawRow, AggregatedRow } from "@/types/studio";

interface Props {
  rawData?: RawRow[];
  aggregated?: AggregatedRow[];
  columnas?: string[];
  estilo: ComponentStyle;
}

export function StudioTabla({ rawData, aggregated, columnas, estilo }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;

  const titulo = estilo.titulo;

  // Construir filas y cols unificadas
  let cols: string[] = [];
  let rows: Record<string, string | number>[] = [];

  if (aggregated && aggregated.length > 0) {
    cols = ["Dimensión", "Valor"];
    rows = aggregated.map((r) => ({ Dimensión: r.dimension, Valor: r.valor }));
  } else if (rawData && rawData.length > 0) {
    cols = columnas?.length ? columnas : Object.keys(rawData[0]);
    rows = rawData.map((r) => {
      const obj: Record<string, string | number> = {};
      for (const c of cols) obj[c] = r[c] ?? "";
      return obj;
    });
  }

  // Sort
  if (sortCol) {
    rows = [...rows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const an = typeof av === "number" ? av : parseFloat(String(av));
      const bn = typeof bv === "number" ? bv : parseFloat(String(bv));
      if (!isNaN(an) && !isNaN(bn)) return sortDir === "asc" ? an - bn : bn - an;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }

  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const pageRows = rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  }

  if (cols.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
        Sin datos
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {titulo && (
        <div style={{ padding: "10px 14px 4px", fontSize: 12, fontWeight: 700, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {titulo}
        </div>
      )}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table className="g-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="sortable"
                  onClick={() => handleSort(c)}
                  style={{ position: "sticky", top: 0, zIndex: 1 }}
                >
                  {c} {sortCol === c ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c} style={{ height: 38 }}>
                    {String(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px", borderTop: "1px solid var(--border)" }}>
          <button
            className="g-btn g-btn-ghost g-btn-sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ‹
          </button>
          <span style={{ color: "var(--muted)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="g-btn g-btn-ghost g-btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
