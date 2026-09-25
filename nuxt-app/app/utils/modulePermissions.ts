// Port de src/lib/modulePermissions.ts — matriz de visibilidad de módulos por
// rol, usada por el sidebar (nuxt-app/app/layouts/default.vue). Debe mantenerse
// en sync con la fuente de verdad en el app Next.js.

export type ModuleKey =
  | 'stretch-film'
  | 'inventarios'
  | 'capacidad-picking'
  | 'transporte'
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
  | 'picking-muebles'
  | 'inspeccion-muebles'
  | 'indicadores-muebles'
  | 'admin-muebles'
  | 'tareas-generales'
  | 'entrega-muebles'
  | 'historial-muebles'
  | 'cargue-camiones'
  | 'indicadores-transporte'

export const MODULE_ACCESS: Record<ModuleKey, string[]> = {
  'stretch-film': ['ADMIN', 'GERENTE', 'SUPERVISOR_ALMACENAMIENTO', 'OPERACIONES_GOURMET'],
  inventarios: ['ADMIN', 'SUPERVISOR_INVENTARIO', 'INVENTARIO', 'GERENTE', 'OPERADOR'],
  'capacidad-picking': ['ADMIN', 'GERENTE', 'SUPERVISOR_ALMACENAMIENTO', 'OPERARIO_ALMACENAMIENTO', 'MONTACARGAS', 'INVENTARIO', 'SUPERVISOR_INVENTARIO', 'OPERADOR'],
  transporte: ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN', 'OPERADOR'],
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
  // Picking de muebles: el operario solo ve su propia bandeja. Los roles
  // OPERACIONES_* quedan fuera — coordinan Integración, no pickean.
  'picking-muebles': ['PICKING_MUEBLES', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Login compartido del área: 2 PCs para ~5 inspectores. La trazabilidad la da
  // el catálogo de inspectores, no la autenticación.
  'inspeccion-muebles': ['INSPECCION_MUEBLES', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Los numeros con los que se evalua al area: solo gestion.
  'indicadores-muebles': ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Equipos, inspectores, asignacion del dia y tipos de PLU. Solo gestion.
  'admin-muebles': ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  // Lo que manda supervision y no cabe en ningun modulo. Se le asigna a
  // operarios de almacenamiento y montacarguistas, los disponibles para lo que salga; el
  // operario entra a ver SOLO lo suyo y crear/cerrar es de supervision.
  // El patinador entrega a transporte lo que ya quedo inspeccionado. Es su
  // unico modulo: no pickea ni inspecciona.
  // Consultar como quedaron los tiempos de cada orden. Corregir es solo ADMIN
  // (lo exige el servidor).
  'historial-muebles': ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  'entrega-muebles': ['PATINADOR_MUEBLES', 'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'],
  'tareas-generales': ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN', 'OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'],
  // Cargue de camiones (25-09): el equipo de transporte sube las ordenes al camion.
  'cargue-camiones': ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  // Area «Transporte» de Indicadores. Solo gestion.
  'indicadores-transporte': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
}

export function canSeeModule(role: string | undefined | null, moduleKey: ModuleKey): boolean {
  if (!role) return false
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false
}
