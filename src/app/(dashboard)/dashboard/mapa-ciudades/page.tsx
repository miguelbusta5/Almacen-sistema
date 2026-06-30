"use client";

import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { ModuleHero } from "@/components/ui";
import type { CiudadMapaDTO } from "@/app/api/mapa-ciudades/route";
import { useEffect, useState } from "react";

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
        borderRadius: "var(--r)",
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
const EMERALD = "#14DBA0";

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
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
  const { data: session } = useSession();
  const [data, setData] = useState<MapaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mapa-ciudades")
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json() as Promise<MapaData>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error desconocido"))
      .finally(() => setLoading(false));
  }, []);

  const totalProcesos = data?.ciudades.reduce((s, c) => s + c.total, 0) ?? 0;
  const totalCiudades = data?.ciudades.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: "100%" }}>
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
        {/* Leyenda */}
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <LegendDot color={AMBER} label="Recogidas (origen)" />
          <LegendDot color={EMERALD} label="Entregas (destino)" />
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
            <SplitDot />
            Ambas
          </span>
        </div>

        {/* Mapa */}
        <div
          style={{
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
            <ColombiaMap ciudades={data?.ciudades ?? []} />
          )}
        </div>

        {/* Resumen inferior */}
        {!loading && data && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "var(--faint)",
              textAlign: "right",
            }}
          >
            Actualizado: {new Date(data.generatedAt).toLocaleString("es-CO")}
          </div>
        )}
      </div>
    </div>
  );
}
