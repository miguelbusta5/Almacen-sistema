// Matriz de visibilidad de módulos por rol, lado SERVIDOR.
//
// Es la tercera copia (Next: src/lib/modulePermissions.ts · cliente Nuxt:
// app/utils/modulePermissions.ts · esta). Se duplica porque Nitro y Vue resuelven
// alias distintos — mismo criterio que server/utils/permissions.ts. Las tres deben
// mantenerse en sync; hay un test que lo verifica.
//
// PURO a propósito: sin Prisma ni h3, para que lo puedan importar los helpers de
// cálculo que a su vez consume mapRow.ts.

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
  | 'control-montacargas'
  | 'resurtido'
  | 'recepcion-contenedores'
  | 'montaje-resurtido'
  | 'pendientes'
  | 'indicadores'

export const MODULE_ACCESS: Record<ModuleKey, string[]> = {
  transporte: ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN', 'OPERADOR'],
  preoperacional: ['TRANSPORTISTA', 'ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE'],
  tienda: ['TIENDA', 'SUPERVISOR_TIENDA', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  // Sin los roles OPERACIONES_*: son patinadores de área y solo operan Integración
  // de Pedidos (+ Cargue Gourmet el gourmet).
  'solicitudes-transporte': [
    'ADMIN', 'GERENTE', 'OPERADOR', 'INVENTARIO', 'TRANSPORTE',
    'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TRANSPORTE', 'TIENDA', 'SUPERVISOR_TIENDA',
  ],
  exportaciones: ['ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  'exportaciones-mexico': ['ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  'exportaciones-eeuu': ['ETIQUETADO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  usuarios: ['ADMIN'],
  // Solo ADMIN: /api/activity exige ese rol; antes el menu lo prometia a GERENTE
  // y el servidor le devolvia 403.
  auditoria: ['ADMIN'],
  'centro-control': [
    'GERENTE', 'ADMIN', 'SUPERVISOR_INVENTARIO', 'SUPERVISOR_TRANSPORTE',
    'SUPERVISOR_TIENDA', 'SUPERVISOR_ALMACENAMIENTO',
  ],
  integracion: [
    'OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE',
    'SUPERVISOR_TRANSPORTE', 'TRANSPORTE',
  ],
  'cargue-gourmet': ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE'],
  // Montacarguistas y quien responde por el almacenamiento. Los supervisores de
  // inventario y de transporte quedan fuera: el trabajo de montacargas no es su area.
  'control-montacargas': ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  resurtido: ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Sin MONTACARGAS a proposito: descargan el contenedor y salen en la lista
  // de personas descargando, pero la planilla la lleva siempre el operario.
  'recepcion-contenedores': ['OPERARIO_ALMACENAMIENTO', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Ver el modulo es una cosa; montar un resurtido o asignar un pendiente es
  // otra, y esa va por permiso POR PERSONA (users.puede_montar_resurtido).
  'montaje-resurtido': ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Gourmet pide; almacenamiento asigna. Los operarios ven SUS tareas dentro
  // de Resurtido, no aqui.
  pendientes: ['OPERACIONES_GOURMET', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Tiempo laborado de todo el CEDI: son los numeros con los que se evalua al
  // equipo, asi que solo gestion. El servidor lo exige tambien.
  indicadores: ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
}

export function canSeeModule(role: string | undefined | null, moduleKey: ModuleKey): boolean {
  if (!role) return false
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false
}
