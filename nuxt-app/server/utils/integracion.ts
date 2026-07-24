// Port de helpers de src/app/api/integracion/{route,[id]/route}.ts.
export function areaFromRole(role: string): 'MUEBLES' | 'GOURMET' | null {
  if (role === 'OPERACIONES_MUEBLES') return 'MUEBLES'
  if (role === 'OPERACIONES_GOURMET') return 'GOURMET'
  return null
}

// Espejo puntual de MODULE_ACCESS.integracion en src/lib/modulePermissions.ts
// (y su port en app/utils/modulePermissions.ts para el sidebar) — no se
// importa entre server/ y app/ para no acoplar los dos entrypoints de Nitro.
const INTEGRACION_ROLES = ['OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE', 'TRANSPORTE']
export function canSeeIntegracion(role: string): boolean {
  return INTEGRACION_ROLES.includes(role)
}
