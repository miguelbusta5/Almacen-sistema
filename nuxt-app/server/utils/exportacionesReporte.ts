// SERVER-ONLY. Reporte consolidado de Exportaciones: lee los tres países y devuelve
// el .xlsx de 5 hojas con gráficas. A diferencia de `/export` (volcado plano del país
// en el que estás, con los filtros de la pantalla), esto es un único informe de todo
// el histórico de los tres módulos — de ahí que viva en un solo endpoint y no en la
// factory por país.
//
// Port 1:1 de src/lib/exportaciones/reporte.ts. Mantener ambos en sync.
import { defineEventHandler, setHeader, createError } from 'h3'
import { requireAuth } from './auth'
import {
  getExportDelegate,
  PAISES_EXPORT_SRV,
  puedeGestionarExportaciones,
  type PaisConfigSrv,
} from './exportaciones'
import { construirReporte } from './exportacionesReporteWorkbook'
import type { RegistroReporte } from './exportacionesReporteCalc'

// Tope por país. El reporte es de todo el histórico a propósito (las hojas de
// tendencia y promedios mensuales lo necesitan), pero sin límite una tabla que
// crezca sin control tumbaría la función. Con el volumen actual sobra de largo.
const MAX_POR_PAIS = 100_000

const SELECT = {
  fecha: true,
  numeroCaja: true,
  plu: true,
  descripcion: true,
  unidadEmpaque: true,
  horaInicio: true,
  horaFinalizacion: true,
  hayReguero: true,
  cantidadReguero: true,
  motivoCorreccion: true,
  creadoPorId: true,
  creadoPor: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
} as const

export async function cargarRegistrosReporte(): Promise<RegistroReporte[]> {
  const paises: PaisConfigSrv[] = Object.values(PAISES_EXPORT_SRV)

  const porPais = await Promise.all(
    paises.map(async (cfg) => {
      const filas = await getExportDelegate(cfg.pais).findMany({
        where: { deletedAt: null },
        select: SELECT as never,
        orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
        take: MAX_POR_PAIS,
      })
      return (filas as unknown as RawRow[]).map((r): RegistroReporte => ({
        pais: cfg.pais,
        paisLabel: cfg.paisLabel,
        fecha: r.fecha,
        numeroCaja: r.numeroCaja,
        plu: r.plu,
        descripcion: r.descripcion,
        unidadEmpaque: r.unidadEmpaque,
        horaInicio: r.horaInicio,
        horaFinalizacion: r.horaFinalizacion,
        hayReguero: r.hayReguero,
        cantidadReguero: r.cantidadReguero,
        motivoCorreccion: r.motivoCorreccion,
        creadoPorId: r.creadoPorId,
        creadoPorNombre: r.creadoPor?.name ?? 'Usuario',
        actualizadoPorNombre: r.actualizadoPor?.name ?? null,
      }))
    }),
  )

  return porPais
    .flat()
    .sort((a, b) => new Date(b.horaInicio).getTime() - new Date(a.horaInicio).getTime())
}

interface RawRow {
  fecha: Date
  numeroCaja: string
  plu: string
  descripcion: string
  unidadEmpaque: number
  horaInicio: Date
  horaFinalizacion: Date | null
  hayReguero: boolean
  cantidadReguero: number | null
  motivoCorreccion: string | null
  creadoPorId: string
  creadoPor: { name: string | null } | null
  actualizadoPor: { name: string | null } | null
}

export const reporteHandler = defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeGestionarExportaciones(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para exportar' })
  }

  const registros = await cargarRegistrosReporte()
  const buffer = await construirReporte(registros)
  const hoy = new Date().toISOString().slice(0, 10)

  setHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  setHeader(event, 'Content-Disposition', `attachment; filename="reporte-exportaciones-${hoy}.xlsx"`)
  return buffer
})
