// Armado del libro del reporte consolidado de Exportaciones: 5 hojas (registros
// base + 4 de análisis) con gráficas nativas.
//
// Reparto de responsabilidades: exportacionesReporteCalc.ts calcula, este archivo
// coloca celdas y declara dónde va cada gráfica, y excelCharts.ts inyecta el XML.
// Las refs de las gráficas se construyen con los mismos índices con los que se
// escriben las celdas (nada de rangos "a ojo"), así que mover un bloque no
// descuadra sus series.
//
// Port 1:1 de src/lib/exportaciones/reporteWorkbook.ts. Mantener ambos en sync.
import ExcelJS from 'exceljs'
import { cellRef, injectCharts, rangeRef, type ChartSpec } from './excelCharts'
import { calcularDuracionMinutos, formatDateOnly } from './exportacionesCalc'
import {
  AMBITOS,
  AMBITO_LABEL,
  matricesDiarias,
  promediosMensuales,
  tiemposPorUsuario,
  totalTiempos,
  type Ambito,
  type MatrizDiaria,
  type RegistroReporte,
} from './exportacionesReporteCalc'

export const HOJAS = {
  registros: 'Registros',
  tiempos: 'Tiempos por usuario',
  unidadesDia: 'Unidades por día',
  registrosDia: 'Registros por día',
  mensual: 'Promedios mensuales',
} as const

/** Los tres países, sin "general": las series de las gráficas comparan países. */
const PAISES: Ambito[] = AMBITOS.filter((a) => a !== 'general')

const ANCHO_GRAFICA = 9 // columnas
const ALTO_GRAFICA = 17 // filas

const fmtHora = (d: Date | string): string =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d instanceof Date ? d : new Date(d))

type Celda = string | number | null

function estiloEncabezado(ws: ExcelJS.Worksheet, fila: number, desde = 1, hasta?: number): void {
  const row = ws.getRow(fila)
  row.font = { bold: true }
  const fin = hasta ?? row.cellCount
  for (let c = desde; c <= fin; c += 1) {
    row.getCell(c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5EF' },
    }
  }
}

function estiloTitulo(ws: ExcelJS.Worksheet, fila: number): void {
  ws.getRow(fila).font = { bold: true, size: 13 }
}

// ── Hoja 1: registros base ───────────────────────────────────────────

function hojaRegistros(wb: ExcelJS.Workbook, registros: RegistroReporte[]): void {
  const ws = wb.addWorksheet(HOJAS.registros)
  const headers = [
    'País', 'Fecha', 'N° Caja', 'PLU', 'Descripción', 'Unidad empaque',
    'Hora inicio', 'Hora finalización', 'Duración (min)', 'Estado',
    'Reguero', 'Cantidad reguero', 'Motivo corrección', 'Creado por', 'Actualizado por',
  ]

  const filas: Celda[][] = registros.map((r) => [
    r.paisLabel,
    formatDateOnly(r.fecha) ?? '',
    r.numeroCaja,
    r.plu,
    r.descripcion,
    r.unidadEmpaque,
    fmtHora(r.horaInicio),
    r.horaFinalizacion ? fmtHora(r.horaFinalizacion) : '',
    calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion) ?? '',
    r.horaFinalizacion ? 'Finalizado' : 'En curso',
    r.hayReguero ? 'Sí' : 'No',
    r.cantidadReguero ?? '',
    r.motivoCorreccion ?? '',
    r.creadoPorNombre,
    r.actualizadoPorNombre ?? '',
  ])

  ws.addRows([headers, ...filas])
  ws.columns = [16, 12, 14, 12, 32, 14, 18, 18, 14, 12, 9, 14, 28, 22, 22].map((width) => ({ width }))
  estiloEncabezado(ws, 1, 1, headers.length)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  if (filas.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: filas.length + 1, column: headers.length },
    }
  }
}

// ── Hoja 2: tiempos por usuario ──────────────────────────────────────

const METRICAS_TIEMPO = ['Cajas', 'Unidades', 'Minutos totales', 'Prom. min/caja']

