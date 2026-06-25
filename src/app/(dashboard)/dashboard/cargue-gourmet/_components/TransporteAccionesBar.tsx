"use client";

import { DetailSection } from "@/components/ui/SlidePanel";
import type { EstadoPedidoGourmet } from "../_components";

export const ESTADOS_INICIABLES_TRANSPORTE: EstadoPedidoGourmet[] = ["ENVIADO_A_TRANSPORTE"];

export function TransporteAccionesBar({
  estado,
  puedeTransporte,
  onIniciarCargue,
  iniciando = false,
}: {
  estado: EstadoPedidoGourmet;
  puedeTransporte: boolean;
  onIniciarCargue: () => void;
  iniciando?: boolean;
}) {
  if (!puedeTransporte) return null;
  if (!ESTADOS_INICIABLES_TRANSPORTE.includes(estado)) return null;

  return (
    <DetailSection title="Acciones Transporte">
      <button
        type="button"
        onClick={onIniciarCargue}
        disabled={iniciando}
        className="g-btn g-btn-primary g-btn-sm"
        data-testid="btn-iniciar-cargue"
      >
        {iniciando ? "Iniciando…" : "Iniciar cargue"}
      </button>
    </DetailSection>
  );
}
