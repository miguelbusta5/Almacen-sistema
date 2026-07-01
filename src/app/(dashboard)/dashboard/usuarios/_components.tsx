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
  mustChangePassword?: boolean;
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
        <span style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <Badge
            label={u.active ? "Activo" : "Inactivo"}
            variant={u.active ? "success" : "muted"}
            dot={false}
          />
          {u.mustChangePassword && (
            <span data-testid="badge-cambio-pendiente">
              <Badge label="Cambio pendiente" variant="warning" dot={false} />
            </span>
          )}
        </span>
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

export interface VehiculoOperativo {
  id: string;
  placa: string;
  tipo: string;
  capacidadKg?: number | null;
  estado: string;
  transportistas?: Array<{ id: string; nombre: string; activo: boolean }>;
}

export interface TransportistaOperativo {
  id: string;
  nombre: string;
  telefono?: string | null;
  activo: boolean;
  user?: { id: string; name: string; email: string; active: boolean } | null;
  vehiculo?: { id: string; placa: string; tipo: string; estado: string } | null;
}

const selectInputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 0.55rem",
  background: "var(--surface2)",
  border: "1px solid transparent",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "var(--sans)",
  color: "var(--text)",
  outline: "none",
};

/**
 * Tabla secundaria de Transportistas Operativos — el `<select>` de la columna
 * Vehículo conserva exactamente las mismas opciones, valor y `onChange`
 * (delegado a `onAsignarVehiculo`, que en `page.tsx` sigue llamando al mismo
 * `PATCH /api/users/transportistas-operativos` sin cambios). Este componente
 * NUNCA llama a fetch/endpoints por sí mismo — solo invoca el callback.
 */
export function TransportistasOperativosTable({
  transportistas,
  vehiculos,
  loading,
  updatingId,
  onAsignarVehiculo,
  debug = false,
}: {
  transportistas: TransportistaOperativo[];
  vehiculos: VehiculoOperativo[];
  loading: boolean;
  updatingId: string | null;
  onAsignarVehiculo: (transportistaId: string, nextVehiculoId: string) => void;
  debug?: boolean;
}) {
  const columns: Column<TransportistaOperativo>[] = [
    {
      key: "nombre",
      header: "Nombre",
      width: "26%",
      testId: "transportista-nombre-cell",
      debugLabel: "Nombre",
      render: (t) => <span style={{ fontWeight: 800 }}>{t.nombre}</span>,
    },
    {
      key: "usuario",
      header: "Usuario",
      width: "28%",
      testId: "transportista-usuario-cell",
      debugLabel: "Usuario",
      truncate: true,
      render: (t) => (
        <span style={{ color: "var(--muted2)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.user ? t.user.email : "Sin usuario"}>
          {t.user ? t.user.email : "Sin usuario"}
        </span>
      ),
    },
    {
      key: "vehiculo",
      header: "Vehículo",
      width: "28%",
      testId: "transportista-vehiculo-cell",
      debugLabel: "Vehículo",
      render: (t) => (
        <select
          value={t.vehiculo?.id || ""}
          onChange={(e) => onAsignarVehiculo(t.id, e.target.value)}
          disabled={updatingId === t.id}
          style={selectInputStyle}
        >
          <option value="">Sin vehículo</option>
          {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} - {v.tipo}</option>)}
        </select>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "18%",
      testId: "transportista-estado-cell",
      debugLabel: "Estado",
      render: (t) => (
        <Badge label={t.activo ? "Activo" : "Inactivo"} variant={t.activo ? "success" : "muted"} dot={false} />
      ),
    },
  ];

  return (
    <DataTable<TransportistaOperativo>
      columns={columns}
      rows={transportistas}
      getRowKey={(t) => t.id}
      loading={loading}
      tableLayout="fixed"
      minWidth={520}
      debug={debug}
      ariaLabel="Transportistas operativos"
      empty={{
        title: "No hay transportistas operativos",
        description: "Crea uno y asígnale vehículo antes de vincular usuario.",
      }}
    />
  );
}
