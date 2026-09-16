import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { requireAuth } from '../../../../../utils/auth'
import { auditar, ordenPorId, ORDEN_INCLUDE } from '../../../../../utils/muebles'
import { totalesLinea } from '../../../../../utils/mueblesCalc'
import { normalizePlu } from '../../../../../utils/exportacionesCalc'
import { datosPlu, existePlu } from '../../../../../utils/maestroMuebles'
import { tipoDePlu } from '../../../../../utils/tiposMuebles'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const hora = z.string().datetime({ offset: true }).nullable().optional()

const schema = z.object({
  motivo: z.string().trim().min(5, 'Escribe por qué se corrige (mínimo 5 letras)').max(300),
  plu: z.string().trim().min(1).max(100).optional(),
  ubicacion: z.string().trim().max(120).nullable().optional(),
  numeroCaja: z.string().trim().max(60).nullable().optional(),
  unidades: z.number().int().min(1).max(10000).optional(),
  horaInicio: hora,
  horaFin: hora,
  inspHoraInicio: hora,
  inspHoraFin: hora,
})

const fmt = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null || v === '' ? '—' : String(v))

/**
 * POST /api/historial-muebles/:id/linea/:lineaId/corregir - SOLO ADMIN.
 *
 * Para lo que se escaneo mal (el PLU 28138 que quedo con la ubicacion en el
 * campo del PLU) o una hora que quedo abierta. El motivo es obligatorio y cada
 * campo cambiado queda en la bitacora con su valor anterior: una cifra de
 * tiempo corregida a mano tiene que poder explicarse despues.
 *
 * Si cambia el PLU se vuelven a traer del maestro la descripcion y las medidas,
 * y si cambian el PLU o las unidades se recalculan el volumen y el peso.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (actor.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Solo el administrador corrige órdenes' })
  }
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const orden = await ordenPorId(id)
  const linea = await prisma.lineaMuebles.findFirst({ where: { id: lineaId, ordenId: orden.id } })
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })

  const data: Record<string, unknown> = {}
  const cambios: string[] = []
  const cambiar = (campo: string, etiqueta: string, antes: unknown, despues: unknown) => {
    if (fmt(antes) === fmt(despues)) return
    data[campo] = despues
    cambios.push(`${etiqueta}: ${fmt(antes)} -> ${fmt(despues)}`)
  }

  // ── PLU: tiene que existir y no repetirse en la orden ──
  let medidas: Awaited<ReturnType<typeof datosPlu>> | null = null
  if (d.plu !== undefined) {
    const plu = normalizePlu(d.plu)
    if (plu !== linea.plu) {
      if (!(await existePlu(plu))) throw createError({ statusCode: 400, statusMessage: `El PLU ${plu} no está en el maestro` })
      const repetido = await prisma.lineaMuebles.findFirst({ where: { ordenId: orden.id, plu, id: { not: linea.id } }, select: { id: true } })
      if (repetido) throw createError({ statusCode: 409, statusMessage: `El PLU ${plu} ya está en esta orden` })
      medidas = await datosPlu(plu)
      await tipoDePlu(plu, medidas.descripcion)
      cambiar('plu', 'PLU', linea.plu, plu)
      data.descripcion = medidas.descripcion
      data.partes = medidas.partes
      data.pesoUnitarioKg = medidas.pesoUnitarioKg
      data.volumenUnitarioM3 = medidas.volumenUnitarioM3
    }
  }

  if (d.ubicacion !== undefined) cambiar('ubicacion', 'Ubicacion', linea.ubicacion, d.ubicacion || null)
  if (d.numeroCaja !== undefined) cambiar('numeroCaja', 'Rotulo', linea.numeroCaja, d.numeroCaja || null)
  if (d.unidades !== undefined) cambiar('unidades', 'Unidades', linea.unidades, d.unidades)

  // Volumen y peso con el PLU y las unidades que quedan.
  if (medidas || data.unidades !== undefined) {
    const unidades = (data.unidades as number | undefined) ?? linea.unidades
    const peso = medidas ? medidas.pesoUnitarioKg : (linea.pesoUnitarioKg == null ? null : Number(linea.pesoUnitarioKg))
    const volumen = medidas ? medidas.volumenUnitarioM3 : (linea.volumenUnitarioM3 == null ? null : Number(linea.volumenUnitarioM3))
    const t = totalesLinea(unidades, volumen, peso)
    data.volumenTotalM3 = t.volumenTotalM3
    data.pesoTotalKg = t.pesoTotalKg
  }

  // ── Horas ──
  const aFecha = (v: string | null | undefined) => (v == null ? null : new Date(v))
  if (d.horaInicio !== undefined) {
    if (d.horaInicio == null) throw createError({ statusCode: 400, statusMessage: 'El inicio del picking no puede quedar vacío' })
    cambiar('horaInicio', 'Inicio picking', linea.horaInicio, aFecha(d.horaInicio))
  }
  if (d.horaFin !== undefined) cambiar('horaFin', 'Fin picking', linea.horaFin, aFecha(d.horaFin))
  if (d.inspHoraInicio !== undefined) cambiar('inspHoraInicio', 'Inicio inspeccion', linea.inspHoraInicio, aFecha(d.inspHoraInicio))
  if (d.inspHoraFin !== undefined) cambiar('inspHoraFin', 'Fin inspeccion', linea.inspHoraFin, aFecha(d.inspHoraFin))

  const final = <K extends keyof typeof linea>(k: K) => (k in data ? data[k as string] : linea[k]) as Date | null
  const ini = final('horaInicio'), fin = final('horaFin'), iIni = final('inspHoraInicio'), iFin = final('inspHoraFin')
  if (ini && fin && fin < ini) throw createError({ statusCode: 400, statusMessage: 'El fin del picking no puede ser antes del inicio' })
  if (iIni && iFin && iFin < iIni) throw createError({ statusCode: 400, statusMessage: 'El fin de la inspección no puede ser antes del inicio' })
  if (iFin && !iIni) throw createError({ statusCode: 400, statusMessage: 'Falta el inicio de la inspección' })

  if (cambios.length === 0) throw createError({ statusCode: 400, statusMessage: 'No cambiaste nada' })

  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.lineaMuebles.update({ where: { id: linea.id }, data })
    return tx.ordenMuebles.update({
      where: { id: orden.id },
      data: { actualizadoPorId: actor.id, motivoCorreccion: d.motivo },
      include: ORDEN_INCLUDE,
    })
  })

  // Empieza por "Correccion": el detalle del historial las lista por ese prefijo.
  await auditar(
    actor.id, 'UPDATE', 'picking-muebles', orden.id,
    `Correccion en ${orden.codigo}, PLU ${linea.plu}: ${cambios.join('; ')}. Motivo: ${d.motivo}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
