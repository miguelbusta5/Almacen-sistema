"use client";

import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";

export type Role =
  | "ADMIN" | "GERENTE" | "OPERADOR" | "TRANSPORTISTA" | "INVENTARIO" | "TRANSPORTE"
  | "SUPERVISOR_INVENTARIO" | "SUPERVISOR_TRANSPORTE" | "TIENDA" | "SUPERVISOR_TIENDA"
  | "OPERACIONES_MUEBLES" | "OPERACIONES_GOURMET" | "ETIQUETADO" | "SUPERVISOR_ALMACENAMIENTO";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

export type SortCol = "name" | "role" | "active";
export type SortDir = "asc" | "desc";

export interface RoleMeta {
  label: string;
  color: string;
  icon: React.ReactNode;
}

/** Encabezado con indicador de orden (↑/↓/↕) — mismo comportamiento visual que el `<th>` manual anterior. */
function SortableHeader({ label, col, sortCol, sortDir, onToggleSort }: {
  label: string;
  col: SortCol;
  sortCol: SortCol;
  sortDir: SortDir;
  onToggleSort: (col: SortCol) => void;
}) {
  const active = sortCol === col;
  return (
    <span
      onClick={() => onToggleSort(col)}
      style={{ cursor: "pointer", userSelect: "none", color: active ? "#14DBA0" : "inherit" }}
    >
      {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
    </span>
  );
}

export function UsuariosTable({
  users,
  roleMeta,
  sortCol,
  sortDir,
  onToggleSort,
  onEdit,
  debug = false,
}: {
  users: User[];
  roleMeta: Record<Role, RoleMeta>;
  sortCol: SortCol;
  sortDir: SortDir;
  onToggleSort: (col: SortCol) => void;
  onEdit: (u: User) => void;
  debug?: boolean;
}) {
  const columns: Column<User>[] = [
    {
      key: "nombre",
      header: <SortableHeader label="Nombre" col="name" sortCol={sortCol} sortDir={sortDir} onToggleSort={onToggleSort} />,
      width: "22%",
      testId: "nombre-cell",
      debugLabel: "Nombre",
      render: (u) => <span style={{ fontWeight: 600 }}>{u.name}</span>,
    },
    {
      key: "email",
      header: "Email",
      width: "26%",
      testId: "email-cell",
      debugLabel: "Email",
      truncate: true,
      render: (u) => (
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted2)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.email}>
          {u.email}
        </span>
      ),
    },
    {
      key: "rol",
      header: <SortableHeader label="Rol" col="role" sortCol={sortCol} sortDir={sortDir} onToggleSort={onToggleSort} />,
      width: "22%",
      testId: "rol-cell",
      debugLabel: "Rol",
      render: (u) => {
        const m = roleMeta[u.role];
        return <Badge label={m.label} color={m.color} dot={false} />;
      },
    },
    {
      key: "estado",
      header: <SortableHeader label="Estado" col="active" sortCol={sortCol} sortDir={sortDir} onToggleSort={onToggleSort} />,
      width: "16%",
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (u) => (
        <Badge
          label={u.active ? "Activo" : "Inactivo"}
          variant={u.active ? "success" : "muted"}
          dot={false}
        />
      ),
    },
    {
      key: "acciones",
      header: "",
      width: "14%",
      align: "right",
      testId: "acciones-cell",
      debugLabel: "Acciones",
      render: (u) => (
        <button
          onClick={() => onEdit(u)}
          title="Editar"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: "var(--muted2)" }}
        >
          <Pencil size={14} />
        </button>
      ),
    },
  ];

  return (
    <DataTable<User>
      columns={columns}
      rows={users}
      getRowKey={(u) => u.id}
      tableLayout="fixed"
      minWidth={760}
      debug={debug}
      ariaLabel="Usuarios del sistema"
    />
  );
}
