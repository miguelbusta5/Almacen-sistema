// Agregaciones del reporte consolidado de Exportaciones. PURO: sin Prisma, sin
// ExcelJS, sin Nitro — solo transforma filas en tablas.
//
// Toda métrica se calcula por país Y en general. "General" no es un cuarto país:
// es la suma de los tres, y para los promedios de tiempo es un promedio ponderado
// (minutos totales / cajas finalizadas), no el promedio de los tres promedios.
//
// Port 1:1 de src/lib/exportaciones/reporteCalc.ts. Mantener ambos en sync.
import { calcularDuracionMinutos, formatDateOnly } from './exportacionesCalc'
import type { PaisExport } from './exportaciones'

/** Fila cruda, ya normalizada con su país. Es lo que devuelve el endpoint. */
export interface RegistroReporte {
  pais: PaisExport
  paisLabel: string
  fecha: Date | string
  numeroCaja: string
  plu: string
  descripcion: string
  unidadEmpaque: number
  horaInicio: Date | string
  horaFinalizacion: Date | string | null
  hayReguero: boolean
  cantidadReguero: number | null
  motivoCorreccion: string | null
  creadoPorId: string
  creadoPorNombre: string
  actualizadoPorNombre: string | null
}

/** Columna "General" incluida: las hojas la tratan como un bloque más. */
export type Ambito = PaisExport | 'general'

export interface MetricasBloque {
  cajas: number
  unidades: number
  minutos: number
  finalizadas: number
  /** minutos / finalizadas, 1 decimal. `null` si nadie finalizó nada. */
  promedioPorCajaMin: number | null
}

export interface FilaUsuario {
  usuarioId: string
  nombre: string
  porAmbito: Record<Ambito, MetricasBloque>
}

/** Matriz fecha × usuario de un ámbito. `usuarios` son las columnas. */
export interface MatrizDiaria {
  ambito: Ambito
  fechas: string[]
  usuarios: { id: string; nombre: string }[]
  /** valores[fila][columna], alineado con `fechas` y `usuarios`. */
  valores: number[][]
  totalesPorFecha: number[]
}

export interface FilaMes {
  mes: string
  porAmbito: Record<
    Ambito,
    {
      registros: number
      unidades: number
      minutos: number
      finalizadas: number
      dias: number
      usuarios: number
      promedioPorCajaMin: number | null
      promedioRegistrosDia: number | null
      promedioUnidadesDia: number | null
    }
  >
}

export const AMBITOS: Ambito[] = ['ecuador', 'mexico', 'eeuu', 'general']

export const AMBITO_LABEL: Record<Ambito, string> = {
  ecuador: 'Ecuador',
  mexico: 'México',
  eeuu: 'EE.UU',
  general: 'General',
}

function metricasVacias(): MetricasBloque {
  return { cajas: 0, unidades: 0, minutos: 0, finalizadas: 0, promedioPorCajaMin: null }
}

function redondear1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Promedio ponderado, no promedio de promedios. Ver nota de cabecera. */
function cerrarPromedio(m: MetricasBloque): MetricasBloque {
  m.promedioPorCajaMin = m.finalizadas > 0 ? redondear1(m.minutos / m.finalizadas) : null
  return m
}

function acumular(m: MetricasBloque, r: RegistroReporte): void {
  m.cajas += 1
  m.unidades += Math.round(r.unidadEmpaque)
  if (r.horaFinalizacion) {
    m.finalizadas += 1
    m.minutos += calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion) ?? 0
  }
}

/** Día en formato YYYY-MM-DD. `fecha` es @db.Date, así que no hay zona horaria que resolver. */
export function diaDe(r: RegistroReporte): string {
  return formatDateOnly(r.fecha) ?? ''
}

export function mesDe(r: RegistroReporte): string {
  return diaDe(r).slice(0, 7)
}

