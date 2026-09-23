import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapRecepcion } from '../../../utils/mapRow'
import { assertUsuarioRecepcion, esDuenoOGestor, RECEPCION_INCLUDE } from '../../../utils/recepcion'
import {
  normalizarPedido, normalizarProveedor, TIPO_CONTENEDOR_LABEL, validarCorreccionRecepcion,
} from '../../../utils/recepcionCalc'

// Correccion a posteriori de la cabecera de una recepcion: pedido, proveedor,
// tipos, peso y cantidades. El reloj (horas), el cierre y los descargadores
// NO se tocan aqui.
//
// Existe sobre todo para las recepciones anteriores al 23-09, que no tienen
// tipo de contenedor, y para arreglar un dato mal digitado.

const patchSchema = z.object({
  numeroPedido: z.string().max(50).optional(),
  proveedor: z.string().max(160).optional(),
  tipoProducto: z.enum(['GOURMET', 'MUEBLES']).optional(),
  tipoContenedor: z.enum(['CARGA_SUELTA', 'PIES_20', 'PIES_40']).optional(),
  pesoKg: z.number().optional(),
  referenciasEsperadas: z.number().optional(),
  cajas: z.number().optional(),
  unidades: z.number().optional(),
  motivo: z.string().max(500),
})

const CAMPOS = [
  'numeroPedido', 'proveedor', 'tipoProducto', 'tipoContenedor',
  'pesoKg', 'referenciasEsperadas', 'cajas', 'unidades',
] as const

// PATCH /api/recepcion-contenedores/:id - el dueno o supervision, siempre con motivo.
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = patchSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const error = validarCorreccionRecepcion(d)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const current = await prisma.recepcionContenedor.findUnique({ where: { id } })
  if (!current || current.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Recepcion no encontrada' })
  }
  if (!esDuenoOGestor(actor, current)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes corregir tus propias recepciones' })
  }

  const nuevo: Record<string, unknown> = {
    ...(d.numeroPedido !== undefined && { numeroPedido: normalizarPedido(d.numeroPedido) }),
    ...(d.proveedor !== undefined && { proveedor: normalizarProveedor(d.proveedor) }),
    ...(d.tipoProducto !== undefined && { tipoProducto: d.tipoProducto }),
    ...(d.tipoContenedor !== undefined && { tipoContenedor: d.tipoContenedor }),
    ...(d.pesoKg !== undefined && { pesoKg: d.pesoKg }),
    ...(d.referenciasEsperadas !== undefined && { referenciasEsperadas: d.referenciasEsperadas }),
    ...(d.cajas !== undefined && { cajas: d.cajas }),
    ...(d.unidades !== undefined && { unidades: d.unidades }),
  }

  // Solo lo que de verdad cambia: es lo que queda en la auditoria.
  const valor = (k: string, v: unknown) => (k === 'tipoContenedor' && v
    ? TIPO_CONTENEDOR_LABEL[v as keyof typeof TIPO_CONTENEDOR_LABEL]
    : v == null ? 'sin dato' : String(v))
  const cambios = CAMPOS
    .filter((k) => k in nuevo && String(nuevo[k]) !== String((current as Record<string, unknown>)[k] ?? ''))
    .map((k) => `${k}: ${valor(k, (current as Record<string, unknown>)[k])} -> ${valor(k, nuevo[k])}`)
  if (!cambios.length) {
    throw createError({ statusCode: 400, statusMessage: 'No hay cambios para guardar' })
  }

  const motivo = d.motivo.trim()
  const row = await prisma.recepcionContenedor.update({
    where: { id },
    data: { ...nuevo, motivoCorreccion: motivo, actualizadoPorId: actor.id } as never,
    include: RECEPCION_INCLUDE,
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'UPDATE',
      module: 'recepcion-contenedores',
      recordId: id,
      details: `Correccion ${row.numeroPedido}: ${cambios.join('; ')}. Motivo: ${motivo}`,
    },
  }).catch(() => {})

  return { success: true, data: mapRecepcion(row) }
})
