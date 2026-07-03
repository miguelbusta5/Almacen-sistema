// Matriz de permisos por rol — portada 1:1 desde src/lib/permissions.ts.
export type Action = 'create' | 'edit' | 'delete' | 'manageUsers' | 'viewAudit' | 'manageLogistica'

const CREADORES = [
  'OPERADOR', 'GERENTE', 'ADMIN',
  'INVENTARIO', 'SUPERVISOR_INVENTARIO',
  'TRANSPORTE', 'SUPERVISOR_TRANSPORTE',
  'TIENDA', 'SUPERVISOR_TIENDA',
  'OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET',
  'ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO',
]

const MATRIX: Record<Action, string[]> = {
  create: CREADORES,
  edit: ['GERENTE', 'ADMIN', 'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TRANSPORTE', 'SUPERVISOR_ALMACENAMIENTO'],
  delete: ['ADMIN'],
  manageUsers: ['ADMIN'],
  viewAudit: ['ADMIN'],
  manageLogistica: [],
}

export function can(role: string | null | undefined, action: Action): boolean {
  if (!role) return false
  return MATRIX[action].includes(role)
}

export function canViewPendientes(role: string): boolean {
  return role === 'TRANSPORTE' || ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'].includes(role)
}
