// Analítica de muebles: lo que devuelve /api/indicadores-muebles/analitica y
// los formatos de la pantalla. El cálculo vive en el servidor
// (server/utils/mueblesAnaliticaCalc.ts); aquí solo los tipos del cliente.

export const API_ANALITICA_MUEBLES = '/api/indicadores-muebles/analitica'

export interface AnaliticaMueblesDTO {
  resumen: {
    inspeccionadas: number
    entregadas: number
    diasActivos: number
    inspeccionadasDia: number | null
    entregadasDia: number | null
    leadTimeMedianaMin: number | null
    plusPickeados: number
    m3Entregado: number
    kgEntregado: number
  }
  dias: Array<{ dia: string; diaSemana: number; inspeccionadas: number; entregadas: number; m3Entregado: number; kgEntregado: number }>
  ordenes: Array<{
    id: string; codigo: string; tipoOrden: string; estado: string; ciudad: string | null
    plus: number; unidades: number
    pickingMin: number | null; esperaInspeccionMin: number | null
    inspeccionRelojMin: number | null; inspeccionTrabajoMin: number | null
    esperaEntregaMin: number | null; leadTimeMin: number | null
    inspeccionadaAt: string | null; entregadaAt: string | null
    errores: number; ebanisteria: boolean; averia: boolean; pendientes: number
  }>
  etapas: Array<{ key: string; label: string; ordenes: number; promedioMin: number | null; medianaMin: number | null }>
  topPlus: Array<{ plu: string; descripcion: string | null; veces: number; ordenes: number; unidades: number; promedioPickingMin: number | null }>
  ciudades: Array<{ ciudad: string; ordenes: number; promedioDia: number; porcentaje: number; m3: number; kg: number }>
  proyeccion: {
    plantilla: { operarios: number; inspectores: number }
    operariosDia: number | null
    inspectoresDia: number | null
    pickingMinMezcla: number | null
    inspeccionMinMezcla: number | null
    jornadas: Array<{ etiqueta: string; horas: number; dias: number; capacidadPicking: number | null; capacidadInspeccion: number | null; capacidad: number | null }>
    semana: number | null
    cuello: 'picking' | 'inspeccion' | null
    porTipo: Array<{ tipoOrden: string; muestra: number; porcentajeMezcla: number; plusPorOrden: number; pickingMin: number | null; inspeccionMin: number | null; capacidad9h: number | null }>
    realDia: number | null
    ocupacionPicking: number | null
    ocupacionInspeccion: number | null
  }
  horasPico: {
    celdas: Array<{ diaSemana: number; hora: number; plus: number }>
    maximo: number
    porHora: Array<{ hora: number; plus: number; ordenes: number }>
    porDiaSemana: Array<{ diaSemana: number; plus: number; ordenes: number; dias: number; promedioOrdenes: number }>
  }
  calidad: { ordenes: number; conError: number; conEbanisteria: number; conAveria: number; conPendientes: number; perfectas: number }
  mezcla: Array<{ tipoOrden: string; ordenes: number; porcentaje: number; plusPorOrden: number; m3: number; kg: number }>
}

/** Plantilla real del turno (CEDI, 23-09); igual que en el servidor. */
export const PLANTILLA_MUEBLES = { operarios: 2, inspectores: 5 } as const

export const DIA_SEMANA_CORTO: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }
export const DIA_SEMANA_LARGO: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
}
export const TIPO_ORDEN_MUEBLES_LABEL: Record<string, string> = { TSDM: 'TSDM', OVDM: 'OVDM', TIENDA: 'De tienda', CONTADO: 'Contado' }
export const ESTADO_ORDEN_MUEBLES_LABEL: Record<string, string> = {
  EN_PICKING: 'En picking', EN_INSPECCION: 'En inspección', INSPECCIONADA: 'Inspeccionada', ENTREGADA_TRANSPORTE: 'Entregada',
}

const dec1 = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 })

/** Número con un decimal como mucho, o raya si no hay dato. */
export function fmtDec(n: number | null | undefined): string {
  return n == null ? '—' : dec1(n)
}

/** Minutos legibles: "45 min", "2 h 05 min". */
export function fmtMinutos(min: number | null | undefined): string {
  if (min == null) return '—'
  if (min < 1) return `${Math.round(min * 60)} s`
  if (min < 60) return `${dec1(Math.round(min * 10) / 10)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min - h * 60)
  return m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, '0')} min`
}

export function fmtPct(parte: number, total: number): string {
  return total > 0 ? `${dec1(Math.round((parte / total) * 1000) / 10)} %` : '—'
}
