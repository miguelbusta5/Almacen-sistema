"use client";

import { Badge } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { ESTADO_COLOR, ESTADO_LABEL, estadoVariant } from "../_components";
import { PedidoDetalleContent, type PedidoDetalleContentProps } from "./PedidoDetalleContent";

/**
 * Vista de detalle como página interna a ancho completo (desktop).
 * Reemplaza al overlay/dock: cuando hay un pedido seleccionado, el listado
 * se oculta y esta vista ocupa todo el ancho del módulo, con un botón
 * "Volver al listado". Reutiliza `PedidoDetalleContent` (mismo contenido y
 * mismos data-testid que el panel mobile). No usa `position: fixed` ni
 * altura limitada: es scroll de página normal. Ver G3C-QA-FIX3.
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
    <div data-testid="pedido-detalle-view" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        type="button"
        onClick={onBack}
        data-testid="volver-listado-btn"
        className="g-btn g-btn-secondary g-btn-sm"
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <ArrowLeft size={14} /> Volver al listado
      </button>

      <div className="g-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
              {pedido ? `${pedido.tipoOrden} ${pedido.orden}` : "Detalle del pedido"}
            </h2>
            {badge}
          </div>
          {pedido && (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, letterSpacing: "-0.01em" }}>
              {pedido.nombreTienda} — {pedido.ciudadDestino}
            </p>
          )}
        </div>

        <div style={{ padding: "20px 24px" }}>
          <PedidoDetalleContent {...contentProps} />
        </div>
      </div>
    </div>
  );
}
