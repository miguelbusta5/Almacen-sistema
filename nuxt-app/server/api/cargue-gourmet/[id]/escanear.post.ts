import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { clasificarEscaneoGourmet, type ModoCodigoGourmet } from '../../../utils/gourmetEscaneo'
import { validarCodigoCaja } from '../../../utils/gourmetCaja'

const ROLES_PERMITIDOS = ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']

const bodySchema = z.object({
  codigo: z.string().max(150),
  // Solo relevante para pedidos MUEBLES: el mueble viene en más de una
  // parte física con el mismo número de caja impreso — permite repetir el
  // código sin marcarlo DUPLICADO, contando cada parte como una caja más.
  tieneParte2: z.boolean().optional(),
})

// Antes existía un heurístico "QR_SOLO_ORDEN": si había 2+ códigos de caja
// registrados y todos eran iguales, se asumía un caso legado (código = mero
// placeholder del número de orden) y se comparaba el escaneo contra el
// número de orden en vez del código real. Se eliminó por completo — probó
// ser inseguro en más de un pedido real: cualquier vía que deje códigos
// duplicados registrados (MUEBLES a propósito, o un bug/condición de
// carrera en GOURMET, donde nunca debería pasar) hacía que una caja
// correcta se marcara "Caja ajena" solo por no contener el número de
// orden. Ahora, si hay algún código de caja registrado (los que sean),
// siempre se compara contra esos códigos reales — sin excepciones.
function determinarModoCodigo(codigosCaja: string[]): ModoCodigoGourmet {
  return codigosCaja.length === 0 ? 'SIN_CODIGOS_PREVIOS' : 'QR_UNICO_CAJA'
}

