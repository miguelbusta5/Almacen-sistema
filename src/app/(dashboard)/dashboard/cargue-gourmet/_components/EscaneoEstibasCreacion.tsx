"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { validarCodigoCaja } from "@/lib/gourmetCajaEscaneo";

// Panel de escaneo por estiba usado en "Nuevo pedido" (G3): cada estiba tiene
// su propia pestaña y lista de códigos escaneados. El auto-avance (Enter →
// valida → limpia → refoca) replica el comportamiento del escaneo de cargue
// (`EscaneoCajasPanel`) para que el operario no tenga que tocar el mouse.
export interface EstibaEscaneada {
  secuencia: number;
  cajas: string[];
}

export function useEscaneoEstibas(estibasEsperadas: number) {
  const [estibas, setEstibas] = useState<EstibaEscaneada[]>([]);

  useEffect(() => {
    setEstibas((prev) => {
      const n = Number.isInteger(estibasEsperadas) && estibasEsperadas > 0 ? estibasEsperadas : 0;
      if (n === prev.length) return prev;
      const next: EstibaEscaneada[] = [];
      for (let i = 0; i < n; i++) {
        next.push(prev[i] ?? { secuencia: i + 1, cajas: [] });
      }
      return next;
    });
  }, [estibasEsperadas]);

  const totalEscaneado = estibas.reduce((sum, e) => sum + e.cajas.length, 0);

  return { estibas, setEstibas, totalEscaneado };
}

const inp: React.CSSProperties = {
  flex: 1, height: 36, padding: "0 12px", fontSize: 14, fontFamily: "var(--mono)",
  background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
  color: "var(--text)", outline: "none",
};

export function EscaneoEstibasCreacion({
  estibas,
  setEstibas,
  cajasEsperadas,
}: {
  estibas: EstibaEscaneada[];
  setEstibas: React.Dispatch<React.SetStateAction<EstibaEscaneada[]>>;
  cajasEsperadas: number | null;
}) {
  const [tabActivo, setTabActivo] = useState(0);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (estibas.length === 0) return null;

  const idx = Math.min(tabActivo, estibas.length - 1);
  const activa = estibas[idx];
  const totalEscaneado = estibas.reduce((sum, e) => sum + e.cajas.length, 0);
  const todosLosCodigos = estibas.flatMap((e) => e.cajas);

  function agregarCodigo(e: React.FormEvent) {
    e.preventDefault();
    const valor = codigo.trim();
    if (!valor) return;

    const r = validarCodigoCaja(valor);
    if (!r.ok) {
      setError(r.error);
      inputRef.current?.focus();
      return;
    }
    if (todosLosCodigos.includes(valor)) {
      setError(`"${valor}" ya fue escaneado en otra caja de este pedido.`);
      inputRef.current?.focus();
      return;
    }
    if (cajasEsperadas != null && totalEscaneado >= cajasEsperadas) {
      setError(`Ya se escanearon las ${cajasEsperadas} cajas esperadas.`);
      inputRef.current?.focus();
      return;
    }

    setEstibas((rows) => rows.map((r2, i) => (i === idx ? { ...r2, cajas: [...r2.cajas, valor] } : r2)));
    setError("");
    setCodigo("");
    inputRef.current?.focus();
  }

  function quitarCodigo(cIdx: number) {
    setEstibas((rows) => rows.map((r2, i) => (i === idx ? { ...r2, cajas: r2.cajas.filter((_, j) => j !== cIdx) } : r2)));
  }

  const completo = cajasEsperadas != null && totalEscaneado === cajasEsperadas;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>Escaneo de cajas por estiba</label>
        <span
          data-testid="total-escaneado-creacion"
          style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", color: completo ? "var(--success)" : "var(--muted)" }}
        >
          {totalEscaneado}{cajasEsperadas != null ? ` / ${cajasEsperadas}` : ""}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} data-testid="estiba-tabs">
        {estibas.map((e, i) => (
          <button
            type="button"
            key={e.secuencia}
            onClick={() => { setTabActivo(i); setError(""); }}
            data-testid={`estiba-tab-${i}`}
            className="g-btn g-btn-sm"
            style={{
              background: i === idx ? "var(--brand)" : "var(--surface2)",
              color: i === idx ? "var(--on-brand, #06251c)" : "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            Estiba {e.secuencia} ({e.cajas.length})
          </button>
        ))}
      </div>

      <form onSubmit={agregarCodigo} style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder={`Escanea caja para Estiba ${activa.secuencia}…`}
          autoFocus
          data-testid="escaneo-creacion-input"
          style={inp}
        />
        <button type="submit" disabled={!codigo.trim()} className="g-btn g-btn-primary g-btn-sm" data-testid="btn-escanear-creacion">
          Agregar
        </button>
      </form>

      {error && (
        <p data-testid="escaneo-creacion-error" style={{ fontSize: 12, color: "var(--error)", margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }} data-testid={`estiba-cajas-lista-${idx}`}>
        {activa.cajas.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Sin cajas escaneadas en esta estiba.</p>
        )}
        {activa.cajas.map((c, cIdx) => (
          <div key={`${c}-${cIdx}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "var(--surface2)", borderRadius: 6 }}>
            <span style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text)" }}>{c}</span>
            <button
              type="button"
              onClick={() => quitarCodigo(cIdx)}
              data-testid={`quitar-caja-${idx}-${cIdx}`}
              style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "var(--error-tint)", color: "var(--error)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
