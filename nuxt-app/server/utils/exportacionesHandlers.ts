// SERVER-ONLY. Factories de handlers Nitro para los módulos de Exportación,
// parametrizadas por país (delegate de Prisma + moduleKey para el ActivityLog).
// Port 1:1 de src/lib/exportaciones/handlersFactory.ts — misma validación, mismos
// códigos de estado y mismos mensajes de error, para que el flip entre stacks sea
// invisible para el cliente.
import { defineEventHandler, getQuery, getRouterParam, readBody, setResponseStatus, setHeader, createError } from 'h3'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { prisma } from './prisma'
import { requireAuth } from './auth'
import { mapExportacion } from './mapRow'
import {
  buildExportWhere,
  calcularDuracionMinutos,
  EXPORT_INCLUDE,
  formatDateOnly,
  getExportDelegate,
  normalizePlu,
  parseDay,
  puedeGestionarExportaciones,
  puedeUsarExportaciones,
  todayBogota,
  validarCapturaExportacion,
  whereScope,
  type PaisConfigSrv,
} from './exportaciones'

function assertUsuario(role: string) {
  if (!puedeUsarExportaciones(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Exportaciones' })
  }
}

function assertGestor(role: string, mensaje = 'No autorizado') {
  if (!puedeGestionarExportaciones(role)) {
    throw createError({ statusCode: 403, statusMessage: mensaje })
  }
}

function filtrosDeQuery(sp: Record<string, unknown>) {
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined)
  return { q: str(sp.q), fecha: str(sp.fecha), usuarioId: str(sp.usuarioId), estado: str(sp.estado) }
}

// ── GET lista ─────────────────────────────────────────────
export function makeListHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertUsuario(actor.role)

    const sp = getQuery(event)
    const page = Math.max(1, Number(sp.page || 1))
    const pageSize = Math.min(100, Math.max(10, Number(sp.pageSize || 40)))
    const where = buildExportWhere(actor, filtrosDeQuery(sp))

    const [items, total] = await Promise.all([
      delegate.findMany({
        where: where as never,
        include: EXPORT_INCLUDE,
        orderBy: [{ horaInicio: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      delegate.count({ where: where as never }),
    ])

    return { success: true, data: items.map(mapExportacion), total, page, pageSize }
  })
}

// ── POST crear ────────────────────────────────────────────
const createSchema = z.object({
  numeroCaja: z.string().min(1).max(100),
  plu: z.string().min(1).max(100),
  unidadEmpaque: z.number().int().min(1),
})

export function makeCreateHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertUsuario(actor.role)

    const parsed = createSchema.safeParse(await readBody(event).catch(() => null))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
    }
    const validation = validarCapturaExportacion(parsed.data)
    if (validation) throw createError({ statusCode: 400, statusMessage: validation })

    const plu = normalizePlu(parsed.data.plu)
    const producto = await prisma.productoMaestro.findUnique({
      where: { plu },
      select: { descripcion: true },
    })
    if (!producto?.descripcion?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'PLU no encontrado en maestro' })
    }
    const descripcion = producto.descripcion.trim()

    const now = new Date()
    // Auto-finaliza el registro abierto del usuario y crea el nuevo en una sola
    // transacción. FORMA DE ARRAY A PROPÓSITO: el create no depende del resultado
    // del updateMany. NO convertir a callback `$transaction(async tx => ...)`: si el
    // delegate se reconstruye mal desde `tx`, el updateMany corre fuera de la
    // transacción y el operario acaba con DOS registros abiertos a la vez.
    // El cierre aplica solo a este país, y eso es correcto: se puede tener una caja
    // abierta en Ecuador y otra en México simultáneamente.
    const [, created] = await prisma.$transaction([
      delegate.updateMany({
        where: { creadoPorId: actor.id, horaFinalizacion: null, deletedAt: null },
        data: { horaFinalizacion: now },
      }),
      delegate.create({
        data: {
          numeroCaja: parsed.data.numeroCaja.trim(),
          plu,
          descripcion,
          unidadEmpaque: parsed.data.unidadEmpaque,
          fecha: todayBogota(now),
          horaInicio: now,
          creadoPorId: actor.id,
        },
        include: EXPORT_INCLUDE,
      }),
    ])

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: 'CREATE',
        module: cfg.moduleKey,
        recordId: created.id,
        details: `Caja ${created.numeroCaja} PLU ${created.plu}`,
      },
    }).catch(() => {})

    setResponseStatus(event, 201)
    return { success: true, data: mapExportacion(created) }
  })
}

