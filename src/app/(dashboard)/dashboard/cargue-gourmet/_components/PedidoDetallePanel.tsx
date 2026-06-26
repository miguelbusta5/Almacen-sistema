"use client";

import { Badge } from "@/components/ui";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { ESTADO_COLOR, ESTADO_LABEL, estadoVariant } from "../_components";
import { PedidoDetalleContent, type PedidoDetalleContentProps } from "./PedidoDetalleContent";

export type {
  EstibaDetalle, CajaDetalle, EscaneoDetalle, CargueDetalle, NovedadDetalle, PedidoDetalle,
} from "./PedidoDetalleTypes";
import type { PedidoDetalle } from "./PedidoDetalleTypes";

// Wrapper SlidePanel (overlay/bottom-sheet) — usado en mobile. En desktop,
// Cargue Gourmet usa `PedidoDetalleView` (vista a ancho completo que reemplaza
// al listado), que reutiliza el mismo `PedidoDetalleContent`. Ver G3C-QA-FIX3.
export function PedidoDetallePanel({
  open,
  onClose,
  pedido,
  ...contentProps
}: PedidoDetalleContentProps & { open: boolean; onClose: () => void }) {
  const badge = pedido ? (
    <Badge label={ESTADO_LABEL[pedido.estado]} variant={estadoVariant(pedido.estado)} color={ESTADO_COLOR[pedido.estado]} />
  ) : undefined;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={pedido ? `${pedido.tipoOrden} ${pedido.orden}` : "Detalle del pedido"}
      subtitle={pedido ? `${pedido.nombreTienda} — ${pedido.ciudadDestino}` : undefined}
      badge={badge}
      width={640}
    >
      <PedidoDetalleContent pedido={pedido} {...contentProps} />
    </SlidePanel>
  );
}
