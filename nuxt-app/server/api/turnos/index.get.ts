import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'
import { diaBogota } from '../../utils/indicadoresCalc'

/**
 * GET /api/turnos - los cuadros cargados, del mas reciente al mas viejo.
 *
 * Con el detalle de cada persona: es lo que deja ver de un vistazo a quien le
 * falta turno, que es la causa mas comun de que la efectividad no salga.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Los turnos son para supervision')

  const cuadros = await prisma.cuadroTurnos.findMany({
    where: { deletedAt: null },
    orderBy: [{ desde: 'desc' }, { createdAt: 'desc' }],
    take: 20,
    select: {
      id: true, nombreArchivo: true, desde: true, hasta: true, createdAt: true,
      subidoPor: { select: { name: true } },
      turnos: {
        select: { usuarioId: true, diaSemana: true, inicioMin: true, finMin: true },
        orderBy: [{ usuarioId: 'asc' }, { diaSemana: 'asc' }],
      },
    },
  })

  const medidos = await prisma.user.findMany({
    where: { active: true, role: { in: ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO', 'GARANTIAS'] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  const nombre = new Map(medidos.map((u) => [u.id, u.name]))

  const hoy = diaBogota(new Date())

  return {
    success: true,
    data: cuadros.map((c) => {
      const desde = c.desde.toISOString().slice(0, 10)
      const hasta = c.hasta.toISOString().slice(0, 10)
      const porPersona = new Map<string, { dia: number; inicioMin: number; finMin: number }[]>()
      for (const t of c.turnos) {
        const lista = porPersona.get(t.usuarioId) ?? []
        lista.push({ dia: t.diaSemana, inicioMin: t.inicioMin, finMin: t.finMin })
        porPersona.set(t.usuarioId, lista)
      }
      return {
        id: c.id,
        nombreArchivo: c.nombreArchivo,
        desde,
        hasta,
        vigente: desde <= hoy && hoy <= hasta,
        subidoPor: c.subidoPor.name,
        subidoAt: c.createdAt.toISOString(),
        personas: [...porPersona.entries()].map(([id, dias]) => ({
          id,
          nombre: nombre.get(id) ?? 'Sin usuario',
          dias,
        })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        // Quien se mide y no tiene turno en este cuadro: sin el, no hay jornada
        // contra la que comparar.
        sinTurno: medidos.filter((u) => !porPersona.has(u.id)).map((u) => u.name),
      }
    }),
  }
})
