import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditar, esParticipante, ordenPorId, requirePickingActivo } from '../../../utils/muebles'
import { validarAgregarPlu } from '../../../utils/mueblesCalc'
import { normalizePlu } from '../../../utils/exportacionesCalc'
import { datosPlu, resolverPlu } from '../../../utils/maestroMuebles'
import { tipoDePlu } from '../../../utils/tiposMuebles'
import { mapLineaMuebles } from '../../../utils/mapRow'

const schema = z.object({ plu: z.string().min(1).max(100) })

/**
 * POST /api/picking-muebles/:id/plu - ARRANCA EL RELOJ del PLU.
 *
 * El operario escanea el PLU, sale a hacer el picking en NetSuite y vuelve a
 * cerrar la linea con ubicacion, unidades y rotulo. Por eso el reloj arranca
 * aqui y no al abrir la pantalla: mide el trabajo, no el rato que la app estuvo
 * abierta (mismo criterio que el reloj de una tarea de resurtido).
 *
 * Peso, volumen y partes se COPIAN del maestro y se sellan en la linea: si
 * manana se corrige una medida, una capacidad ya calculada no debe moverse.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePickingActivo(event)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  // La pistola suele leer el codigo de barras (EAN) de la etiqueta: se guarda
  // el PLU real, que es el que tiene descripcion y medidas en el maestro.
  const plu = await resolverPlu(normalizePlu(parsed.data.plu))

  const orden = await ordenPorId(id)
  // Cualquier participante puede escanear: la orden puede tener dos operarios
  // cuando hubo un PLU reasignado.
  if (!esParticipante(orden, actor.id)) {
    throw createError({ statusCode: 403, statusMessage: 'No estas trabajando esa orden' })
  }
  if (orden.estado !== 'EN_PICKING') {
    throw createError({ statusCode: 409, statusMessage: 'La orden ya paso a inspeccion' })
  }

  // El "PLU en curso" se mira solo contra los TUYOS: que el companero tenga uno
  // abierto no puede bloquearte. El duplicado si se comprueba contra la orden.
  const err = validarAgregarPlu(orden.lineas, plu, actor.id)
  if (err) throw createError({ statusCode: 409, statusMessage: err })

  const datos = await datosPlu(plu)
  // Clasifica el PLU la primera vez que se ve. No se sella en la linea: si el
  // tipo se corrige despues, el informe debe arreglarse tambien hacia atras.
  await tipoDePlu(plu, datos.descripcion)

  const now = new Date()
  const linea = await prisma.lineaMuebles.create({
    data: {
      ordenId: orden.id,
      plu,
      descripcion: datos.descripcion,
      partes: datos.partes,
      pesoUnitarioKg: datos.pesoUnitarioKg,
      volumenUnitarioM3: datos.volumenUnitarioM3,
      estado: 'EN_PICKING',
      horaInicio: now,
      operarioId: actor.id,
    },
    select: {
      id: true, plu: true, descripcion: true, partes: true, pesoUnitarioKg: true,
      volumenUnitarioM3: true, unidades: true, ubicacion: true, numeroCaja: true,
      volumenTotalM3: true, pesoTotalKg: true, estado: true, horaInicio: true, horaFin: true,
      inspHoraInicio: true, inspHoraFin: true, ebanisteriaInicio: true, ebanisteriaFin: true,
      motivoEbanisteria: true,
      operarioId: true,
      operario: { select: { id: true, name: true } },
      inspector: { select: { id: true, nombre: true } },
      enviadoEbanisteriaPor: { select: { id: true, nombre: true } },
      recibidoEbanisteriaPor: { select: { id: true, nombre: true } },
    },
  })

  await auditar(actor.id, 'CREATE', 'picking-muebles', orden.id, `PLU ${plu} iniciado en ${orden.codigo}`)

  return { success: true, data: { linea: mapLineaMuebles(linea), sinMedidas: datos.sinMedidas } }
})
