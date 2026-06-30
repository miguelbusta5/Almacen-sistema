"use client";

import { DetailSection } from "@/components/ui/SlidePanel";
import type { EstadoPedidoGourmet } from "../_components";
import type { ProgresoEscaneo } from "./EscaneoCajasPanel";

export const ESTADOS_INICIABLES_TRANSPORTE: EstadoPedidoGourmet[] = ["ENVIADO_A_TRANSPORTE"];
export const ESTADOS_FINALIZABLES_TRANSPORTE: EstadoPedidoGourmet[] = ["EN_CARGUE"];
export const ESTADOS_CIERRE_MANUAL: EstadoPedidoGourmet[] = ["EN_CARGUE", "CON_NOVEDAD"];

export function progresoCompleto(progreso: ProgresoEscaneo | null | undefined): boolean {
  return !!progreso && progreso.esperados > 0 && progreso.escaneados === progreso.esperados;
}

export function TransporteAccionesBar({
  estado,
  puedeTransporte,
  onIniciarCargue,
  iniciando = false,
  progreso = null,
  onFinalizarCargue,
  finalizando = false,
  puedeCierreManual = false,
  onCierreManual,
}: {
  estado: EstadoPedidoGourmet;
  puedeTransporte: boolean;
  onIniciarCargue: () => void;
  iniciando?: boolean;
  progreso?: ProgresoEscaneo | null;
  onFinalizarCargue?: () => void;
  finalizando?: boolean;
  puedeCierreManual?: boolean;
  onCierreManual?: () => void;
}) {
  // `puedeTransporte` representa "puede operar el cargue del camión" — lo cumplen
  // tanto Transporte como Gourmet (ver ROLES_TRANSPORTE en page.tsx).
  const puedeIniciar = puedeTransporte && ESTADOS_INICIABLES_TRANSPORTE.includes(estado);
  const puedeFinalizar = puedeTransporte && ESTADOS_FINALIZABLES_TRANSPORTE.includes(estado);
  const puedeCerrarManualmente = puedeCierreManual && ESTADOS_CIERRE_MANUAL.includes(estado);

  if (!puedeIniciar && !puedeFinalizar && !puedeCerrarManualmente) return null;

  const completo = progresoCompleto(progreso);

  return (
    <DetailSection title="Acciones de cargue">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {puedeIniciar && (
          <button
            type="button"
            onClick={onIniciarCargue}
            disabled={iniciando}
            className="g-btn g-btn-primary g-btn-sm"
            data-testid="btn-iniciar-cargue"
          >
            {iniciando ? "Iniciando…" : "Iniciar cargue"}
          </button>
        )}

        {puedeFinalizar && (
          <div>
            <button
              type="button"
              onClick={() => onFinalizarCargue?.()}
              disabled={finalizando || !completo}
              className="g-btn g-btn-primary g-btn-sm"
              data-testid="btn-finalizar-cargue"
            >
              {finalizando ? "Finalizando…" : "Finalizar cargue"}
            </button>
            {!completo && (
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0" }} data-testid="finalizar-cargue-hint">
                El cargue solo puede finalizar cuando el conteo esté completo.
              </p>
            )}
          </div>
        )}

        {puedeCerrarManualmente && (
          <button
            type="button"
            onClick={() => onCierreManual?.()}
            className="g-btn g-btn-secondary g-btn-sm"
            data-testid="btn-cierre-manual"
          >
            Cierre manual
          </button>
        )}
      </div>
    </DetailSection>
  );
}
