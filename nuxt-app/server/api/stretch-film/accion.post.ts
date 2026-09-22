import { createError, defineEventHandler, readBody } from 'h3'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { actorStretch, avisarStretch, hashStretch, idSolicitud, lockStretch, pedidoStretch, rollosStretch } from '../../utils/stretch'
const schema = z.discriminatedUnion('accion', [
  pedidoStretch.extend({ accion: z.literal('solicitar') }),
  z.object({ accion: z.literal('entrada'), id: idSolicitud, rollos: rollosStretch, motivo: z.string().trim().min(3).max(500) }),
  z.object({ accion: z.literal('ajuste'), id: idSolicitud, rollos: z.number().int().min(0).max(1000000), motivo: z.string().trim().min(3).max(500) }),
  z.object({ accion: z.literal('procesar'), pedidoId: z.string().uuid() }),
  z.object({ accion: z.literal('rechazar'), pedidoId: z.string().uuid(), motivo: z.string().trim().min(3).max(500) }),
  z.object({ accion: z.literal('sesion'), nombre: z.string().trim().min(3).max(100) }),
  z.object({ accion: z.literal('revocar'), sesionId: z.string().min(1) }),
])
export default defineEventHandler(async event => {
  const { actor, permiso } = await actorStretch(event), parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los campos: cantidades enteras en rollos y motivo obligatorio para ajustes' })
  const b = parsed.data
  if (b.accion !== 'solicitar' && !permiso.gestionar) throw createError({ statusCode: 403, statusMessage: 'Solo Eduardo y Felipe pueden gestionar inventario' })
  return prisma.$transaction(async tx => {
    await lockStretch(tx)
    let codigo: string | undefined
    if (b.accion === 'solicitar') {
      const anterior = await tx.stretchPedido.findUnique({ where: { id: b.id } })
      if (anterior) {
        if (anterior.usuarioId !== actor.id || anterior.rollos !== b.rollos || anterior.destino !== b.destino || anterior.tipo !== b.tipo) throw createError({ statusCode: 409, statusMessage: 'Solicitud duplicada con datos distintos' })
        return { ok: true }
      }
      await tx.stretchPedido.create({ data: { id: b.id, solicitante: actor.name, destino: b.destino, tipo: b.tipo, rollos: b.rollos, usuarioId: actor.id } })
      await avisarStretch(tx, actor.name, b.rollos)
    } else if (b.accion === 'sesion') {
      codigo = randomBytes(32).toString('hex')
      await tx.stretchSesion.create({ data: { tokenHash: hashStretch(codigo), nombre: b.nombre, creadaPorId: actor.id, expiraAt: new Date(Date.now() + 12 * 3600000) } })
    } else if (b.accion === 'revocar') {
      await tx.stretchSesion.update({ where: { id: b.sesionId }, data: { revocadaAt: new Date() } })
    } else {
      const stock = await tx.stretchStock.upsert({ where: { id: 'principal' }, create: { id: 'principal' }, update: {} })
      if (b.accion === 'entrada' || b.accion === 'ajuste') {
        const repetido = await tx.stretchMovimiento.findUnique({ where: { solicitudId: b.id } })
        if (repetido) {
          if (repetido.usuarioId !== actor.id || repetido.tipo !== b.accion.toUpperCase() || (b.accion === 'ajuste' ? repetido.saldo : repetido.cantidad) !== b.rollos) throw createError({ statusCode: 409, statusMessage: 'Operación repetida con datos distintos' })
          return { ok: true }
        }
        const saldo = b.accion === 'entrada' ? stock.rollos + b.rollos : b.rollos
        if (saldo > 2147483647) throw createError({ statusCode: 400, statusMessage: 'Cantidad fuera del límite' })
        await tx.stretchStock.update({ where: { id: 'principal' }, data: { rollos: saldo } })
        await tx.stretchMovimiento.create({ data: { solicitudId: b.id, tipo: b.accion.toUpperCase(), cantidad: saldo - stock.rollos, saldo, motivo: b.motivo, usuarioId: actor.id } })
      } else {
        const pedido = await tx.stretchPedido.findUnique({ where: { id: b.pedidoId } })
        if (!pedido) throw createError({ statusCode: 404, statusMessage: 'Pedido no encontrado' })
        if (pedido.estado !== 'PENDIENTE') throw createError({ statusCode: 409, statusMessage: 'El pedido ya fue procesado o rechazado. Actualiza la lista.' })
        const entrega = b.accion === 'procesar'
        if (entrega && pedido.rollos > stock.rollos) throw createError({ statusCode: 409, statusMessage: `Stock insuficiente: hay ${stock.rollos} rollos disponibles` })
        if (entrega) {
          const saldo = stock.rollos - pedido.rollos
          await tx.stretchStock.update({ where: { id: 'principal' }, data: { rollos: saldo } })
          await tx.stretchMovimiento.create({ data: { solicitudId: pedido.id, pedidoId: pedido.id, tipo: 'SALIDA', cantidad: -pedido.rollos, saldo, motivo: `${pedido.tipo}: ${pedido.destino}`, usuarioId: actor.id } })
        }
        await tx.stretchPedido.update({ where: { id: pedido.id }, data: { estado: entrega ? 'ENTREGADO' : 'RECHAZADO', procesadoAt: new Date(), procesadoPorId: actor.id, nota: b.accion === 'rechazar' ? b.motivo : null } })
        if (pedido.usuarioId) await tx.notificacion.create({ data: { userId: pedido.usuarioId, titulo: entrega ? 'Stretch film entregado' : 'Pedido de Stretch rechazado', descripcion: `${pedido.rollos} rollos · ${pedido.destino}`, tipo: 'STRETCH', enlace: '/dashboard/stretch-film' } })
      }
    }
    await tx.activityLog.create({ data: { userId: actor.id, action: 'UPDATE', module: 'stretch-film', recordId: 'pedidoId' in b ? b.pedidoId : 'id' in b ? b.id : 'sesionId' in b ? b.sesionId : 'principal', details: `Stretch film: ${b.accion}` } })
    return { ok: true, codigo }
  }, { timeout: 15000 })
})