function ordenarPorNombre<T extends { nombre: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// ── Hoja "Tiempos por usuario" ───────────────────────────────────────

export function tiemposPorUsuario(registros: RegistroReporte[]): FilaUsuario[] {
  const porUsuario = new Map<string, FilaUsuario>()

  for (const r of registros) {
    let fila = porUsuario.get(r.creadoPorId)
    if (!fila) {
      fila = {
        usuarioId: r.creadoPorId,
        nombre: r.creadoPorNombre,
        porAmbito: {
          ecuador: metricasVacias(),
          mexico: metricasVacias(),
          eeuu: metricasVacias(),
          general: metricasVacias(),
        },
      }
      porUsuario.set(r.creadoPorId, fila)
    }
    acumular(fila.porAmbito[r.pais], r)
    acumular(fila.porAmbito.general, r)
  }

  const filas = Array.from(porUsuario.values())
  for (const fila of filas) {
    for (const ambito of AMBITOS) cerrarPromedio(fila.porAmbito[ambito])
  }
  // Por cajas totales desc: la lectura natural es "quién movió más".
  return filas.sort(
    (a, b) =>
      b.porAmbito.general.cajas - a.porAmbito.general.cajas || a.nombre.localeCompare(b.nombre, 'es'),
  )
}

/** Fila "Total" del pie de la hoja. Mismos ámbitos, mismos promedios ponderados. */
export function totalTiempos(filas: FilaUsuario[]): Record<Ambito, MetricasBloque> {
  const total = {
    ecuador: metricasVacias(),
    mexico: metricasVacias(),
    eeuu: metricasVacias(),
    general: metricasVacias(),
  } as Record<Ambito, MetricasBloque>

  for (const fila of filas) {
    for (const ambito of AMBITOS) {
      const src = fila.porAmbito[ambito]
      const dst = total[ambito]
      dst.cajas += src.cajas
      dst.unidades += src.unidades
      dst.minutos += src.minutos
      dst.finalizadas += src.finalizadas
    }
  }
  for (const ambito of AMBITOS) cerrarPromedio(total[ambito])
  return total
}

// ── Hojas "… por día" ────────────────────────────────────────────────

export type MetricaDiaria = 'unidades' | 'registros'

/**
 * Una matriz por ámbito (los 3 países + general). Las fechas son las del ámbito,
 * no las globales: un país que no operó un día no arrastra una fila en blanco.
 * Los usuarios sí son los mismos en los 4 bloques para poder comparar columnas.
 */
export function matricesDiarias(
  registros: RegistroReporte[],
  metrica: MetricaDiaria,
): MatrizDiaria[] {
  const usuarios = ordenarPorNombre(
    Array.from(
      new Map(
        registros.map((r) => [r.creadoPorId, { id: r.creadoPorId, nombre: r.creadoPorNombre }]),
      ).values(),
    ),
  )
  const indicePorUsuario = new Map(usuarios.map((u, i) => [u.id, i]))

  return AMBITOS.map((ambito) => {
    const delAmbito = ambito === 'general' ? registros : registros.filter((r) => r.pais === ambito)
    const porFecha = new Map<string, number[]>()

    for (const r of delAmbito) {
      const dia = diaDe(r)
      if (!dia) continue
      let fila = porFecha.get(dia)
      if (!fila) {
        fila = new Array<number>(usuarios.length).fill(0)
        porFecha.set(dia, fila)
      }
      const col = indicePorUsuario.get(r.creadoPorId)
      if (col === undefined) continue
      fila[col] += metrica === 'unidades' ? Math.round(r.unidadEmpaque) : 1
    }

    const fechas = Array.from(porFecha.keys()).sort()
    const valores = fechas.map((f) => porFecha.get(f)!)
    return {
      ambito,
      fechas,
      usuarios,
      valores,
      totalesPorFecha: valores.map((fila) => fila.reduce((a, b) => a + b, 0)),
    }
  })
}

// ── Hoja "Promedios mensuales" ───────────────────────────────────────

export function promediosMensuales(registros: RegistroReporte[]): FilaMes[] {
  interface Acc {
    registros: number
    unidades: number
    minutos: number
    finalizadas: number
    dias: Set<string>
    usuarios: Set<string>
  }
  const nuevoAcc = (): Acc => ({
    registros: 0,
    unidades: 0,
    minutos: 0,
    finalizadas: 0,
    dias: new Set(),
    usuarios: new Set(),
  })

  const porMes = new Map<string, Record<Ambito, Acc>>()

  for (const r of registros) {
    const mes = mesDe(r)
    if (!mes) continue
    let fila = porMes.get(mes)
    if (!fila) {
      fila = { ecuador: nuevoAcc(), mexico: nuevoAcc(), eeuu: nuevoAcc(), general: nuevoAcc() }
      porMes.set(mes, fila)
    }
    for (const acc of [fila[r.pais], fila.general]) {
      acc.registros += 1
      acc.unidades += Math.round(r.unidadEmpaque)
      acc.dias.add(diaDe(r))
      acc.usuarios.add(r.creadoPorId)
      if (r.horaFinalizacion) {
        acc.finalizadas += 1
        acc.minutos += calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion) ?? 0
      }
    }
  }

  return Array.from(porMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, ambitos]) => {
      const porAmbito = {} as FilaMes['porAmbito']
      for (const ambito of AMBITOS) {
        const acc = ambitos[ambito]
        // Los días son los días *con actividad*, no los del calendario: un promedio
        // diario dividido entre 30 cuando solo se trabajaron 8 no dice nada.
        const dias = acc.dias.size
        porAmbito[ambito] = {
          registros: acc.registros,
          unidades: acc.unidades,
          minutos: acc.minutos,
          finalizadas: acc.finalizadas,
          dias,
          usuarios: acc.usuarios.size,
          promedioPorCajaMin: acc.finalizadas > 0 ? redondear1(acc.minutos / acc.finalizadas) : null,
          promedioRegistrosDia: dias > 0 ? redondear1(acc.registros / dias) : null,
          promedioUnidadesDia: dias > 0 ? redondear1(acc.unidades / dias) : null,
        }
      }
      return { mes, porAmbito }
    })
}
