"use client";

import { CheckCircle2, GitMerge, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";

export type EstadoIntegracion = "PENDIENTE_AREA2" | "LISTA_TRANSPORTE" | "COMPLETADA";

export interface PlinItem {
  id: string;
  area: string;
  plu: string;
  descripcion: string | null;
  unidades: number;
}

export interface Integracion {
  id: string;
  numeroDocumento: string;
  tipoDocumento: string;
  fecha: string;
  estado: EstadoIntegracion;
  areaIniciadora: string;
  numeroCajasArea1: number | null;
  numeroCajasArea2: number | null;
  creadoPorNombre: string | null;
  completadoPorNombre: string | null;
  creadoAt: string;
  completadoAt: string | null;
  entregadoATransporteAt: string | null;
  marcadoCompletadoAt: string | null;
  observaciones: string | null;
  createdAt: string;
  plines: PlinItem[];
}

export const ESTADO_LABEL: Record<EstadoIntegracion, string> = {
  PENDIENTE_AREA2: "Pendiente Área 2",
  LISTA_TRANSPORTE: "Lista para Transporte",
  COMPLETADA: "Completada",
};

export function estadoVariant(e: EstadoIntegracion): "warning" | "info" | "success" {
  if (e === "PENDIENTE_AREA2") return "warning";
  if (e === "LISTA_TRANSPORTE") return "info";
  return "success";
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function IntegracionTable({
  items,
  loading,
  color,
  canCompleteArea2,
  canTransport,
  canEdit,
  isAdmin,
  deletingIntId,
  onRowClick,
  onCompletar,
  onRecibido,
  onEditar,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
  hasSearch,
  onClearSearch,
  debug = false,
}: {
  items: Integracion[];
  loading: boolean;
  color: string;
  canCompleteArea2: (item: Integracion) => boolean;
  canTransport: boolean;
  canEdit: (item: Integracion) => boolean;
  isAdmin: boolean;
  deletingIntId: string | null;
  onRowClick: (item: Integracion) => void;
  onCompletar: (item: Integracion) => void;
  onRecibido: (item: Integracion) => void;
  onEditar: (item: Integracion) => void;
  onDeleteStart: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  hasSearch: boolean;
  onClearSearch: () => void;
  debug?: boolean;
}) {
  const columns: Column<Integracion>[] = [
    {
      key: "documento",
      header: "Documento",
      width: "16%",
      testId: "documento-cell",
      debugLabel: "Documento",
      render: (item) => (
        <span style={{ fontWeight: 600, color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.numeroDocumento}>
          {item.numeroDocumento}
        </span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      width: "10%",
      testId: "tipo-cell",
      debugLabel: "Tipo",
      render: (item) => (
        <span style={{ background: `${color}14`, color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
          {item.tipoDocumento}
        </span>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      width: "12%",
      testId: "fecha-cell",
      debugLabel: "Fecha",
      render: (item) => <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(item.fecha)}</span>,
    },
    {
      key: "area",
      header: "Área inicio",
      width: "14%",
      testId: "area-cell",
      debugLabel: "Área",
      truncate: true,
      render: (item) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--brand)" }}>{item.areaIniciadora}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      width: "16%",
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (item) => <Badge variant={estadoVariant(item.estado)} label={ESTADO_LABEL[item.estado]} />,
    },
    {
      key: "cajas",
      header: "Cajas",
      width: "10%",
      testId: "cajas-cell",
      debugLabel: "Cajas",
      render: (item) => (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {item.numeroCajasArea1 ?? "—"} + {item.numeroCajasArea2 ?? "—"}
        </span>
      ),
    },
    {
      key: "acciones",
      header: "",
      width: "22%",
      testId: "acciones-cell",
      debugLabel: "Acciones",
      render: (item) => (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {canEdit(item) && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditar(item); }}
              className="ds-btn ds-btn-ghost"
              style={{ fontSize: 12, padding: "4px 8px", color: "var(--muted2)" }}
              title="Editar integración"
            >
              <Pencil size={13} />
            </button>
          )}
          {canCompleteArea2(item) && (
            <button
              onClick={(e) => { e.stopPropagation(); onCompletar(item); }}
              className="ds-btn ds-btn-ghost"
              style={{ fontSize: 12, padding: "4px 10px", color, border: `1px solid ${color}40` }}
            >
              Completar
            </button>
          )}
          {canTransport && item.estado === "LISTA_TRANSPORTE" && (
            <button
              onClick={(e) => { e.stopPropagation(); onRecibido(item); }}
              className="ds-btn ds-btn-ghost"
              style={{ fontSize: 12, padding: "4px 10px", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)" }}
            >
              <CheckCircle2 size={12} style={{ marginRight: 4 }} />Recibido
            </button>
          )}
          {isAdmin && (
            deletingIntId === item.id ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteConfirm(item.id); }}
                  className="ds-btn ds-btn-ghost"
                  style={{ fontSize: 12, padding: "4px 10px", color: "var(--error)", border: "1px solid var(--error)" }}
                >
                  Sí, eliminar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
                  className="ds-btn ds-btn-ghost"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteStart(item.id); }}
                className="ds-btn ds-btn-ghost"
                style={{ fontSize: 12, padding: "4px 8px", color: "var(--muted2)" }}
                title="Eliminar integración"
              >
                <Trash2 size={13} />
              </button>
            )
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable<Integracion>
      columns={columns}
      rows={items}
      getRowKey={(item) => item.id}
      loading={loading}
      onRowClick={onRowClick}
      tableLayout="fixed"
      minWidth={920}
      debug={debug}
      ariaLabel="Integraciones de pedidos"
      empty={{
        icon: <GitMerge size={28} />,
        title: "Sin integraciones",
        description: hasSearch ? "No hay resultados para tu búsqueda" : "Crea la primera integración de pedido",
        action: hasSearch ? { label: "Limpiar búsqueda", onClick: onClearSearch } : undefined,
      }}
    />
  );
}
