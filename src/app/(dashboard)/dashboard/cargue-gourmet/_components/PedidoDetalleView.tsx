"use client";

import { Badge, ModuleDetailView } from "@/components/ui";
import { ESTADO_COLOR, ESTADO_LABEL, estadoVariant } from "../_components";
import { PedidoDetalleContent, type PedidoDetalleContentProps } from "./PedidoDetalleContent";

/**
 * Vista de detalle del pedido a ancho completo (reemplaza al listado). Usa el
 * marco compartido `ModuleDetailView` y reutiliza `PedidoDetalleContent` (las
 * acciones Gourmet/Transporte viven dentro del propio contenido, por eso no se
 * pasa `actions` al header). Mismo contenido y data-testid que antes. Aplica a
 * todos los tamaños de pantalla (ya no hay SlidePanel mobile). Ver G3C-QA-FIX3.
 */
export function PedidoDetalleView({
  onBack,
  ...contentProps
}: PedidoDetalleContentProps & { onBack: () => void }) {
  const { pedido } = contentProps;
  const badge = pedido ? (
    <Badge label={ESTADO_LABEL[pedido.estado]} variant={estadoVariant(pedido.estado)} color={ESTADO_COLOR[pedido.estado]} />
  ) : undefined;

  return (
    <ModuleDetailView
      testId="pedido-detalle-view"
      onBack={onBack}
      title={pedido ? `${pedido.tipoOrden} ${pedido.orden}` : "Detalle del pedido"}
      subtitle={pedido ? `${pedido.nombreTienda} — ${pedido.ciudadDestino}` : undefined}
      badge={badge}
    >
      <PedidoDetalleContent {...contentProps} />
    </ModuleDetailView>
  );
}
