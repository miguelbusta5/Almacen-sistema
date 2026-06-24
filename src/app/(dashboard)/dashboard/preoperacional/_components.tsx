"use client";

import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";

export type EstadoInspeccion = "APROBADA" | "APROBADA_CON_OBSERVACIONES" | "BLOQUEADA";

export interface HistorialRow {
  id: string;
  fecha: string;
  kilometraje: number | null;
  estado: EstadoInspeccion;
  conductor: { id: string; nombre: string; telefono: string | null };
  vehiculo: { id: string; placa: string; tipo: string };
  itemsCount: number;
  noConformes: number;
  criticos: number;
}

export const ESTADO_LABEL: Record<EstadoInspeccion, string> = {
  APROBADA: "Aprobada",
  APROBADA_CON_OBSERVACIONES: "Con observaciones",
  BLOQUEADA: "Bloqueada",
};

export function estadoBadgeVariant(e: EstadoInspeccion): "success" | "error" | "warning" {
  return e === "APROBADA" ? "success" : e === "BLOQUEADA" ? "error" : "warning";
}

export function HistorialPreoperacionalTable({
  rows,
  role,
  loading,
  deletingId,
  onRowClick,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
  debug = false,
}: {
  rows: HistorialRow[];
  role: string;
  loading: boolean;
  deletingId: string | null;
  onRowClick: (row: HistorialRow) => void;
  onDeleteStart: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  debug?: boolean;
}) {
  const isAdmin = role === "ADMIN";

  const columns: Column<HistorialRow>[] = [
    {
      key: "fecha",
      header: "Fecha",
      width: "12%",
      testId: "fecha-cell",
      debugLabel: "Fecha",
      render: (r) => <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.fecha}</span>,
    },
    {
      key: "conductor",
      header: "Conductor",
      width: "20%",
      testId: "conductor-cell",
      debugLabel: "Conductor",
      truncate: true,
      render: (r) => (
        <span style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.conductor?.nombre ?? "—"}>
          {r.conductor?.nombre ?? "—"}
        </span>
      ),
    },
    {
      key: "vehiculo",
      header: "Vehículo",
      width: "16%",
      testId: "vehiculo-cell",
      debugLabel: "Vehículo",
      render: (r) => (
        <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
          {r.vehiculo?.placa ?? "—"}
          <span style={{ color: "var(--muted)", marginLeft: 4 }}>{r.vehiculo?.tipo}</span>
        </span>
      ),
    },
    {
      key: "km",
      header: "Km",
      width: "10%",
      testId: "km-cell",
      debugLabel: "Km",
      render: (r) => <span style={{ fontSize: 12, color: "var(--muted2)" }}>{r.kilometraje != null ? r.kilometraje.toLocaleString() : "—"}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      width: "16%",
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (r) => <Badge label={ESTADO_LABEL[r.estado]} variant={estadoBadgeVariant(r.estado)} dot={false} />,
    },
    {
      key: "items",
      header: "Ítems",
      width: isAdmin ? "14%" : "26%",
      testId: "items-cell",
      debugLabel: "Ítems",
      render: (r) => (
        <span style={{ fontSize: 12 }}>
          <span style={{ color: "var(--muted2)" }}>{r.itemsCount} ítems</span>
          {r.noConformes > 0 && (
            <span style={{ marginLeft: 6, color: r.criticos > 0 ? "var(--error)" : "var(--warning)", fontWeight: 700 }}>
              · {r.noConformes} ✗{r.criticos > 0 ? ` (${r.criticos} crít.)` : ""}
            </span>
          )}
        </span>
      ),
    },
  ];

  if (isAdmin) {
    columns.push({
      key: "acciones",
      header: "",
      width: "12%",
      testId: "acciones-cell",
      debugLabel: "Acciones",
      render: (r) => (
        deletingId === r.id ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteConfirm(r.id); }}
              style={{ fontSize: 11, padding: "3px 8px", background: "var(--error)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
            >
              Sí, eliminar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
              style={{ fontSize: 11, padding: "3px 8px", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--muted)" }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteStart(r.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted2)", padding: 4, display: "flex", alignItems: "center" }}
            title="Eliminar inspección"
          >
            <Trash2 size={14} />
          </button>
        )
      ),
    });
  }

  return (
    <DataTable<HistorialRow>
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      loading={loading}
      onRowClick={onRowClick}
      tableLayout="fixed"
      minWidth={isAdmin ? 880 : 760}
      debug={debug}
      ariaLabel="Historial de preoperacional"
      empty={{
        title: "Sin inspecciones",
        description: "Sin inspecciones para los filtros seleccionados.",
      }}
    />
  );
}
