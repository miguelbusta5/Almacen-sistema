"use client";

import { Pencil, Tags, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";

export interface Exportacion {
  id: string;
  numeroCaja: string;
  plu: string;
  descripcion: string;
  unidadEmpaque: number;
  fecha: string;
  horaInicio: string;
  horaFinalizacion: string | null;
  duracionMinutos: number | null;
  motivoCorreccion?: string | null;
  creadoPorId?: string | null;
  creadoPorNombre?: string | null;
}

export function fmtTime(value: string | null): string {
  if (!value) return "En curso";
  return new Date(value).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export function EstadoExportacionBadge({ horaFinalizacion }: { horaFinalizacion: string | null }) {
  return horaFinalizacion
    ? <Badge label="Finalizado" variant="default" dot={false} />
    : <Badge label="En curso" variant="info" />;
}

export function RegistrosTable({
  loading,
  items,
  canManage,
  userId,
  onEdit,
  onDelete,
  debug = false,
}: {
  loading: boolean;
  items: Exportacion[];
  canManage: boolean;
  userId: string | undefined;
  onEdit: (item: Exportacion) => void;
  onDelete: (item: Exportacion) => void;
  debug?: boolean;
}) {
  const columns: Column<Exportacion>[] = [
    {
      key: "fecha",
      header: "Fecha",
      width: "9%",
      testId: "fecha-cell",
      debugLabel: "Fecha",
      render: (item) => <span>{item.fecha}</span>,
    },
    {
      key: "usuario",
      header: "Usuario",
      width: "13%",
      testId: "usuario-cell",
      debugLabel: "Usuario",
      truncate: true,
      render: (item) => (
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.creadoPorNombre ?? "-"}>
          {item.creadoPorNombre ?? "-"}
        </span>
      ),
    },
    {
      key: "caja",
      header: "Caja",
      width: "9%",
      testId: "caja-cell",
      debugLabel: "Caja",
      render: (item) => <span>{item.numeroCaja}</span>,
    },
    {
      key: "plu",
      header: "PLU",
      width: "9%",
      testId: "plu-cell",
      debugLabel: "PLU",
      render: (item) => <span>{item.plu}</span>,
    },
    {
      key: "descripcion",
      header: "Descripción",
      width: "18%",
      testId: "descripcion-cell",
      debugLabel: "Descripción",
      render: (item) => (
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.descripcion}>
          {item.descripcion}
        </span>
      ),
    },
    {
      key: "empaque",
      header: "Empaque",
      width: "8%",
      testId: "empaque-cell",
      debugLabel: "Empaque",
      render: (item) => <span>{item.unidadEmpaque}</span>,
    },
    {
      key: "inicio",
      header: "Inicio",
      width: "9%",
      testId: "inicio-cell",
      debugLabel: "Inicio",
      render: (item) => <span>{fmtTime(item.horaInicio)}</span>,
    },
    {
      key: "fin",
      header: "Fin",
      width: "12%",
      testId: "fin-cell",
      debugLabel: "Fin",
      render: (item) => item.horaFinalizacion ? (
        <div style={{ display: "grid", gap: 3 }}>
          <EstadoExportacionBadge horaFinalizacion={item.horaFinalizacion} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtTime(item.horaFinalizacion)}</span>
        </div>
      ) : <EstadoExportacionBadge horaFinalizacion={item.horaFinalizacion} />,
    },
    {
      key: "duracion",
      header: "Dur.",
      width: "7%",
      testId: "duracion-cell",
      debugLabel: "Duración",
      render: (item) => <span>{item.duracionMinutos ?? "-"}</span>,
    },
    {
      key: "acciones",
      header: "Acciones",
      width: "12%",
      testId: "acciones-cell",
      debugLabel: "Acciones",
      render: (item) => {
        const canEditItem = canManage || item.creadoPorId === userId;
        return (
          <div style={{ display: "flex", gap: 6 }}>
            {canEditItem && (
              <button onClick={() => onEdit(item)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ height: 30 }}>
                <Pencil size={15} />
              </button>
            )}
            {canManage && (
              <button onClick={() => onDelete(item)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ height: 30, color: "var(--error)" }}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable<Exportacion>
      columns={columns}
      rows={items}
      getRowKey={(item) => item.id}
      loading={loading}
      tableLayout="fixed"
      minWidth={1080}
      debug={debug}
      ariaLabel="Registros de exportaciones"
      empty={{
        icon: <Tags size={28} />,
        title: "Sin registros",
        description: "Aun no hay cajas etiquetadas con estos filtros.",
      }}
    />
  );
}

export interface UserStat {
  id: string;
  nombre: string;
  cajas: number;
  plusDistintos: number;
  totalUnidades: number;
  finalizadas: number;
  duracionTotalMin: number;
  promedioPorCajaMin: number | null;
}

type ProductividadRow = UserStat & { isTotal?: boolean };

/** Calcula la fila de Total a partir de las stats filtradas. Mismo cálculo que la tabla original. */
export function calcularTotalProductividad(stats: UserStat[]): ProductividadRow {
  const totalCajas = stats.reduce((a, s) => a + s.cajas, 0);
  const totalUnidades = stats.reduce((a, s) => a + s.totalUnidades, 0);
  const totalFin = stats.reduce((a, s) => a + s.finalizadas, 0);
  const totalMin = stats.reduce((a, s) => a + s.duracionTotalMin, 0);
  const promTotal = totalFin > 0 ? Math.round((totalMin / totalFin) * 10) / 10 : null;
  return {
    id: "TOTAL",
    nombre: "Total",
    cajas: totalCajas,
    plusDistintos: 0,
    totalUnidades,
    finalizadas: totalFin,
    duracionTotalMin: totalMin,
    promedioPorCajaMin: promTotal,
    isTotal: true,
  };
}

export function ProductividadTable({
  stats,
  debug = false,
}: {
  stats: UserStat[];
  debug?: boolean;
}) {
  const rows: ProductividadRow[] = stats.length > 1
    ? [...stats, calcularTotalProductividad(stats)]
    : stats;

  const cellStyle = (row: ProductividadRow): React.CSSProperties => ({
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontWeight: row.isTotal ? 700 : 400,
  });

  const columns: Column<ProductividadRow>[] = [
    {
      key: "operario",
      header: "Operario",
      width: "24%",
      testId: "operario-cell",
      debugLabel: "Operario",
      truncate: true,
      render: (row) => <strong style={{ fontWeight: row.isTotal ? 700 : 600 }}>{row.nombre}</strong>,
    },
    {
      key: "cajas",
      header: "Cajas",
      width: "12%",
      align: "right",
      testId: "cajas-cell",
      debugLabel: "Cajas",
      render: (row) => <span style={cellStyle(row)}>{row.cajas}</span>,
    },
    {
      key: "plu",
      header: "PLUs",
      width: "12%",
      align: "right",
      testId: "plu-cell",
      debugLabel: "PLU",
      render: (row) => row.isTotal
        ? <span style={{ ...cellStyle(row), color: "var(--muted)" }}>—</span>
        : <span style={cellStyle(row)}>{row.plusDistintos}</span>,
    },
    {
      key: "unidades",
      header: "Unidades",
      width: "13%",
      align: "right",
      testId: "unidades-cell",
      debugLabel: "Unidades",
      render: (row) => <span style={cellStyle(row)}>{row.totalUnidades}</span>,
    },
    {
      key: "finalizadas",
      header: "Finalizadas",
      width: "13%",
      align: "right",
      testId: "finalizadas-cell",
      debugLabel: "Finalizadas",
      render: (row) => <span style={cellStyle(row)}>{row.finalizadas}</span>,
    },
    {
      key: "tiempo",
      header: "Tiempo total",
      width: "13%",
      align: "right",
      testId: "tiempo-cell",
      debugLabel: "Tiempo",
      render: (row) => (
        <span style={{ ...cellStyle(row), color: row.isTotal ? undefined : "var(--muted)" }}>
          {row.duracionTotalMin > 0 ? `${row.duracionTotalMin} min` : "–"}
        </span>
      ),
    },
    {
      key: "promedio",
      header: "Prom. min/caja",
      width: "13%",
      align: "right",
      testId: "promedio-cell",
      debugLabel: "Promedio",
      render: (row) => {
        if (row.promedioPorCajaMin == null) return <span style={{ color: "var(--muted)" }}>–</span>;
        if (row.isTotal) return <span style={cellStyle(row)}>{row.promedioPorCajaMin} min</span>;
        const color = row.promedioPorCajaMin <= 5 ? "var(--success)" : row.promedioPorCajaMin <= 10 ? "var(--warning)" : "var(--error)";
        return <span style={{ fontWeight: 700, color, textAlign: "right", display: "block" }}>{row.promedioPorCajaMin} min</span>;
      },
    },
  ];

  return (
    <DataTable<ProductividadRow>
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      isRowSelected={(row) => Boolean(row.isTotal)}
      tableLayout="fixed"
      minWidth={760}
      debug={debug}
      ariaLabel="Productividad por operario"
    />
  );
}
