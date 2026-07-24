// Port de src/lib/modulePermissions.ts — matriz de visibilidad de módulos por
// rol, usada por el sidebar (nuxt-app/app/layouts/default.vue). Debe mantenerse
// en sync con la fuente de verdad en el app Next.js.

export type ModuleKey =
  | 'transporte'
  | 'preoperacional'
  | 'tienda'
  | 'solicitudes-transporte'
  | 'exportaciones'
  | 'exportaciones-mexico'
  | 'exportaciones-eeuu'
  | 'usuarios'
  | 'auditoria'
  | 'centro-control'
  | 'integracion'
  | 'cargue-gourmet'
  | 'mapa-ciudades'

export const MODULE_ACCESS: Record<ModuleKey, string[]> = {
  transporte: ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN', 'OPERADOR'],
  preoperacional: ['TRANSPORTISTA', 'ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE'],
  tienda: ['TIENDA', 'SUPERVISOR_TIENDA', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  // Sin los roles OPERACIONES_*: son patinadores de área y solo operan Integración
  // de Pedidos (+ Cargue Gourmet el gourmet). Ver src/lib/modulePermissions.ts.
  'solicitudes-transporte': [
    'ADMIN', 'GERENTE', 'OPERADOR', 'INVENTARIO', 'TRANSPORTE',
    'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TRANSPORTE', 'TIENDA', 'SUPERVISOR_TIENDA',
  ],
  exportaciones: ['ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  'exportaciones-mexico': ['ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  'exportaciones-eeuu': ['ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  usuarios: ['ADMIN'],
  auditoria: ['ADMIN', 'GERENTE'],
  'centro-control': [
    'GERENTE', 'ADMIN', 'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TRANSPORTE',
    'SUPERVISOR_TIENDA', 'SUPERVISOR_ALMACENAMIENTO',
  ],
  integracion: [
    'OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE',
    'SUPERVISOR_TRANSPORTE', 'TRANSPORTE',
  ],
  'cargue-gourmet': ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE'],
  'mapa-ciudades': ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE', 'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TIENDA'],
}

export function canSeeModule(role: string | undefined | null, moduleKey: ModuleKey): boolean {
  if (!role) return false
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false
}