// ── PATCH ─────────────────────────────────────────────────
const patchSchema = z.object({
  numeroCaja: z.string().min(1).max(100).optional(),
  plu: z.string().min(1).max(100).optional(),
  unidadEmpaque: z.number().int().min(1).optional(),
  horaInicio: z.string().datetime().optional(),
  horaFinalizacion: z.string().datetime().optional().nullable(),
  motivoCorreccion: z.string().min(5).optional(),
})

export function makePatchHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertUsuario(actor.role)

    const id = getRouterParam(event, 'id')!
    const parsed = patchSchema.safeParse(await readBody(event).catch(() => null))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
    }
    const d = parsed.data

    const current = await delegate.findUnique({
      where: { id },
      select: { deletedAt: true, creadoPorId: true },
    })
    if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

    const isGestor = puedeGestionarExportaciones(actor.role)
    const isOwner = current.creadoPorId === actor.id
    if (!isGestor && !isOwner) {
      throw createError({ statusCode: 403, statusMessage: 'Solo puedes editar tus propios registros' })
    }

    const cambiaHoras = d.horaInicio !== undefined || d.horaFinalizacion !== undefined
    if (cambiaHoras && !isGestor) {
      throw createError({ statusCode: 403, statusMessage: 'Solo gestores pueden modificar las horas' })
    }
    if (cambiaHoras && !d.motivoCorreccion?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Motivo de correccion obligatorio para modificar horas' })
    }

    const data: Record<string, unknown> = {
      actualizadoPorId: actor.id,
      ...(d.numeroCaja !== undefined && { numeroCaja: d.numeroCaja.trim() }),
      ...(d.unidadEmpaque !== undefined && { unidadEmpaque: d.unidadEmpaque }),
      ...(d.horaInicio !== undefined && { horaInicio: new Date(d.horaInicio) }),
      ...(d.horaFinalizacion !== undefined && {
        horaFinalizacion: d.horaFinalizacion ? new Date(d.horaFinalizacion) : null,
      }),
      ...(d.motivoCorreccion !== undefined && { motivoCorreccion: d.motivoCorreccion.trim() }),
    }

    if (d.plu !== undefined) {
      const plu = normalizePlu(d.plu)
      const producto = await prisma.productoMaestro.findUnique({ where: { plu }, select: { descripcion: true } })
      if (!producto?.descripcion?.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'PLU no encontrado en maestro' })
      }
      data.plu = plu
      data.descripcion = producto.descripcion.trim()
    }

    const row = await delegate.update({ where: { id }, data: data as never, include: EXPORT_INCLUDE })

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: 'UPDATE',
        module: cfg.moduleKey,
        recordId: id,
        details: d.motivoCorreccion ?? 'Correccion de registro exportaciones',
      },
    }).catch(() => {})

    return { success: true, data: mapExportacion(row) }
  })
}

// ── DELETE (borrado lógico) ───────────────────────────────
export function makeDeleteHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertGestor(actor.role, 'Solo gestion puede eliminar Exportaciones')

    const id = getRouterParam(event, 'id')!
    // El motivo llega por query: el body de un DELETE no siempre sobrevive al
    // transporte. Fallback al body por compatibilidad con el cliente viejo.
    const sp = getQuery(event)
    const body = (await readBody(event).catch(() => null)) as { motivoCorreccion?: unknown } | null
    const fromQuery = typeof sp.motivo === 'string' ? sp.motivo.trim() : ''
    const fromBody = typeof body?.motivoCorreccion === 'string' ? body.motivoCorreccion.trim() : ''
    const reason = fromQuery || fromBody || 'Borrado logico'

    const current = await delegate.findUnique({ where: { id }, select: { deletedAt: true } })
    if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

    const row = await delegate.update({
      where: { id },
      data: { deletedAt: new Date(), actualizadoPorId: actor.id, motivoCorreccion: reason },
      include: EXPORT_INCLUDE,
    })

    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'DELETE', module: cfg.moduleKey, recordId: id, details: reason },
    }).catch(() => {})

    return { success: true, data: mapExportacion(row) }
  })
}

