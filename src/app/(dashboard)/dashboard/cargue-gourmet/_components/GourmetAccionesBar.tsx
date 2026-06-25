"use client";

import { DetailSection } from "@/components/ui/SlidePanel";
import type { EstadoPedidoGourmet } from "../_components";

export const ESTADOS_EDITABLES_GOURMET: EstadoPedidoGourmet[] = ["BORRADOR", "UBICACION_ASIGNADA", "CON_NOVEDAD"];
export const ESTADOS_UBICABLES_GOURMET: EstadoPedidoGourmet[] = ["BORRADOR", "UBICACION_ASIGNADA"];
export const ESTADOS_ENVIABLES_GOURMET: EstadoPedidoGourmet[] = ["UBICACION_ASIGNADA"];

export function GourmetAccionesBar({
  estado,
  puedeGourmet,
  onEditar,
  onAsignarUbicacion,
  onEnviarTransporte,
}: {
  estado: EstadoPedidoGourmet;
  puedeGourmet: boolean;
  onEditar: () => void;
  onAsignarUbicacion: () => void;
  onEnviarTransporte: () => void;
}) {
  if (!puedeGourmet) return null;

  const puedeEditar = ESTADOS_EDITABLES_GOURMET.includes(estado);
  const puedeUbicar = ESTADOS_UBICABLES_GOURMET.includes(estado);
  const puedeEnviar = ESTADOS_ENVIABLES_GOURMET.includes(estado);

  if (!puedeEditar && !puedeUbicar && !puedeEnviar) return null;

  return (
    <DetailSection title="Acciones Gourmet">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {puedeEditar && (
          <button type="button" onClick={onEditar} className="g-btn g-btn-secondary g-btn-sm" data-testid="btn-editar-pedido">
            Editar pedido
          </button>
        )}
        {puedeUbicar && (
          <button type="button" onClick={onAsignarUbicacion} className="g-btn g-btn-secondary g-btn-sm" data-testid="btn-asignar-ubicacion">
            Asignar ubicación
          </button>
        )}
        {puedeEnviar && (
          <button type="button" onClick={onEnviarTransporte} className="g-btn g-btn-primary g-btn-sm" data-testid="btn-enviar-transporte">
            Enviar a Transporte
          </button>
        )}
      </div>
    </DetailSection>
  );
}
