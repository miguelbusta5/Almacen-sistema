"use client";

import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";

export type EstadoPedidoGourmet =
  | "BORRADOR"
  | "UBICACION_ASIGNADA"
  | "ENVIADO_A_TRANSPORTE"
  | "EN_CARGUE"
  | "CARGUE_COMPLETO"
  | "CARGUE_COMPLETO_MANUAL"
  | "CON_NOVEDAD"
  | "CANCELADO";

export const ESTADOS_PEDIDO_GOURMET: EstadoPedidoGourmet[] = [
  "BORRADOR",
  "UBICACION_ASIGNADA",
  "ENVIADO_A_TRANSPORTE",
  "EN_CARGUE",
  "CARGUE_COMPLETO",
  "CARGUE_COMPLETO_MANUAL",
  "CON_NOVEDAD",
  "CANCELADO",
];

export const ESTADO_LABEL: Record<EstadoPedidoGourmet, string> = {
  BORRADOR: "Borrador",
  UBICACION_ASIGNADA: "Ubicación asignada",
  ENVIADO_A_TRANSPORTE: "Enviado a Transporte",
  EN_CARGUE: "En cargue",
  CARGUE_COMPLETO: "Cargue completo",
  CARGUE_COMPLETO_MANUAL: "Cerrado manualmente",
  CON_NOVEDAD: "Con novedad",
  CANCELADO: "Cancelado",
};

// Colores propios del módulo (hex directo, no `--state-*` compartido con otros
// módulos) — mismo criterio que src/lib/tienda.ts.
export const ESTADO_COLOR: Record<EstadoPedidoGourmet, string> = {
  BORRADOR: "#94a3b8", // gris
  UBICACION_ASIGNADA: "#5B9DFF", // azul
  ENVIADO_A_TRANSPORTE: "#F97316", // naranja
  EN_CARGUE: "#FFC53D", // amarillo
  CARGUE_COMPLETO: "#2EE6A6", // verde
  CARGUE_COMPLETO_MANUAL: "#2EE6A6", // verde — distinguido por icono ⚠ en el label, no por color
  CON_NOVEDAD: "#FF6B6B", // rojo
  CANCELADO: "#64748b", // gris oscuro
};

// `Badge` (src/components/ui/index.tsx) solo tiene variantes semánticas fijas
// (success/warning/error/info/default/muted/purple/teal) — se usa `color`
// para los matices exactos de esta tabla y `variant` solo como base de estilo.
export function estadoVariant(
  e: EstadoPedidoGourmet
): "success" | "warning" | "error" | "info" | "default" | "muted" {
  switch (e) {
    case "BORRADOR":
      return "muted";
    case "UBICACION_ASIGNADA":
      return "info";
    case "ENVIADO_A_TRANSPORTE":
      return "warning";
    case "EN_CARGUE":
      return "warning";
    case "CARGUE_COMPLETO":
      return "success";
    case "CARGUE_COMPLETO_MANUAL":
      return "success";
    case "CON_NOVEDAD":
      return "error";
    case "CANCELADO":
      return "muted";
  }
}

export interface GourmetPedidoRow {
  id: string;
  orden: string;
  tipoOrden: string;
  codigoTienda: string;
  nombreTienda: string;
  ciudadDestino: string;
  cajasEsperadas: number;
  estibasEsperadas: number;
  estado: EstadoPedidoGourmet;
  updatedAt: string;
}

export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function EstadoBadge({ estado }: { estado: EstadoPedidoGourmet | string }) {
  const known = estado in ESTADO_LABEL;
  if (!known) return <Badge label={String(estado)} variant="muted" color="var(--muted)" />;
  const e = estado as EstadoPedidoGourmet;
  return (
    <>
      <Badge label={ESTADO_LABEL[e]} variant={estadoVariant(e)} color={ESTADO_COLOR[e]} />
      {e === "CARGUE_COMPLETO_MANUAL" && (
        <span title="Cierre de contingencia — cantidad contada manualmente" style={{ marginLeft: 4, fontSize: 12 }}>
          ⚠
        </span>
      )}
    </>
  );
}

export function CargueGourmetTable({
  rows,
  loading,
  debug = false,
}: {
  rows: GourmetPedidoRow[];
  loading: boolean;
  debug?: boolean;
}) {
  const columns: Column<GourmetPedidoRow>[] = [
    {
      key: "orden",
      header: "Orden",
      width: "14%",
      testId: "orden-cell",
      debugLabel: "Orden",
      render: (r) => <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{r.orden}</span>,
    },
    {
      key: "tipoOrden",
      header: "Tipo",
      width: "8%",
      testId: "tipo-cell",
      debugLabel: "Tipo",
    },
    {
      key: "nombreTienda",
      header: "Tienda",
      width: "20%",
      testId: "tienda-cell",
      debugLabel: "Tienda",
      truncate: true,
    },
    {
      key: "ciudadDestino",
      header: "Ciudad",
      width: "12%",
      testId: "ciudad-cell",
      debugLabel: "Ciudad",
    },
    {
      key: "cajasEsperadas",
      header: "Cajas",
      width: "8%",
      align: "right",
      testId: "cajas-cell",
      debugLabel: "Cajas",
    },
    {
      key: "estibasEsperadas",
      header: "Estibas",
      width: "8%",
      align: "right",
      testId: "estibas-cell",
      debugLabel: "Estibas",
    },
    {
      key: "estado",
      header: "Estado",
      width: "16%",
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (r) => <EstadoBadge estado={r.estado} />,
    },
    {
      key: "updatedAt",
      header: "Actualizado",
      width: "14%",
      testId: "actualizado-cell",
      debugLabel: "Actualizado",
      render: (r) => <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted2)" }}>{fmtFechaHora(r.updatedAt)}</span>,
    },
  ];

  return (
    <DataTable<GourmetPedidoRow>
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      loading={loading}
      tableLayout="fixed"
      debug={debug}
      empty={{ title: "Sin pedidos", description: "No hay pedidos Gourmet que coincidan con los filtros aplicados." }}
    />
  );
}
