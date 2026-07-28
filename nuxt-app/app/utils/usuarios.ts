// Tipos y etiquetas del módulo Usuarios (cliente).

export const USER_ROLES = [
  'ADMIN', 'GERENTE', 'OPERADOR', 'TRANSPORTISTA', 'INVENTARIO', 'TRANSPORTE',
  'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TRANSPORTE', 'TIENDA', 'SUPERVISOR_TIENDA',
  'OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO',
] as const

export type UserRole = typeof USER_ROLES[number]

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  OPERADOR: 'Operador (General)',
  TRANSPORTISTA: 'Transportista (Conductor)',
  INVENTARIO: 'Operario de Inventario',
  TRANSPORTE: 'Operario de Transporte',
  SUPERVISOR_INVENTARIO: 'Supervisor de Inventario',
  SUPERVISOR_TRANSPORTE: 'Supervisor de Transporte',
  TIENDA: 'Operario de Tienda',
  SUPERVISOR_TIENDA: 'Supervisor de Tienda',
  OPERACIONES_MUEBLES: 'Operaciones Muebles',
  OPERACIONES_GOURMET: 'Operaciones Gourmet',
  ETIQUETADO: 'Etiquetado',
  SUPERVISOR_ALMACENAMIENTO: 'Supervisor de Almacenamiento',
}

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  ADMIN: 'Acceso total al sistema.',
  GERENTE: 'Ve todo lo operativo. Sin acceso a configuración ni auditoría.',
  OPERADOR: 'Acceso general a inventario y transporte.',
  TRANSPORTISTA: 'Solo ve el módulo Preoperacional. Requiere vehículo asignado.',
  INVENTARIO: 'Solo solicitudes de transporte.',
  TRANSPORTE: 'Guardados, integración y cargue gourmet.',
  SUPERVISOR_INVENTARIO: 'Solicitudes de transporte.',
  SUPERVISOR_TRANSPORTE: 'Guardados, tienda, integración y preoperacional.',
  TIENDA: 'Facturas contado y solicitudes de transporte.',
  SUPERVISOR_TIENDA: 'Tienda y solicitudes de transporte.',
  OPERACIONES_MUEBLES: 'Solo Integración de Pedidos.',
  OPERACIONES_GOURMET: 'Integración de Pedidos y Cargue Gourmet.',
  ETIQUETADO: 'Solo captura de Exportaciones.',
  SUPERVISOR_ALMACENAMIENTO: 'Gestiona Exportaciones.',
}

// Tono por familia de rol: administración, supervisión y operación.
export const ROLE_TONE: Record<UserRole, string> = {
  ADMIN: 'var(--u-critico)',
  GERENTE: 'var(--bill)',
  SUPERVISOR_INVENTARIO: 'var(--info)',
  SUPERVISOR_TRANSPORTE: 'var(--info)',
  SUPERVISOR_TIENDA: 'var(--info)',
  SUPERVISOR_ALMACENAMIENTO: 'var(--info)',
  OPERADOR: 'var(--muted)',
  TRANSPORTISTA: 'var(--u-aviso)',
  INVENTARIO: 'var(--muted)',
  TRANSPORTE: 'var(--muted)',
  TIENDA: 'var(--muted)',
  OPERACIONES_MUEBLES: 'var(--muted)',
  OPERACIONES_GOURMET: 'var(--muted)',
  ETIQUETADO: 'var(--muted)',
}

export interface Usuario {
  id: string
  email: string
  name: string
  role: UserRole
  active: boolean
  mustChangePassword?: boolean
  createdAt?: string
}

export interface VehiculoOperativo {
  id: string
  placa: string
  tipo: string
  capacidadKg: number | null
  estado: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO'
  transportistas?: { id: string; nombre: string; activo: boolean }[]
}

export interface TransportistaOperativo {
  id: string
  nombre: string
  telefono: string | null
  activo: boolean
  user?: { id: string; name: string; email: string; active: boolean } | null
  vehiculo?: { id: string; placa: string; tipo: string; estado: string } | null
}

export interface TransportistaDisponible {
  id: string
  nombre: string
  telefono: string | null
  vehiculo?: { placa: string; tipo: string; estado: string } | null
}

export function labelRol(r: string): string {
  return ROLE_LABEL[r as UserRole] ?? r
}

export function toneRol(r: string): string {
  return ROLE_TONE[r as UserRole] ?? 'var(--muted)'
}

export function fmtFechaUsuario(iso: string | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}
