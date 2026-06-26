"use client";

import { Badge, EmptyState } from "@/components/ui";
import { X, PackageSearch } from "lucide-react";
import { ESTADO_COLOR, ESTADO_LABEL, estadoVariant } from "../_components";
import { PedidoDetalleContent, type PedidoDetalleContentProps } from "./PedidoDetalleContent";

const DOCK_WIDTH = 460;

/**
 * Panel de detalle integrado al módulo (master-detail), solo para desktop.
 * A diferencia de `PedidoDetallePanel` (SlidePanel/overlay, usado en mobile),
 * este dock vive dentro del flujo normal de la página — no es `position:
 * fixed` ni cubre el header global. Queda anclado (`sticky`) bajo el header
 * del módulo y limita su propia altura al espacio visible del viewport, con
 * scroll interno propio. Resuelve el problema de "panel cortado" de forma
 * específica para Cargue Gourmet sin tocar el `SlidePanel` compartido.
 */
export function PedidoDetalleDock({
  selected,
  onClose,
  ...contentProps
}: PedidoDetalleContentProps & { selected: boolean; onClose: () => void }) {
  const { pedido } = contentProps;
  const badge = pedido ? (
    <Badge label={ESTADO_LABEL[pedido.estado]} variant={estadoVariant(pedido.estado)} color={ESTADO_COLOR[pedido.estado]} />
  ) : undefined;

  return (
    <div
      className="g-panel"
      data-testid="pedido-detalle-dock"
      style={{
        width: DOCK_WIDTH,
        flexShrink: 0,
        position: "sticky",
        top: 16,
        alignSelf: "flex-start",
        maxHeight: "calc(100vh - 32px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: 0,
      }}
    >
      {!selected ? (
        <div style={{ padding: 20 }}>
          <EmptyState
            icon={<PackageSearch size={28} />}
            title="Selecciona un pedido"
            description="Elige un pedido del listado para ver su detalle, estibas, cargues y novedades aquí."
          />
        </div>
      ) : (
        <>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
                    {pedido ? `${pedido.tipoOrden} ${pedido.orden}` : "Detalle del pedido"}
                  </h2>
                  {badge}
                </div>
                {pedido && (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, letterSpacing: "-0.01em" }}>
                    {pedido.nombreTienda} — {pedido.ciudadDestino}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                data-testid="cerrar-dock-btn"
                style={{
                  background: "var(--surface2)", border: "none", borderRadius: 7,
                  padding: 7, cursor: "pointer", color: "var(--muted)",
                  display: "flex", flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            <PedidoDetalleContent {...contentProps} />
          </div>
        </>
      )}
    </div>
  );
}
