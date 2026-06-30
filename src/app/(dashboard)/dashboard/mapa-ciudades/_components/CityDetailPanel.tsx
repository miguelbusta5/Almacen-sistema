"use client";

import { X } from "lucide-react";
import type { CiudadMapaDTO } from "@/app/api/mapa-ciudades/route";

const AMBER = "#F59E0B";
const EMERALD = "#0E9C76";

interface Props {
  ciudad: CiudadMapaDTO;
  onClose: () => void;
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r)",
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "var(--text)", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

export default function CityDetailPanel({ ciudad, onClose }: Props) {
  const total = ciudad.total || 1;
  const pctOrigen = Math.round((ciudad.comoOrigen / total) * 100);
  const pctDestino = 100 - pctOrigen;

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "fit-content",
        maxHeight: "65vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{ciudad.nombre}</h3>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            background: "none",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            padding: 2,
            display: "flex",
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Metric label="Recogidas" value={ciudad.comoOrigen} color={AMBER} />
        <Metric label="Entregas" value={ciudad.comoDestino} color={EMERALD} />
        <Metric label="Total" value={ciudad.total} />
      </div>

      {/* Barra de proporción origen/destino */}
      {ciudad.total > 0 && (
        <div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pctOrigen}%`, background: AMBER }} />
            <div style={{ width: `${pctDestino}%`, background: EMERALD }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            <span>{pctOrigen}% origen</span>
            <span>{pctDestino}% destino</span>
          </div>
        </div>
      )}

      {/* Transportadoras */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Transportadoras ({ciudad.transportadoras.length})
        </div>
        {ciudad.transportadoras.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--faint)" }}>Sin transportadora registrada</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ciudad.transportadoras.map((t) => (
              <div
                key={t.nombre}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
                <span
                  style={{
                    flexShrink: 0,
                    marginLeft: 8,
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--muted)",
                    background: "var(--surface)",
                    borderRadius: 10,
                    padding: "1px 8px",
                  }}
                >
                  {t.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