// ── POST finalize ─────────────────────────────────────────
export function makeFinalizeHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertUsuario(actor.role)

    const id = getRouterParam(event, 'id')!
    const record = await delegate.findUnique({
      where: { id },
      select: { creadoPorId: true, horaFinalizacion: true, deletedAt: true },
    })

    if (!record || record.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
    if (record.creadoPorId !== actor.id) {
      throw createError({ statusCode: 403, statusMessage: 'Solo puedes finalizar tus propios registros' })
    }
    if (record.horaFinalizacion) {
      throw createError({ statusCode: 409, statusMessage: 'El registro ya está finalizado' })
    }

    const updated = await delegate.update({
      where: { id },
      data: { horaFinalizacion: new Date(), actualizadoPorId: actor.id },
      include: EXPORT_INCLUDE,
    })

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: 'UPDATE',
        module: cfg.moduleKey,
        recordId: id,
        details: 'Rotulación finalizada manualmente',
      },
    }).catch(() => {})

    return { success: true, data: mapExportacion(updated) }
  })
}

// ── GET abierto ───────────────────────────────────────────
// Registro en curso del actor, independiente de filtros y paginación.
// La versión React lo derivaba de la página visible de la lista: al filtrar o pasar
// a la página 2 el banner desaparecía aunque hubiera una caja abierta, y la
// siguiente captura la cerraba en silencio.
export function makeAbiertoHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertUsuario(actor.role)

    const row = await delegate.findFirst({
      where: { creadoPorId: actor.id, horaFinalizacion: null, deletedAt: null },
      include: EXPORT_INCLUDE,
      orderBy: [{ horaInicio: 'desc' }],
    })

    return { success: true, data: row ? mapExportacion(row) : null }
  })
}

// ── GET conteos (KPIs del día) ────────────────────────────
export function makeConteosHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertUsuario(actor.role)

    // Mismo alcance que el listado: ETIQUETADO ve sus números, gestores el total.
    const scope = whereScope(actor)
    const hoy = todayBogota()

    const [delDia, enCurso] = await Promise.all([
      delegate.findMany({
        where: { ...scope, deletedAt: null, fecha: hoy } as never,
        select: { unidadEmpaque: true, horaInicio: true, horaFinalizacion: true },
      }),
      delegate.count({ where: { ...scope, deletedAt: null, horaFinalizacion: null } as never }),
    ])

    let unidadesHoy = 0
    let finalizadas = 0
    let duracionTotal = 0
    for (const r of delDia) {
      unidadesHoy += Math.round(r.unidadEmpaque)
      if (r.horaFinalizacion) {
        finalizadas++
        const min = calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion)
        if (min) duracionTotal += min
      }
    }

    return {
      success: true,
      data: {
        cajasHoy: delDia.length,
        enCurso,
        unidadesHoy,
        promedioMin: finalizadas > 0 ? Math.round((duracionTotal / finalizadas) * 10) / 10 : null,
      },
    }
  })
}

// ── GET operarios ─────────────────────────────────────────
export function makeOperariosHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertGestor(actor.role)

    const rows = await delegate.findMany({
      where: { deletedAt: null },
      distinct: ['creadoPorId'],
      select: { creadoPorId: true, creadoPor: { select: { name: true } } },
    })

    const data = rows
      .map((r) => ({ id: r.creadoPorId, nombre: r.creadoPor?.name ?? 'Usuario' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

    return { success: true, data }
  })
}