// POST /api/cargue-gourmet/[id]/escanear
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'El campo codigo es obligatorio' })
  const { codigo, tieneParte2 } = parsed.data

  // Pedido + sus códigos de caja + el cargue activo en UNA sola consulta —
  // antes eran dos round-trips separados (findUnique + findFirst) por cada
  // escaneo, y el escaneo es la ruta más caliente del módulo.
  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: {
      id: true, orden: true, estado: true, tipoPedido: true,
      cajas: { select: { codigoCaja: true } },
      cargues: { where: { estado: 'EN_CARGUE' }, select: { id: true }, take: 1 },
    },
  })
  if (!pedido) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  // Rompe a propósito la regla de "no repetir caja" — solo para pedidos
  // MUEBLES y solo cuando el operario marca explícitamente que esta caja es
  // otra parte del mismo mueble (sin límite de partes: 2ª, 3ª, 4ª…).
  const permitirRepetirCaja = pedido.tipoPedido === 'MUEBLES' && tieneParte2 === true

  if (pedido.estado !== 'EN_CARGUE') {
    throw createError({ statusCode: 409, statusMessage: `No se puede escanear: el pedido está en estado ${pedido.estado}`, data: { code: 'ESTADO_INVALIDO' } })
  }

  const cargueActivo = pedido.cargues[0]
  if (!cargueActivo) throw createError({ statusCode: 409, statusMessage: 'No hay un cargue activo para este pedido' })

  // Mismo rechazo de códigos de orden (TSDM/OVDM) que ya aplican la
  // creación del pedido y "agregar caja manual" — sin esto, en modo
  // SIN_CODIGOS_PREVIOS (pedido sin cajas registradas) escanear el propio
  // código de la orden contaba como una caja válida repetible.
  const codigoValidacion = validarCodigoCaja(codigo, { permitirLetras: pedido.tipoPedido === 'MUEBLES' })
  if (!codigoValidacion.ok) throw createError({ statusCode: 400, statusMessage: codigoValidacion.error })

  const codigosCaja = pedido.cajas.map((c) => c.codigoCaja).filter((c): c is string => !!c)
  const modoCodigo = determinarModoCodigo(codigosCaja)

  // La clasificación (¿es duplicado?) y la escritura van juntas dentro de la
  // misma transacción, con el cargue bloqueado (FOR UPDATE) — así dos
  // escaneos casi simultáneos del mismo código (doble tap, reintento de
  // red) se serializan: el segundo espera a que el primero termine y
  // entonces sí ve el escaneo recién insertado. Antes esta lectura ocurría
  // fuera de la transacción y ambos requests podían leer la lista "vacía"
  // al mismo tiempo, contando dos veces una caja que debía rechazarse la
  // segunda vez. La fórmula de `permitirRepetirCaja` (MUEBLES + "tiene
  // varias partes") no cambia — sigue siendo la única razón por la que un
  // código repetido cuenta como VALIDO en vez de DUPLICADO.
  const codigoTrim = codigo.trim()
  const { escaneo, novedad, cantidadEscaneada, cantidadEsperada, resultado } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM gourmet_cargues WHERE id = ${cargueActivo.id} FOR UPDATE`

    const cargue = await tx.gourmetCargue.findUniqueOrThrow({
      where: { id: cargueActivo.id },
      select: { id: true, estado: true, cantidadEscaneada: true, cantidadEsperada: true },
    })

    // Re-chequeo dentro del lock: entre la comprobación de arriba (fuera de
    // la transacción) y este punto, `finalizar`/`cierre-manual`/
    // `revertir-cargue` pudo haber cerrado este mismo cargue — sin esto, un
    // escaneo en curso seguiría escribiendo sobre un cargue ya cerrado.
    if (cargue.estado !== 'EN_CARGUE') {
      throw createError({ statusCode: 409, statusMessage: 'El cargue ya no está activo — probablemente se finalizó o revirtió mientras escaneabas', data: { code: 'CARGUE_NO_ACTIVO' } })
    }

    // Antes aquí se cargaban TODOS los códigos con escaneo VALIDO del cargue
    // (crecía linealmente con cada caja, dentro del lock — el punto más
    // caliente de la latencia por escaneo). La clasificación solo necesita
    // dos datos: si ESTE código ya fue escaneado VALIDO (consulta puntual,
    // cubierta por el índice [cargueId, resultado] / [cargueId,
    // codigoEscaneado]) y cuántos VALIDOS hay (cantidadEscaneada, que el
    // propio cargue ya mantiene: solo incrementa con resultados VALIDO).
    const escaneoValidoPrevio = await tx.gourmetCargueEscaneo.findFirst({
      where: { cargueId: cargue.id, resultado: 'VALIDO', codigoEscaneado: { equals: codigoTrim, mode: 'insensitive' } },
      select: { id: true },
    })

    const clasificacion = clasificarEscaneoGourmet({
      codigo,
      ordenPedido: pedido.orden,
      cajasEsperadas: cargue.cantidadEsperada,
      codigosCajaEsperados: codigosCaja,
      previos: { yaEscaneadoValido: !!escaneoValidoPrevio, cantidadValida: cargue.cantidadEscaneada },
      modoCodigo,
      permitirRepetirCaja,
    })
    const tipoNovedad = clasificacion.tipoNovedadSugerido

    const nuevoEscaneo = await tx.gourmetCargueEscaneo.create({
      data: { cargueId: cargue.id, pedidoId: pedido.id, codigoEscaneado: codigoTrim, resultado: clasificacion.resultado, escaneadoPorId: actor.id, observacion: clasificacion.mensaje },
    })

    let nuevaCantidad = cargue.cantidadEscaneada
    if (clasificacion.incrementaContador) {
      const cargueActualizado = await tx.gourmetCargue.update({
        where: { id: cargue.id }, data: { cantidadEscaneada: { increment: 1 } }, select: { cantidadEscaneada: true },
      })
      nuevaCantidad = cargueActualizado.cantidadEscaneada
    }

    let nuevaNovedad = null
    if (clasificacion.debeCrearNovedad && tipoNovedad) {
      nuevaNovedad = await tx.gourmetCargueNovedad.create({
        data: { cargueId: cargue.id, pedidoId: pedido.id, tipo: tipoNovedad, descripcion: clasificacion.mensaje, estado: 'ABIERTA', registradaPorId: actor.id },
      })
    }

    return { escaneo: nuevoEscaneo, novedad: nuevaNovedad, cantidadEscaneada: nuevaCantidad, cantidadEsperada: cargue.cantidadEsperada, resultado: clasificacion.resultado }
  })

  return {
    success: true,
    resultado,
    progreso: { escaneados: cantidadEscaneada, esperados: cantidadEsperada },
    novedadCreada: !!novedad,
    data: {
      escaneo: { id: escaneo.id, codigoEscaneado: escaneo.codigoEscaneado, resultado: escaneo.resultado, createdAt: escaneo.createdAt.toISOString() },
      ...(novedad ? { novedad: { id: novedad.id, tipo: novedad.tipo, estado: novedad.estado, descripcion: novedad.descripcion } } : {}),
    },
  }
})
