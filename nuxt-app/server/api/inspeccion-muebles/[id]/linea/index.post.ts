import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../utils/muebles'
import { totalesLinea } from '../../../../utils/mueblesCalc'
import { normalizePlu } from '../../../../utils/exportacionesCalc'
import { datosPlu, resolverPlu } from '../../../../utils/maestroMuebles'
import { tipoDePlu } from '../../../../utils/tiposMuebles'
import { mapOrdenMuebles } from '../../../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  plu: z.string().min(1).max(100),
  unidades: z.number().int().positive(),
})

/**
 * POST /api/inspeccion-muebles/:id/linea - agregar un PLU a la orden.
 *
 * Hay ordenes en las que llega mercancia de tienda que nadie pickeo aqui. Sin
 * esto, el inspector no tenia donde registrarla y quedaba fuera de la orden.
 *
 * El PLU entra ya pickeado (reloj de picking en cero: nadie lo bajo del rack) y
 * se inspecciona como cualquier otro.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data
  const plu = await resolverPlu(normalizePlu(d.plu))

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden no esta en inspeccion' })
  }
  if (orden.lineas.some((l) => l.plu === plu)) {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU ya esta en la orden' })
  }

  const inspector = await prisma.inspector.findFirst({
    where: { id: d.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const datos = await datosPlu(plu)
  await tipoDePlu(plu, datos.descripcion)
  const totales = totalesLinea(d.unidades, datos.volumenUnitarioM3, datos.pesoUnitarioKg)

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.lineaMuebles.create({
      data: {
        ordenId: orden.id,
        plu,
        descripcion: datos.descripcion,
        partes: datos.partes,
        pesoUnitarioKg: datos.pesoUnitarioKg,
        volumenUnitarioM3: datos.volumenUnitarioM3,
        unidades: d.unidades,
        volumenTotalM3: totales.volumenTotalM3,
        pesoTotalKg: totales.pesoTotalKg,
        estado: 'PICKEADA',
        // Sin tiempo de picking: no lo bajo nadie de este almacen.
        horaInicio: now,
        horaFin: now,
        operarioId: orden.operarioId,
      },
    })
    // La orden pudo quedar INSPECCIONADA por los PLU anteriores; con uno nuevo
    // vuelve a estar abierta.
    if (orden.estado !== 'EN_INSPECCION') {
      await tx.ordenMuebles.update({
        where: { id: orden.id },
        data: { estado: 'EN_INSPECCION', horaFinInspeccion: null },
      })
    }
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'CREATE', 'inspeccion-muebles', orden.id,
    `${inspector.nombre} agrego el PLU ${plu} x${d.unidades} a ${orden.codigo}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada), sinMedidas: datos.sinMedidas }
})