// ── GET stats (productividad) ─────────────────────────────
export function makeStatsHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertGestor(actor.role)

    const sp = getQuery(event)
    const fechaParam = sp.fecha ? String(sp.fecha) : null
    const today = todayBogota()
    let desde = parseDay(sp.desde ? String(sp.desde) : null) ?? parseDay(fechaParam) ?? today
    let hasta = parseDay(sp.hasta ? String(sp.hasta) : null) ?? parseDay(fechaParam) ?? today
    if (desde.getTime() > hasta.getTime()) [desde, hasta] = [hasta, desde]

    const registros = await delegate.findMany({
      where: { fecha: { gte: desde, lte: hasta }, deletedAt: null },
      select: {
        plu: true,
        unidadEmpaque: true,
        horaInicio: true,
        horaFinalizacion: true,
        creadoPorId: true,
        creadoPor: { select: { name: true } },
      },
    })

    // Agregación en memoria a propósito: plusDistintos necesita un Set y el
    // promedio depende de calcularDuracionMinutos. No convertir a groupBy.
    const byUser = new Map<string, {
      nombre: string
      cajas: number
      plusSet: Set<string>
      duracionTotal: number
      finalizadas: number
      totalUnidades: number
    }>()

    for (const r of registros) {
      if (!byUser.has(r.creadoPorId)) {
        byUser.set(r.creadoPorId, {
          nombre: r.creadoPor?.name ?? 'Usuario',
          cajas: 0,
          plusSet: new Set(),
          duracionTotal: 0,
          finalizadas: 0,
          totalUnidades: 0,
        })
      }
      const u = byUser.get(r.creadoPorId)!
      u.cajas++
      u.plusSet.add(r.plu)
      u.totalUnidades += Math.round(r.unidadEmpaque)
      if (r.horaFinalizacion) {
        u.finalizadas++
        const min = calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion)
        if (min) u.duracionTotal += min
      }
    }

    const data = Array.from(byUser.entries())
      .map(([id, u]) => ({
        id,
        nombre: u.nombre,
        cajas: u.cajas,
        plusDistintos: u.plusSet.size,
        totalUnidades: Math.round(u.totalUnidades),
        finalizadas: u.finalizadas,
        duracionTotalMin: u.duracionTotal,
        promedioPorCajaMin:
          u.finalizadas > 0 ? Math.round((u.duracionTotal / u.finalizadas) * 10) / 10 : null,
      }))
      .sort((a, b) => b.cajas - a.cajas)

    return {
      success: true,
      data,
      rango: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    }
  })
}

// ── GET export (Excel) ────────────────────────────────────
export function makeExportHandler(cfg: PaisConfigSrv) {
  const delegate = getExportDelegate(cfg.pais)

  const fmtHora = (d: Date): string =>
    new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d)

  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    assertGestor(actor.role, 'Sin permiso para exportar')

    // scoped:false — el endpoint ya es gestor-only, así que no se filtra por dueño.
    const where = buildExportWhere(actor, filtrosDeQuery(getQuery(event)), { scoped: false })

    const registros = await delegate.findMany({
      where: where as never,
      include: EXPORT_INCLUDE,
      orderBy: [{ horaInicio: 'desc' }],
      take: 5000,
    })

    const headers = [
      'País destino', 'Fecha', 'N° Caja', 'PLU', 'Descripción', 'Unidad empaque',
      'Hora inicio', 'Hora finalización', 'Duración (min)', 'Estado',
      'Reguero', 'Cantidad reguero', 'Motivo corrección', 'Creado por', 'Actualizado por',
    ]

    const rows: (string | number | null)[][] = registros.map((r) => [
      cfg.paisLabel,
      formatDateOnly(r.fecha) ?? '',
      r.numeroCaja,
      r.plu,
      r.descripcion,
      r.unidadEmpaque,
      fmtHora(r.horaInicio),
      r.horaFinalizacion ? fmtHora(r.horaFinalizacion) : '',
      calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion) ?? '',
      r.horaFinalizacion ? 'Finalizado' : 'En curso',
      r.hayReguero ? 'Sí' : 'No',
      r.cantidadReguero ?? '',
      r.motivoCorreccion ?? '',
      r.creadoPor?.name ?? '',
      r.actualizadoPor?.name ?? '',
    ])

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`Exportaciones ${cfg.paisLabel}`)
    ws.addRows([headers, ...rows])
    ws.columns = [16, 12, 14, 12, 32, 14, 18, 18, 14, 12, 9, 14, 28, 22, 22].map((width) => ({ width }))

    const buf = await wb.xlsx.writeBuffer()
    const today = new Date().toISOString().slice(0, 10)

    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    setHeader(event, 'Content-Disposition', `attachment; filename="exportaciones-${cfg.pais}-${today}.xlsx"`)
    return Buffer.from(buf)
  })
}
