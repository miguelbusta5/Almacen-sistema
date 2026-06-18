"use client";

import { useEffect, useState, useCallback } from "react";
import type { StudioComponent, AggregatedRow, RawRow } from "@/types/studio";
import { StudioKPI } from "./StudioKPI";
import { StudioTabla } from "./StudioTabla";
import { StudioBarChart } from "./StudioBarChart";
import { StudioTexto } from "./StudioTexto";

interface Props {
  component: StudioComponent;
  isSelected?: boolean;
  onSelect?: () => void;
  readOnly?: boolean;
}

export function ComponentRenderer({ component, isSelected, onSelect, readOnly }: Props) {
  const [aggregated, setAggregated] = useState<AggregatedRow[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { config, estilo, tipo } = component;

  const fetchData = useCallback(async () => {
    if (!config.fuenteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/datos/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fuenteId: config.fuenteId, config }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al cargar datos");
        return;
      }
      const d = await res.json();
      if (d.aggregated) setAggregated(d.aggregated);
      if (d.rows) setRawRows(d.rows);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (tipo !== "texto" && tipo !== "separador" && tipo !== "imagen") {
      fetchData();
    }
  }, [fetchData, tipo]);

  const borderStyle = isSelected
    ? "2px solid var(--brand)"
    : "1px solid var(--border)";

  function renderContent() {
    if (loading) {
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>
          Cargando…
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--error)", fontSize: 12, padding: 12 }}>
          {error}
        </div>
      );
    }

    switch (tipo) {
      case "kpi":
        return <StudioKPI data={aggregated} estilo={estilo} metrica={config.metrica} agregacion={config.agregacion} />;
      case "tabla":
        return <StudioTabla rawData={rawRows} aggregated={aggregated.length > 0 ? aggregated : undefined} columnas={config.columnas} estilo={estilo} />;
      case "barra":
        return <StudioBarChart data={aggregated} estilo={estilo} />;
      case "texto":
        return <StudioTexto estilo={estilo} contenido={config.contenido} />;
      case "separador":
        return <div style={{ height: "100%", display: "flex", alignItems: "center" }}><div style={{ width: "100%", height: 1, background: "var(--border)" }} /></div>;
      case "imagen":
        return config.urlImagen ? (
          <img src={config.urlImagen} alt={estilo.titulo ?? "imagen"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>
            Sin imagen
          </div>
        );
      default:
        return (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 11 }}>
            {tipo}
          </div>
        );
    }
  }

  return (
    <div
      onClick={!readOnly ? onSelect : undefined}
      style={{
        height: "100%",
        border: borderStyle,
        borderRadius: 10,
        background: "var(--surface)",
        overflow: "hidden",
        cursor: readOnly ? "default" : "pointer",
        boxShadow: isSelected ? "0 0 0 3px var(--brand-tint)" : "var(--shadow-sm)",
        transition: "border-color .14s, box-shadow .14s",
        position: "relative",
      }}
    >
      {!readOnly && (
        <div
          className="drag-handle"
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 16,
            height: 16,
            cursor: "grab",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10,
            opacity: 0.35,
          }}
        >
          <div style={{ width: 10, height: 1.5, background: "var(--muted)", borderRadius: 1 }} />
          <div style={{ width: 10, height: 1.5, background: "var(--muted)", borderRadius: 1 }} />
          <div style={{ width: 10, height: 1.5, background: "var(--muted)", borderRadius: 1 }} />
        </div>
      )}
      {renderContent()}
    </div>
  );
}