function hojaTiempos(wb: ExcelJS.Workbook, registros: RegistroReporte[]): ChartSpec[] {
  const ws = wb.addWorksheet(HOJAS.tiempos)
  const filas = tiemposPorUsuario(registros)
  const total = totalTiempos(filas)

  ws.addRow(['Tiempos por usuario'])
  estiloTitulo(ws, 1)
  ws.addRow([])

  // Fila 3 = ámbito (una celda combinada por bloque), fila 4 = métricas.
  const filaAmbitos = 3
  const filaMetricas = 4
  const cabAmbitos: Celda[] = ['Usuario']
  const cabMetricas: Celda[] = ['']
  for (const ambito of AMBITOS) {
    cabAmbitos.push(AMBITO_LABEL[ambito], '', '', '')
    cabMetricas.push(...METRICAS_TIEMPO)
  }
  ws.addRow(cabAmbitos)
  ws.addRow(cabMetricas)
  AMBITOS.forEach((_, i) => {
    const desde = 2 + i * METRICAS_TIEMPO.length
    ws.mergeCells(filaAmbitos, desde, filaAmbitos, desde + METRICAS_TIEMPO.length - 1)
    ws.getCell(filaAmbitos, desde).alignment = { horizontal: 'center' }
  })
  estiloEncabezado(ws, filaAmbitos, 1, cabMetricas.length)
  estiloEncabezado(ws, filaMetricas, 1, cabMetricas.length)

  const primeraFilaDatos = filaMetricas + 1
  for (const fila of filas) {
    const celdas: Celda[] = [fila.nombre]
    for (const ambito of AMBITOS) {
      const m = fila.porAmbito[ambito]
      celdas.push(m.cajas, m.unidades, m.minutos, m.promedioPorCajaMin)
    }
    ws.addRow(celdas)
  }
  const ultimaFilaDatos = primeraFilaDatos + filas.length - 1

  if (filas.length > 0) {
    const celdasTotal: Celda[] = ['TOTAL']
    for (const ambito of AMBITOS) {
      const m = total[ambito]
      celdasTotal.push(m.cajas, m.unidades, m.minutos, m.promedioPorCajaMin)
    }
    const filaTotal = ws.addRow(celdasTotal)
    filaTotal.font = { bold: true }
  }

  ws.columns = [26, ...AMBITOS.flatMap(() => [9, 11, 15, 15])].map((width) => ({ width }))
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: filaMetricas }]
  if (filas.length === 0) return []

  // Índices 0-based de columnas para las refs: usuario = 0; el bloque del ámbito i
  // empieza en 1 + 4i (Cajas) y su 4ª columna es el promedio.
  const colAmbito = (i: number) => 1 + i * METRICAS_TIEMPO.length
  const filaCabAmbito = filaAmbitos - 1
  const cats = rangeRef(HOJAS.tiempos, 0, primeraFilaDatos - 1, 0, ultimaFilaDatos - 1)
  const colGrafica = 1 + AMBITOS.length * METRICAS_TIEMPO.length + 1

  const serie = (i: number, offset: number) => ({
    nameRef: cellRef(HOJAS.tiempos, colAmbito(i), filaCabAmbito),
    valuesRef: rangeRef(
      HOJAS.tiempos,
      colAmbito(i) + offset,
      primeraFilaDatos - 1,
      colAmbito(i) + offset,
      ultimaFilaDatos - 1,
    ),
  })

  return [
    {
      type: 'bar',
      title: 'Promedio de minutos por caja, por usuario',
      sheet: HOJAS.tiempos,
      categories: cats,
      series: PAISES.map((_, i) => serie(i, 3)),
      anchor: {
        fromCol: colGrafica,
        fromRow: 2,
        toCol: colGrafica + ANCHO_GRAFICA,
        toRow: 2 + ALTO_GRAFICA,
      },
    },
    {
      // Apilada a propósito: cada barra es el total general del usuario y a la vez
      // se ve cuánto puso cada país.
      type: 'barStacked',
      title: 'Minutos totales por usuario (apilado por país)',
      sheet: HOJAS.tiempos,
      categories: cats,
      series: PAISES.map((_, i) => serie(i, 2)),
      anchor: {
        fromCol: colGrafica,
        fromRow: 4 + ALTO_GRAFICA,
        toCol: colGrafica + ANCHO_GRAFICA,
        toRow: 4 + ALTO_GRAFICA * 2,
      },
    },
  ]
}

