import { defineEventHandler, getQuery, setHeader, createError } from 'h3'
import ExcelJS from 'exceljs'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

const ALLOWED = ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE']

const ESTADO_LABEL: Record<string, string> = {
  APROBADA: 'Aprobada',
  APROBADA_CON_OBSERVACIONES: 'Con observaciones',
  BLOQUEADA: 'Bloqueada',
}

// GET /api/preoperacional/export — mismos filtros que /historial.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!ALLOWED.includes(actor.role)) throw createError({ statusCode: 403, statusMessage: 'No autorizado' })

  const sp = getQuery(event)
  const fechaDesde = sp.fechaDesde ? String(sp.fechaDesde) : undefined
  const fechaHasta = sp.fechaHasta ? String(sp.fechaHasta) : undefined
  const conductorId = sp.conductorId ? String(sp.conductorId) : undefined
  const estado = sp.estado ? String(sp.estado) : undefined

  const where: any = { vigente: true }
  const fechaFilter: any = {}
  if (fechaDesde) fechaFilter.gte = new Date(fechaDesde)
  if (fechaHasta) fechaFilter.lte = new Date(fechaHasta + 'T23:59:59Z')
  if (fechaDesde || fechaHasta) where.fecha = fechaFilter
  if (conductorId) where.conductorId = conductorId
  if (estado) where.estado = estado

  const inspecciones = await prisma.inspeccionPreoperacional.findMany({
    where,
    select: {
      fecha: true,
      kilometraje: true,
      observaciones: true,
      estado: true,
      conductor: { select: { nombre: true } },
      vehiculo: { select: { placa: true, tipo: true } },
      items: {
        select: { categoria: true, item: true, resultado: true, esCritico: true, observacion: true, fotoUrl: true },
        orderBy: { categoria: 'asc' },
      },
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
  })

  const headers = [
    'Fecha', 'Conductor', 'Vehículo', 'Tipo', 'Km', 'Estado general',
    'Categoría', 'Ítem', 'Resultado', 'Es Crítico',
    'Observación ítem', 'Foto URL', 'Observaciones generales',
  ]

  const rows: (string | number | null)[][] = []
  for (const ins of inspecciones) {
    const fechaStr = ins.fecha instanceof Date ? ins.fecha.toISOString().slice(0, 10) : ins.fecha
    const conductor = ins.conductor?.nombre ?? ''
    const placa = ins.vehiculo?.placa ?? ''
    const tipo = ins.vehiculo?.tipo ?? ''
    const km = ins.kilometraje ?? ''
    const estadoLabel = ESTADO_LABEL[ins.estado] ?? ins.estado
    const obsGeneral = ins.observaciones ?? ''

    for (const item of ins.items) {
      rows.push([
        fechaStr, conductor, placa, tipo, km, estadoLabel,
        item.categoria, item.item,
        item.resultado === 'CONFORME' ? 'Conforme' : item.resultado === 'NO_CONFORME' ? 'No conforme' : 'No aplica',
        item.esCritico ? 'Sí' : 'No',
        item.observacion ?? '', item.fotoUrl ?? '', obsGeneral,
      ])
    }
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Preoperacionales')
  ws.addRows([headers, ...rows])
  ws.columns = [12, 22, 12, 10, 8, 22, 14, 32, 14, 10, 28, 30, 28].map((width) => ({ width }))

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="preoperacionales-${today}.xlsx"`)
  return Buffer.from(buf)
})
