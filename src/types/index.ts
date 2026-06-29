// ─── Auth ───────────────────────────────────────────────────
export type UserRole =
  | "ADMIN"
  | "GERENTE"
  | "OPERADOR"
  | "TRANSPORTISTA"
  | "INVENTARIO"
  | "TRANSPORTE"
  | "SUPERVISOR_INVENTARIO"
  | "SUPERVISOR_TRANSPORTE"
  | "TIENDA"
  | "SUPERVISOR_TIENDA"
  | "OPERACIONES_MUEBLES"
  | "OPERACIONES_GOURMET"
  | "ETIQUETADO"
  | "SUPERVISOR_ALMACENAMIENTO";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

// ─── Transporte ─────────────────────────────────────────────
export type TransporteEstado = "PENDIENTE DESPACHO" | "DESPACHADO";

export interface Guardado {
  _id: string;
  fecha: string;
  documento: string;
  ubicacion: string;
  estado: TransporteEstado;
  fechaDespacho?: string;
  nota?: string;
}

export interface AlmacenajeInfo {
  fase: "gracia" | "cobro";
  meses: number;
  costo: number;
  diasRestantes?: number;
  finGracia: string;
  diasEnPeriodo?: number;
  diasHastaProxima?: number;
  costoProximo?: number;
  proximaCarga?: string;
}

// ─── Muebles ────────────────────────────────────────────────
export type NovedadEstado = "PENDIENTE" | "EN PROCESO" | "SOLUCIONADO";

export interface Novedad {
  _id: string;
  plu: number;
  posicion: string;
  unidades: number;
  fabricante: string;
  estado: NovedadEstado;
  fecha: string;
  costoUnitario: number;
  costoIncidencia?: number;
  observaciones?: string;
  origen?: string;
}

// ─── Stats ──────────────────────────────────────────────────
export interface TransporteStats {
  total: number;
  pendientes: number;
  despachados: number;
  alertas: number;
  costoTotal: number;
}

export interface MueblesStats {
  total: number;
  pendientes: number;
  enProceso: number;
  solucionados: number;
  impactoTotal: number;
  plusUnicos: number;
  fabricantes: number;
}

// ─── API Responses ──────────────────────────────────────────
// Envoltura estándar de los endpoints `/api/*`. `code` es el código de negocio
// opcional en errores (p. ej. "CONFLICT"). Ver `src/lib/apiClient.ts`.
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

// Envoltura de listados paginados.
export interface ApiListResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize?: number;
  pages?: number;
}
