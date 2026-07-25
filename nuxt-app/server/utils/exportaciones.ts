// SERVER-ONLY. Lógica de negocio de los módulos de Exportación, portada 1:1 de
// src/lib/exportaciones.ts + src/lib/exportaciones/{paises,delegate}.ts.
// Se duplica la config respecto a app/utils/exportaciones.ts a propósito: Nitro y Vue
// resuelven alias distintos (mismo criterio que server/utils/permissions.ts).
// Mantener ambos en sync.
import { prisma } from './prisma'

export type PaisExport = 'ecuador' | 'mexico' | 'eeuu'

export interface PaisConfigSrv {
  pais: PaisExport
  paisLabel: string
  moduleKey: string
}

export const PAISES_EXPORT_SRV: Record<PaisExport, PaisConfigSrv> = {
  ecuador: { pais: 'ecuador', paisLabel: 'Ecuador', moduleKey: 'exportaciones' },
  mexico: { pais: 'mexico', paisLabel: 'México', moduleKey: 'exportaciones-mexico' },
  eeuu: { pais: 'eeuu', paisLabel: 'EE.UU', moduleKey: 'exportaciones-eeuu' },
}

// ── Roles ────────────────────────────────────────────────────────────
export const GESTORES_EXPORTACIONES = ['ADMIN', 'GERENTE', 'SUPERVISOR_ALMACENAMIENTO']
export const USUARIOS_EXPORTACIONES = ['ETIQUETADO', ...GESTORES_EXPORTACIONES]

export function puedeUsarExportaciones(role: string | null | undefined): boolean {
  return Boolean(role && USUARIOS_EXPORTACIONES.includes(role))
}

export function puedeGestionarExportaciones(role: string | null | undefined): boolean {
  return Boolean(role && GESTORES_EXPORTACIONES.includes(role))
}

// Los helpers puros viven en exportacionesCalc.ts (sin Prisma) porque mapRow.ts
// los necesita y no debe arrastrar el cliente de Prisma. Se re-exportan para que
// los handlers sigan importando todo desde un único sitio.
export {
  normalizePlu,
  todayBogota,
  formatDateOnly,
  calcularDuracionMinutos,
  validarCapturaExportacion,
  parseDay,
} from './exportacionesCalc'

// ── Delegate por país ────────────────────────────────────────────────
// Los 3 modelos tienen forma idéntica (campos y relaciones creadoPor/actualizadoPor),
// así que sus delegates son estructuralmente compatibles. Prisma genera tipos
// distintos por modelo, de ahí el cast.
export type ExportDelegate = Pick<
  typeof prisma.etiquetadoExportacion,
  'findMany' | 'count' | 'create' | 'update' | 'updateMany' | 'findUnique' | 'findFirst' | 'aggregate'
>

export function getExportDelegate(pais: PaisExport): ExportDelegate {
  switch (pais) {
    case 'ecuador':
      return prisma.etiquetadoExportacion as unknown as ExportDelegate
    case 'mexico':
      return prisma.etiquetadoExportacionMexico as unknown as ExportDelegate
    case 'eeuu':
      return prisma.etiquetadoExportacionEeuu as unknown as ExportDelegate
  }
}

export const EXPORT_INCLUDE = {
  creadoPor: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
} as const

/**
 * Filtro de alcance por rol. ÚNICA fuente: ETIQUETADO solo ve sus propios registros;
 * los gestores ven todo y además pueden filtrar por operario.
 * Olvidarlo filtra datos de todos los operarios; aplicarlo a un gestor le deja la
 * lista vacía. Por eso vive aquí y no repetido en cada endpoint.
 */
export function whereScope(
  actor: { id: string; role: string },
  usuarioId?: string,
): Record<string, unknown> {
  const isGestor = puedeGestionarExportaciones(actor.role)
  if (!isGestor) return { creadoPorId: actor.id }
  return usuarioId ? { creadoPorId: usuarioId } : {}
}

/** Filtros de listado compartidos por la lista, el Excel y los conteos. */
export function buildExportWhere(
  actor: { id: string; role: string },
  sp: { q?: string; fecha?: string; usuarioId?: string; estado?: string },
  opts: { scoped?: boolean } = {},
): Record<string, unknown> {
  const { q, fecha, usuarioId, estado } = sp
  return {
    deletedAt: null,
    ...(opts.scoped === false ? (usuarioId ? { creadoPorId: usuarioId } : {}) : whereScope(actor, usuarioId)),
    ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
    ...(estado === 'en-curso' ? { horaFinalizacion: null } : {}),
    ...(estado === 'finalizado' ? { horaFinalizacion: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { numeroCaja: { contains: q, mode: 'insensitive' } },
            { plu: { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}
