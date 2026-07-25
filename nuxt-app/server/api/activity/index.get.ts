import { defineEventHandler, getQuery, setHeader, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { sanearPaginacion } from '../../utils/paginacion'

// GET /api/activity — registro de auditoría. Solo ADMIN.
// Port de src/app/api/activity/route.ts.
// Query: module, action, userId, from (YYYY-MM-DD), to (YYYY-MM-DD), q, page, pageSize, export=csv
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['ADMIN'])

  const sp = getQuery(event)
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined)
  const modulo = str(sp.module)
  const action = str(sp.action)
  const userId = str(sp.userId)
  const from = str(sp.from)
  const to = str(sp.to)
  const q = str(sp.q)
  const exportCsv = String(sp.export ?? '') === 'csv'
  const { page, pageSize } = sanearPaginacion(sp.page, sp.pageSize)

  const where: Record<string, unknown> = {}
  if (modulo) where.module = modulo
  if (action) where.action = action
  if (userId) where.userId = userId
  if (from || to) {
    const rango: Record<string, Date> = {}
    if (from) rango.gte = new Date(`${from}T00:00:00`)
    if (to) rango.lte = new Date(`${to}T23:59:59.999`)
    where.createdAt = rango
  }
  if (q) {
    where.OR = [
      { details: { contains: q, mode: 'insensitive' } },
      { recordId: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (exportCsv) {
    const allRows = await prisma.activityLog.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    // Sin diccionario de etiquetas: se exporta el valor crudo. La versión Next
    // traducía solo 3 de los 14 módulos reales y uno de ellos ("users") ni siquiera
    // existe en los datos, así que media exportación salía con la etiqueta original
    // y la otra media con un slug. El crudo al menos es consistente y filtrable.
    const filas = [
      ['Fecha y hora', 'Usuario', 'Email', 'Acción', 'Módulo', 'Registro', 'Detalle'],
      ...allRows.map((r) => [
        r.createdAt.toLocaleString('es-CO', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
        r.user?.name ?? '',
        r.user?.email ?? '',
        r.action,
        r.module,
        r.recordId,
        r.details ?? '',
      ]),
    ]
    // BOM inicial para que Excel abra el UTF-8 sin romper las tildes.
    const csv = '﻿' + filas
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

    setHeader(event, 'Content-Type', 'text/csv;charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`)
    return csv
  }

  const [rows, total, users, modulos, acciones] = await Promise.all([
    prisma.activityLog.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.activityLog.count({ where: where as never }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
    // Opciones de filtro derivadas de los datos reales, no de una lista fija: hoy
    // hay 14 módulos y 10 acciones distintos en la tabla, y el diccionario de la
    // versión Next solo contemplaba 3 y 4 respectivamente.
    prisma.activityLog.groupBy({ by: ['module'], _count: { _all: true } }),
    prisma.activityLog.groupBy({ by: ['action'], _count: { _all: true } }),
  ])

  const data = rows.map((r) => ({
    id: r.id,
    action: r.action,
    module: r.module,
    recordId: r.recordId,
    details: r.details,
    createdAt: r.createdAt.toISOString(),
    user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
  }))

  return {
    success: true,
    data,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    users,
    modulos: modulos.map((m) => m.module).sort(),
    acciones: acciones.map((a) => a.action).sort(),
    actorId: actor.id,
  }
})