// ── Hojas 3 y 4: series diarias ──────────────────────────────────────

function hojaDiaria(
  wb: ExcelJS.Workbook,
  nombreHoja: string,
  titulo: string,
  matrices: MatrizDiaria[],
): ChartSpec[] {
  const ws = wb.addWorksheet(nombreHoja)
  const specs: ChartSpec[] = []

  ws.addRow([titulo])
  estiloTitulo(ws, 1)

  const usuarios = matrices[0]?.usuarios ?? []
  let cursor = 3 // fila 1-based donde arranca el siguiente bloque

  for (const matriz of matrices) {
    const filaTitulo = cursor
    ws.getRow(filaTitulo).getCell(1).value = AMBITO_LABEL[matriz.ambito]
    ws.getRow(filaTitulo).font = { bold: true, size: 12 }

    const filaCabecera = filaTitulo + 1
    const cabecera: Celda[] = ['Fecha', ...usuarios.map((u) => u.nombre), 'Total']
    ws.getRow(filaCabecera).values = cabecera
    estiloEncabezado(ws, filaCabecera, 1, cabecera.length)

    matriz.fechas.forEach((fecha, i) => {
      ws.getRow(filaCabecera + 1 + i).values = [
        fecha,
        ...matriz.valores[i],
        matriz.totalesPorFecha[i],
      ]
    })

    const primeraFilaDatos = filaCabecera + 1
    const ultimaFilaDatos = filaCabecera + matriz.fechas.length

    if (matriz.fechas.length > 0) {
      const colGrafica = cabecera.length + 1
      specs.push({
        type: 'line',
        title: `${titulo} — ${AMBITO_LABEL[matriz.ambito]}`,
        sheet: nombreHoja,
        categories: rangeRef(nombreHoja, 0, primeraFilaDatos - 1, 0, ultimaFilaDatos - 1),
        series: usuarios.map((_, i) => ({
          nameRef: cellRef(nombreHoja, i + 1, filaCabecera - 1),
          valuesRef: rangeRef(nombreHoja, i + 1, primeraFilaDatos - 1, i + 1, ultimaFilaDatos - 1),
        })),
        anchor: {
          fromCol: colGrafica,
          fromRow: filaTitulo - 1,
          toCol: colGrafica + ANCHO_GRAFICA,
          toRow: filaTitulo - 1 + ALTO_GRAFICA,
        },
      })
    }

    // El bloque avanza al menos lo que ocupa su gráfica, para que no se solapen.
    cursor += Math.max(matriz.fechas.length + 2, ALTO_GRAFICA) + 3
  }

  ws.columns = [14, ...usuarios.map(() => 16), 12].map((width) => ({ width }))
  return specs
}

// ── Hoja 5: promedios mensuales ──────────────────────────────────────

const METRICAS_MES = [
  'Registros',
  'Unidades',
  'Prom. min/caja',
  'Prom. registros/día',
  'Prom. unidades/día',
  'Usuarios activos',
]

