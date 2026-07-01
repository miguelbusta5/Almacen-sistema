"use client";

import { DetailSection } from "@/components/ui/SlidePanel";
import type { EstadoPedidoGourmet } from "../_components";

export const ESTADOS_EDITABLES_GOURMET: EstadoPedidoGourmet[] = ["BORRADOR", "UBICACION_ASIGNADA", "CON_NOVEDAD"];
export const ESTADOS_UBICABLES_GOURMET: EstadoPedidoGourmet[] = ["BORRADOR", "UBICACION_ASIGNADA"];

export function GourmetAccionesBar({
  estado,
  puedeGourmet,
  onEditar,
  onAsignarUbicacion,
  puedeEliminar = false,
  onEliminar,
}: {
  estado: EstadoPedidoGourmet;
  puedeGourmet: boolean;
  onEditar: () => void;
  onAsignarUbicacion: () => void;
  puedeEliminar?: boolean;
  onEliminar?: () => void;
}) {
  // ADMIN/GERENTE (puedeEliminar) pueden editar sin importar el estado, para
  // corregir datos básicos después del hecho — el resto conserva la
  // restricción a estados tempranos.
  const puedeEditar = (puedeGourmet && ESTADOS_EDITABLES_GOURMET.includes(estado)) || puedeEliminar;
  const puedeUbicar = puedeGourmet && ESTADOS_UBICABLES_GOURMET.includes(estado);
  const puedeBorrar = puedeEliminar && estado !== "EN_CARGUE";

  if (!puedeEditar && !puedeUbicar && !puedeBorrar) return null;

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
        {puedeBorrar && (
          <button type="button" onClick={() => onEliminar?.()} className="g-btn g-btn-danger g-btn-sm" data-testid="btn-eliminar-pedido">
            Eliminar pedido
          </button>
        )}
      </div>
    </DetailSection>
  );
}
