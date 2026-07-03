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
  BORRADOR: "Sin ubicación",
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
  // Ubicaciones físicas de las estibas, ya unidas por el API ("" si no hay).
  ubicaciones: string;
  // Fecha/hora de finalización del cargue (null si aún no finaliza).
  cargueCompletadoAt: string | null;
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

// Estados desde los que un pedido puede incluirse en el despacho masivo (no
// terminales — ya despachados/cancelados quedan fuera de la selección).
const ESTADOS_NO_DESPACHABLES_MASIVO: EstadoPedidoGourmet[] = ["CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CANCELADO"];

export function CargueGourmetTable({
  rows,
  loading,
  debug = false,
  onView,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: {
  rows: GourmetPedidoRow[];
  loading: boolean;
  debug?: boolean;
  onView?: (row: GourmetPedidoRow) => void;
  /** Activa la columna de checkbox para despacho masivo (solo ADMIN / usuario autorizado). */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
}) {
  const seleccionables = rows.filter((r) => !ESTADOS_NO_DESPACHABLES_MASIVO.includes(r.estado));
  const todasSeleccionadas = seleccionables.length > 0 && seleccionables.every((r) => selectedIds?.has(r.id));

  const columns: Column<GourmetPedidoRow>[] = [
    ...(selectable
      ? [
          {
            key: "__select",
            header: (
              <input
                type="checkbox"
                checked={todasSeleccionadas}
                onChange={() => onToggleSelectAll?.(seleccionables.map((r) => r.id))}
                aria-label="Seleccionar todos los pedidos despachables"
              />
            ),
            width: "4%",
            testId: "select-cell",
            render: (r: GourmetPedidoRow) =>
              ESTADOS_NO_DESPACHABLES_MASIVO.includes(r.estado) ? null : (
                <input
                  type="checkbox"
                  checked={selectedIds?.has(r.id) ?? false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect?.(r.id)}
                  aria-label={`Seleccionar pedido ${r.orden}`}
                />
              ),
          } as Column<GourmetPedidoRow>,
        ]
      : []),
    {
      key: "orden",
      header: "Orden",
      width: "11%",
      testId: "orden-cell",
      debugLabel: "Orden",
      render: (r) => <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{r.orden}</span>,
    },
    {
      key: "ubicaciones",
      header: "Ubicación",
      width: "15%",
      testId: "ubicacion-cell",
      debugLabel: "Ubicación",
      truncate: true,
      render: (r) =>
        r.ubicaciones
          ? <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.ubicaciones}</span>
          : <span style={{ color: "var(--faint)" }}>—</span>,
    },
    {
      key: "nombreTienda",
      header: "Tienda",
      width: "15%",
      testId: "tienda-cell",
      debugLabel: "Tienda",
      truncate: true,
    },
    {
      key: "ciudadDestino",
      header: "Ciudad",
      width: "10%",
      testId: "ciudad-cell",
      debugLabel: "Ciudad",
    },
    {
      key: "cajasEsperadas",
      header: "Cajas",
      width: "6%",
      align: "right",
      testId: "cajas-cell",
      debugLabel: "Cajas",
    },
    {
      key: "estibasEsperadas",
      header: "Estibas",
      width: "7%",
      align: "right",
      testId: "estibas-cell",
      debugLabel: "Estibas",
    },
    {
      key: "estado",
      header: "Estado",
      width: "13%",
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (r) => <EstadoBadge estado={r.estado} />,
    },
    {
      key: "updatedAt",
      header: "Actualizado",
      width: "11%",
      testId: "actualizado-cell",
      debugLabel: "Actualizado",
      render: (r) => <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted2)" }}>{fmtFechaHora(r.updatedAt)}</span>,
    },
    {
      key: "cargueCompletadoAt",
      header: "Finalización cargue",
      width: "12%",
      testId: "finalizacion-cell",
      debugLabel: "Finalización cargue",
      render: (r) => <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted2)" }}>{fmtFechaHora(r.cargueCompletadoAt)}</span>,
    },
  ];

  return (
    <DataTable<GourmetPedidoRow>
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      loading={loading}
      tableLayout="fixed"
      minWidth={1040}
      debug={debug}
      onRowClick={onView ? (r) => onView(r) : undefined}
      empty={{ title: "Sin pedidos", description: "No hay pedidos Gourmet que coincidan con los filtros aplicados." }}
    />
  );
}
