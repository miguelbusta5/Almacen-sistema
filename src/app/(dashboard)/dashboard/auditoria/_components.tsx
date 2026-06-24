"use client";

import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";

export interface LogUser { id: string; name: string; email: string; }
export interface LogItem {
  id: string;
  action: string;
  module: string;
  recordId: string;
  details: string | null;
  createdAt: string;
  user: LogUser | null;
}

export const ACTION_META: Record<string, { label: string; color: string }> = {
  CREATE: { label: "Creó", color: "var(--brand)" },
  UPDATE: { label: "Editó", color: "#34D9F0" },
  DELETE: { label: "Eliminó", color: "var(--error)" },
};
export const MODULE_META: Record<string, { label: string; color: string }> = {
  muebles: { label: "Muebles", color: "#34D9F0" },
  transporte: { label: "Transporte", color: "#f97316" },
  users: { label: "Usuarios", color: "#5B9DFF" },
};

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

type SortCol = "createdAt" | "userName";
type SortDir = "asc" | "desc";

function SortableHeader({
  label, col, sortCol, sortDir, onToggleSort,
}: { label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir; onToggleSort: (col: SortCol) => void }) {
  return (
    <span
      onClick={() => onToggleSort(col)}
      style={{ cursor: "pointer", userSelect: "none", color: sortCol === col ? "#5B9DFF" : undefined }}
    >
      {label}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
    </span>
  );
}

export function AuditoriaTable({
  logs,
  sortCol,
  sortDir,
  onToggleSort,
  loading,
  debug = false,
}: {
  logs: LogItem[];
  sortCol: SortCol;
  sortDir: SortDir;
  onToggleSort: (col: SortCol) => void;
  loading: boolean;
  debug?: boolean;
}) {
  const columns: Column<LogItem>[] = [
    {
      key: "createdAt",
      header: <SortableHeader label="Fecha y hora" col="createdAt" sortCol={sortCol} sortDir={sortDir} onToggleSort={onToggleSort} />,
      width: "16%",
      testId: "fecha-cell",
      debugLabel: "Fecha",
      render: (l) => <span style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap", color: "var(--muted2)" }}>{fmtDateTime(l.createdAt)}</span>,
    },
    {
      key: "userName",
      header: <SortableHeader label="Usuario" col="userName" sortCol={sortCol} sortDir={sortDir} onToggleSort={onToggleSort} />,
      width: "20%",
      testId: "usuario-cell",
      debugLabel: "Usuario",
      render: (l) =>
        l.user ? (
          <>
            <div style={{ fontWeight: 600 }}>{l.user.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{l.user.email}</div>
          </>
        ) : <span style={{ color: "var(--muted)" }}>—</span>,
    },
    {
      key: "action",
      header: "Acción",
      width: "12%",
      testId: "accion-cell",
      debugLabel: "Acción",
      render: (l) => {
        const am = ACTION_META[l.action] || { label: l.action, color: "#64748b" };
        return <Badge label={am.label} color={am.color} dot={false} />;
      },
    },
    {
      key: "module",
      header: "Módulo",
      width: "12%",
      testId: "modulo-cell",
      debugLabel: "Módulo",
      render: (l) => {
        const mm = MODULE_META[l.module] || { label: l.module, color: "#64748b" };
        return <Badge label={mm.label} color={mm.color} dot={false} />;
      },
    },
    {
      key: "recordId",
      header: "Registro",
      width: "16%",
      testId: "registro-cell",
      debugLabel: "Registro",
      render: (l) => <span style={{ fontFamily: "var(--mono)", color: "var(--muted2)" }}>{l.recordId}</span>,
    },
    {
      key: "details",
      header: "Detalle",
      width: "24%",
      testId: "detalle-cell",
      debugLabel: "Detalle",
      truncate: true,
      render: (l) => (
        <span
          style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted2)" }}
          title={l.details || ""}
        >
          {l.details || "—"}
        </span>
      ),
    },
  ];

  return (
    <DataTable<LogItem>
      columns={columns}
      rows={logs}
      getRowKey={(l) => l.id}
      loading={loading}
      tableLayout="fixed"
      debug={debug}
      empty={{ title: "Sin eventos", description: "No hay eventos que coincidan con los filtros aplicados." }}
    />
  );
}
