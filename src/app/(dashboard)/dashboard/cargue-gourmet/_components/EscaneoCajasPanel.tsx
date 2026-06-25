"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui";
import { DetailSection } from "@/components/ui/SlidePanel";
import type { EstadoPedidoGourmet } from "../_components";

export const ESTADO_ESCANEABLE: EstadoPedidoGourmet = "EN_CARGUE";

export type ResultadoEscaneo = "VALIDO" | "DUPLICADO" | "CAJA_AJENA" | "FORMATO_INVALIDO" | "EXCEDE_CANTIDAD";

export interface ProgresoEscaneo {
  escaneados: number;
  esperados: number;
}

export interface UltimoResultadoEscaneo {
  codigo: string;
  resultado: ResultadoEscaneo;
}

const RESULTADO_LABEL: Record<ResultadoEscaneo, string> = {
  VALIDO: "Caja válida",
  DUPLICADO: "Caja duplicada",
  CAJA_AJENA: "Caja ajena",
  FORMATO_INVALIDO: "Formato inválido",
  EXCEDE_CANTIDAD: "Excede cantidad esperada",
};

const RESULTADO_VARIANT: Record<ResultadoEscaneo, "success" | "warning" | "error" | "muted"> = {
  VALIDO: "success",
  DUPLICADO: "warning",
  CAJA_AJENA: "error",
  FORMATO_INVALIDO: "muted",
  EXCEDE_CANTIDAD: "warning",
};

// Resultados que representan una novedad operativa real (no un simple
// reintento de lectura) — usados para teñir la tarjeta de progreso.
const RESULTADOS_NOVEDAD: ResultadoEscaneo[] = ["DUPLICADO", "CAJA_AJENA", "EXCEDE_CANTIDAD"];

export function EscaneoCajasPanel({
  estado,
  puedeTransporte,
  progreso,
  ultimoResultado,
  enviando = false,
  onEscanear,
}: {
  estado: EstadoPedidoGourmet;
  puedeTransporte: boolean;
  progreso: ProgresoEscaneo | null;
  ultimoResultado: UltimoResultadoEscaneo | null;
  enviando?: boolean;
  onEscanear: (codigo: string) => Promise<boolean>;
}) {
  const [codigo, setCodigo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!puedeTransporte) return null;
  if (estado !== ESTADO_ESCANEABLE) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const valor = codigo.trim();
    if (!valor || enviando) return;
    const ok = await onEscanear(valor);
    // Si falló (red, 409, etc.) se conserva el texto para no obligar a
    // re-escanear/re-escribir el mismo código.
    if (ok) setCodigo("");
    inputRef.current?.focus();
  }

  const completo = !!progreso && progreso.escaneados >= progreso.esperados;
  const conNovedad = !!ultimoResultado && RESULTADOS_NOVEDAD.includes(ultimoResultado.resultado);
  const pct = progreso && progreso.esperados > 0 ? Math.round((progreso.escaneados / progreso.esperados) * 100) : null;

  return (
    <DetailSection title="Escaneo de cajas">
      <div
        data-testid="progreso-escaneo"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderRadius: 8, marginBottom: 10,
          background: "var(--surface2)",
          border: `1px solid ${conNovedad ? "var(--error)" : completo ? "var(--success)" : "var(--border)"}`,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", fontFamily: "var(--mono)" }}>
            {progreso ? `${progreso.escaneados} / ${progreso.esperados}` : "—"}
          </div>
          {pct !== null && <div style={{ fontSize: 11, color: "var(--muted)" }}>{pct}%</div>}
        </div>
        <Badge
          label={conNovedad ? "Con novedad" : completo ? "Completo" : "Incompleto"}
          variant={conNovedad ? "error" : completo ? "success" : "warning"}
        />
      </div>

      <form onSubmit={submit} data-testid="escaneo-form" style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Escanea o escribe el código de la caja…"
          disabled={enviando}
          autoFocus
          data-testid="escaneo-input"
          style={{
            flex: 1, height: 38, padding: "0 12px", fontSize: 14, fontFamily: "var(--mono)",
            background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
            color: "var(--text)", outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={enviando || !codigo.trim()}
          data-testid="btn-registrar-escaneo"
          className="g-btn g-btn-primary g-btn-sm"
        >
          {enviando ? "Registrando…" : "Registrar escaneo"}
        </button>
      </form>

      {ultimoResultado && (
        <div data-testid="ultimo-resultado-escaneo" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <Badge label={RESULTADO_LABEL[ultimoResultado.resultado]} variant={RESULTADO_VARIANT[ultimoResultado.resultado]} />
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>{ultimoResultado.codigo}</span>
        </div>
      )}
    </DetailSection>
  );
}
