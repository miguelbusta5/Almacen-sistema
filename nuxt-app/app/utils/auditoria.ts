// Tipos y etiquetas del registro de auditoría (cliente).

export interface LogUser { id: string; name: string; email: string }

export interface LogItem {
  id: string
  action: string
  module: string
  recordId: string
  details: string | null
  createdAt: string
  user: LogUser | null
}

// Etiquetas de las 10 acciones que existen hoy en la tabla. Cualquier valor nuevo
// cae al crudo en vez de desaparecer — los `action` son strings libres.
export const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Creó',
  UPDATE: 'Editó',
  EDIT: 'Editó',
  DELETE: 'Eliminó',
  MOVE: 'Movió',
  REJECT: 'Rechazó',
  RESUBMIT: 'Reenvió',
  IMPORT: 'Importó',
  COMPLETE_AREA2: 'Completó área 2',
  MARK_COMPLETE: 'Marcó completada',
}

export const ACTION_TONE: Record<string, string> = {
  CREATE: 'var(--u-ok)',
  UPDATE: 'var(--info)',
  EDIT: 'var(--info)',
  DELETE: 'var(--u-critico)',
  MOVE: 'var(--bill)',
  REJECT: 'var(--u-critico)',
  RESUBMIT: 'var(--u-aviso)',
  IMPORT: 'var(--bill)',
  COMPLETE_AREA2: 'var(--u-ok)',
  MARK_COMPLETE: 'var(--u-ok)',
}

// Los 14 módulos presentes en la tabla, incluidos los históricos (`muebles`,
// `logistica`, `conteo`) que ya no tienen módulo vivo pero sí filas registradas.
export const MODULE_LABEL: Record<string, string> = {
  'cargue-gourmet': 'Cargue Gourmet',
  exportaciones: 'Exportaciones Ecuador',
  'exportaciones-mexico': 'Exportaciones México',
  'exportaciones-eeuu': 'Exportaciones EE.UU',
  tienda: 'Facturas Contado',
  transporte: 'Guardados',
  integracion: 'Integración Pedidos',
  preoperacional: 'Preoperacional',
  'solicitudes-transporte': 'Solicitudes Transporte',
  usuarios: 'Usuarios',
  'productos-maestro': 'Productos Maestro',
  muebles: 'Muebles (histórico)',
  logistica: 'Logística (histórico)',
  conteo: 'Conteo (histórico)',
}

export function labelAccion(v: string): string {
  return ACTION_LABEL[v] ?? v
}

export function toneAccion(v: string): string {
  return ACTION_TONE[v] ?? 'var(--muted)'
}

export function labelModulo(v: string): string {
  return MODULE_LABEL[v] ?? v
}

export function fmtFechaHoraLog(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}