function hojaMensual(wb: ExcelJS.Workbook, registros: RegistroReporte[]): ChartSpec[] {
  const ws = wb.addWorksheet(HOJAS.mensual)
  const meses = promediosMensuales(registros)

  ws.addRow(['Promedios mensuales por módulo'])
  estiloTitulo(ws, 1)
  ws.addRow([])

  const filaAmbitos = 3
  const filaMetricas = 4
  const cabAmbitos: Celda[] = ['Mes']
  const cabMetricas: Celda[] = ['']
  for (const ambito of AMBITOS) {
    cabAmbitos.push(AMBITO_LABEL[ambito], ...Array(METRICAS_MES.length - 1).fill(''))
    cabMetricas.push(...METRICAS_MES)
  }
  ws.addRow(cabAmbitos)
  ws.addRow(cabMetricas)
  AMBITOS.forEach((_, i) => {
    const desde = 2 + i * METRICAS_MES.length
    ws.mergeCells(filaAmbitos, desde, filaAmbitos, desde + METRICAS_MES.length - 1)
    ws.getCell(filaAmbitos, desde).alignment = { horizontal: 'center' }
  })
  estiloEncabezado(ws, filaAmbitos, 1, cabMetricas.length)
  estiloEncabezado(ws, filaMetricas, 1, cabMetricas.length)

  const primeraFilaDatos = filaMetricas + 1
  for (const fila of meses) {
    const celdas: Celda[] = [fila.mes]
    for (const ambito of AMBITOS) {
      const m = fila.porAmbito[ambito]
      celdas.push(
        m.registros,
        m.unidades,
        m.promedioPorCajaMin,
        m.promedioRegistrosDia,
        m.promedioUnidadesDia,
        m.usuarios,
      )
    }
    ws.addRow(celdas)
  }
  const ultimaFilaDatos = primeraFilaDatos + meses.length - 1

  ws.columns = [12, ...AMBITOS.flatMap(() => [11, 11, 15, 18, 18, 15])].map((width) => ({ width }))
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: filaMetricas }]
  if (meses.length === 0) return []

  const colAmbito = (i: number) => 1 + i * METRICAS_MES.length
  const cats = rangeRef(HOJAS.mensual, 0, primeraFilaDatos - 1, 0, ultimaFilaDatos - 1)
  const colGrafica = 1 + AMBITOS.length * METRICAS_MES.length + 1
  const serie = (i: number, offset: number) => ({
    nameRef: cellRef(HOJAS.mensual, colAmbito(i), filaAmbitos - 1),
    valuesRef: rangeRef(
      HOJAS.mensual,
      colAmbito(i) + offset,
      primeraFilaDatos - 1,
      colAmbito(i) + offset,
      ultimaFilaDatos - 1,
    ),
  })

  return [
    {
      type: 'line',
      title: 'Promedio de minutos por caja, por mes',
      sheet: HOJAS.mensual,
      categories: cats,
      series: PAISES.map((_, i) => serie(i, 2)),
      anchor: {
        fromCol: colGrafica,
        fromRow: 2,
        toCol: colGrafica + ANCHO_GRAFICA,
        toRow: 2 + ALTO_GRAFICA,
      },
    },
    {
      type: 'bar',
      title: 'Unidades por mes y país',
      sheet: HOJAS.mensual,
      categories: cats,
      series: PAISES.map((_, i) => serie(i, 1)),
      anchor: {
        fromCol: colGrafica,
        fromRow: 4 + ALTO_GRAFICA,
        toCol: colGrafica + ANCHO_GRAFICA,
        toRow: 4 + ALTO_GRAFICA * 2,
      },
    },
  ]
}

// ── Entrada ──────────────────────────────────────────────────────────

/** Genera el .xlsx completo (5 hojas + gráficas) listo para descargar. */
export async function construirReporte(registros: RegistroReporte[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Grupo Ambiente'
  wb.created = new Date()

  hojaRegistros(wb, registros)
  const specs: ChartSpec[] = [
    ...hojaTiempos(wb, registros),
    ...hojaDiaria(wb, HOJAS.unidadesDia, 'Unidades por día', matricesDiarias(registros, 'unidades')),
    ...hojaDiaria(wb, HOJAS.registrosDia, 'Registros por día', matricesDiarias(registros, 'registros')),
    ...hojaMensual(wb, registros),
  ]

  // exceljs declara su propio `Buffer` (extends ArrayBuffer); Buffer.from lo acepta
  // en runtime y deja un tipo con el que injectCharts sí compila.
  return injectCharts(Buffer.from(await wb.xlsx.writeBuffer()), specs)
}
