import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { GESTORES_GARANTIAS } from '../../utils/garantias'
import { minutosTarea, minutosUnicos, TIPOS_GARANTIA } from '../../utils/garantiasCalc'
import { ventanaTurno } from '../../utils/turnosCalc'

const DIA = /^\d{4}-\d{2}-\d{2}$/
const bogota = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const sumarDia = (d: string, n: number) => new Date(new Date(`${d}T12:00:00-05:00`).getTime() + n * 86_400_000).toISOString().slice(0, 10)
const limite = (d: string) => new Date(`${d}T00:00:00-05:00`)

export default defineEventHandler(async (event) => {
  await requireRole(event, GESTORES_GARANTIAS)
  const q = getQuery(event)
  const hoy = bogota(new Date())
  const desde = DIA.test(String(q.desde ?? '')) ? String(q.desde) : sumarDia(hoy, -6)
  const hasta = DIA.test(String(q.hasta ?? '')) ? String(q.hasta) : hoy
  if (desde > hasta || (limite(hasta).getTime() - limite(desde).getTime()) / 86_400_000 > 90) throw createError({ statusCode: 400, statusMessage: 'El rango debe ser de máximo 90 días' })
  const usuarioId = q.usuarioId ? String(q.usuarioId) : null
  const usuarios = await prisma.user.findMany({ where: { OR: [{ role: 'GARANTIAS' }, { tareasGarantias: { some: {} } }] }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
  if (usuarioId && !usuarios.some((u) => u.id === usuarioId)) throw createError({ statusCode: 400, statusMessage: 'Operario inválido' })
  const seleccionados = usuarios.filter((u) => !usuarioId || u.id === usuarioId)
  const ids = seleccionados.map((u) => u.id)
  const inicioConsulta = limite(sumarDia(desde, -1))
  const finConsulta = limite(sumarDia(hasta, 2))
  const [tareas, cuadros] = await Promise.all([
    prisma.tareaGarantia.findMany({ where: { usuarioId: { in: ids }, horaInicio: { lt: finConsulta }, horaFin: { not: null, gt: inicioConsulta } }, include: { tramos: true } }),
    prisma.cuadroTurnos.findMany({ where: { deletedAt: null, desde: { lte: new Date(`${hasta}T00:00:00Z`) }, hasta: { gte: new Date(`${desde}T00:00:00Z`) } }, orderBy: { createdAt: 'desc' }, select: { desde: true, hasta: true, turnos: { select: { usuarioId: true, diaSemana: true, inicioMin: true, finMin: true } } } }),
  ])
  const cerradas = tareas.filter((t) => t.horaFin && desde <= bogota(t.horaFin) && bogota(t.horaFin) <= hasta)
  const tipos = TIPOS_GARANTIA.map((tipo) => {
    const lista = cerradas.filter((t) => t.tipo === tipo)
    const minutos = lista.reduce((s, t) => s + minutosTarea(t.tramos.filter((x): x is typeof x & { fin: Date } => !!x.fin)), 0)
    return { tipo, tareas: lista.length, minutos: Math.round(minutos * 10) / 10, promedioMinutos: lista.length ? Math.round(minutos / lista.length * 10) / 10 : 0 }
  })
  const proveedores = new Map<string, { proveedor: string; tareas: number; casos: Set<string> }>()
  for (const t of cerradas) {
    const nombre = t.proveedor.trim() || 'Sin proveedor'
    const fila = proveedores.get(nombre) ?? { proveedor: nombre, tareas: 0, casos: new Set<string>() }
    fila.tareas++
    if (t.numeroCaso) fila.casos.add(t.numeroCaso.trim().toUpperCase())
    proveedores.set(nombre, fila)
  }
  const pareto = [...proveedores.values()].map((p) => ({ proveedor: p.proveedor, tareas: p.tareas, casos: p.casos.size }))
    .sort((a, b) => b.casos - a.casos || b.tareas - a.tareas || a.proveedor.localeCompare(b.proveedor))

  const diario = []
  for (let dia = desde; dia <= hasta; dia = sumarDia(dia, 1)) {
    const cuadro = cuadros.find((c) => c.desde.toISOString().slice(0, 10) <= dia && dia <= c.hasta.toISOString().slice(0, 10))
    const semana = new Date(`${dia}T12:00:00-05:00`).getUTCDay()
    for (const u of seleccionados) {
      const turno = cuadro?.turnos.find((t) => t.usuarioId === u.id && t.diaSemana === semana)
      const ventana = turno ? ventanaTurno(dia, turno) : { inicio: limite(dia), fin: limite(sumarDia(dia, 1)) }
      const intervalos = tareas.filter((t) => t.usuarioId === u.id).flatMap((t) => t.tramos
        .filter((x): x is typeof x & { fin: Date } => !!x.fin)
        .map((x) => ({ inicio: x.inicio, fin: x.fin })))
      const minutos = minutosUnicos(intervalos, ventana)
      const jornadaMinutos = turno ? (ventana.fin.getTime() - ventana.inicio.getTime()) / 60_000 : null
      if (!turno && minutos === 0) continue
      diario.push({ dia, usuarioId: u.id, operario: u.name, minutos: Math.round(minutos * 10) / 10,
        jornadaMinutos, efectividad: jornadaMinutos ? Math.round(minutos / jornadaMinutos * 100) : null })
    }
  }
  return { equipo: usuarios, desde, hasta, tipos, pareto, diario }
})
