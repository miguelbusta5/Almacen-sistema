"use client";

import dynamic from "next/dynamic";
import { ModuleHero } from "@/components/ui";
import type { CiudadMapaDTO } from "@/app/api/mapa-ciudades/route";
import CityDetailPanel from "./_components/CityDetailPanel";
import { useEffect, useMemo, useState } from "react";

const ColombiaMap = dynamic(() => import("./_components/ColombiaMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface)",
        color: "var(--muted)",
        fontSize: 14,
      }}
    >
      Cargando mapa…
    </div>
  ),
});

interface MapaData {
  ciudades: CiudadMapaDTO[];
  generatedAt: string;
}

const AMBER = "#F59E0B";
const EMERALD = "#0E9C76";

const FUENTES: { key: string; label: string }[] = [
  { key: "solicitudes", label: "Solicitudes" },
  { key: "transporte", label: "Guardados" },
  { key: "tienda", label: "Tienda" },
];

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
      {label}
    </span>
  );
}

function SplitDot() {
  return (
    <svg width={12} height={12} style={{ flexShrink: 0 }}>
      <circle cx={6} cy={6} r={6} fill={AMBER} />
      <path d="M6,6 L6,0 A6,6 0 0,1 6,12 Z" fill={EMERALD} />
    </svg>
  );
}

export default function MapaCiudadesPage() {
  const [data, setData] = useState<MapaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [fuentes, setFuentes] = useState<Set<string>>(new Set(FUENTES.map((f) => f.key)));
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [ciudadSel, setCiudadSel] = useState<CiudadMapaDTO | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (fuentes.size > 0 && fuentes.size < FUENTES.length) {
      params.set("fuentes", Array.from(fuentes).join(","));
    }
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [fuentes, desde, hasta]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Sin fuentes seleccionadas → no hay nada que mostrar
    if (fuentes.size === 0) {
      setData({ ciudades: [], generatedAt: new Date().toISOString() });
      setLoading(false);
      return;
    }

    fetch(`/api/mapa-ciudades${queryString}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json() as Promise<MapaData>;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Refrescar la ciudad seleccionada con datos nuevos (o cerrar si ya no existe)
        setCiudadSel((prev) => (prev ? d.ciudades.find((c) => c.nombre === prev.nombre) ?? null : null));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error desconocido");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryString, fuentes.size]);

  const totalProcesos = data?.ciudades.reduce((s, c) => s + c.total, 0) ?? 0;
  const totalCiudades = data?.ciudades.length ?? 0;

  const toggleFuente = (key: string) => {
    setFuentes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const limpiar = () => {
    setFuentes(new Set(FUENTES.map((f) => f.key)));
    setDesde("");
    setHasta("");
  };

  const hayFiltros = fuentes.size < FUENTES.length || desde !== "" || hasta !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <ModuleHero
        moduleKey="mapa-ciudades"
        kicker="Logística"
        title="Mapa de Ciudades"
        description="Distribución geográfica de procesos logísticos"
        metrics={
          loading
            ? []
            : [
                { label: "Ciudades activas", value: totalCiudades },
                { label: "Procesos mapeados", value: totalProcesos },
              ]
        }
      />

      <div style={{ padding: "16px 24px 24px" }}>
        {/* Barra de filtros */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 14,
            padding: "10px 14px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Fuente:</span>
            {FUENTES.map((f) => {
              const active = fuentes.has(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleFuente(f.key)}
                  style={{
                    fontSize: 12,
                    padding: "4px 12px",
                    borderRadius: 999,
                    cursor: "pointer",
                    border: `1px solid ${active ? "var(--mod-color, #14DBA0)" : "var(--border)"}`,
                    background: active ? "var(--module-surface, rgba(20,219,160,0.12))" : "transparent",
                    color: active ? "var(--mod-color, #14DBA0)" : "var(--muted)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Desde:</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: "var(--r)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Hasta:</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: "var(--r)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
            />
          </div>

          {hayFiltros && (
            <button
              onClick={limpiar}
              style={{
                fontSize: 12,
                padding: "4px 12px",
                borderRadius: "var(--r)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted)",
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Leyenda */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <LegendDot color={AMBER} label="Recogidas (origen)" />
          <LegendDot color={EMERALD} label="Entregas (destino)" />
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
            <SplitDot />
            Ambas
          </span>
          <span style={{ fontSize: 12, color: "var(--faint)" }}>· El tamaño del marcador refleja el volumen</span>
        </div>

        {/* Mapa + panel */}
        <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
          <div
            style={{
              flex: 1,
              height: "65vh",
              minHeight: 400,
              borderRadius: "var(--r)",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            {error ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--state-danger, #FF6B6B)",
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            ) : (
              <ColombiaMap ciudades={data?.ciudades ?? []} onSelectCity={setCiudadSel} />
            )}
          </div>

          {ciudadSel && <CityDetailPanel ciudad={ciudadSel} onClose={() => setCiudadSel(null)} />}
        </div>

        {/* Resumen inferior */}
        {!loading && data && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--faint)", textAlign: "right" }}>
            Actualizado: {new Date(data.generatedAt).toLocaleString("es-CO")}
          </div>
        )}
      </div>
    </div>
  );
}
