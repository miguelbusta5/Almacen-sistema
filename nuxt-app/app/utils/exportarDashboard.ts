// Exportar un área de Indicadores COMPLETA a Excel (24-09): el dashboard hecho
// Excel de verdad, no fotos.
//
// Por cada pestaña, una hoja con:
// - Las tarjetas de cifras (valor, detalle, contra el periodo anterior, meta).
// - Cada gráfico como GRÁFICO NATIVO de Excel, al lado de sus datos en una
//   Tabla de Excel con filtros: al filtrar la tabla, el gráfico cambia.
// - Todas las tablas de la pestaña, también como Tablas con filtros.
// Más una portada con el periodo, los filtros y el índice.
//
// Cómo se sacan los datos sin reescribir cada pantalla: el módulo abre cada
// pestaña de verdad y, mientras se exporta, los componentes se anotan en el
// colector — IndicadoresTabla con sus filas, los gráficos (BarrasH,
// BarrasApiladas, LineaDiaria) con sus series — y las tarjetas de cifras
// llevan atributos data-kpi que se leen del DOM.
import { inject, onBeforeUnmount, watchEffect, type InjectionKey, type Ref } from 'vue'
import type { ColumnaTabla } from '~/utils/indicadores'
import { fmtDiaCorto } from '~/utils/indicadores'
import { nombreHoja, type HojaExcel } from '~/utils/exportarExcel'
import {
  agregarGraficos, letraColumna, rangoAbs, refHoja, type GraficoXlsx, type TipoGraficoXlsx,
} from '~/utils/graficosXlsx'

// ── Colector ────────────────────────────────────────────────────────

export interface TablaRegistrada {
  el: HTMLElement
  titulo: string
  columnas: ColumnaTabla[]
  filas: Array<Record<string, string | number>>
}

export interface SerieRegistrada {
  nombre: string
  valores: Array<number | null>
  /** RRGGBB. */
  color: string
  colores?: Array<string | null>
}

export interface GraficoRegistrado {
  el: HTMLElement
  /** Tarjeta que lo contiene: las líneas de una misma tarjeta van en un solo gráfico. */
  tarjeta: symbol | null
  titulo: string
  subtitulo: string
  tipo: TipoGraficoXlsx
  /** Encabezado de la columna de categorías ("Día", "Nombre"). */
  categoria: string
  /** En las líneas, días YYYY-MM-DD (se juntan por día y se rotulan al escribir). */
  categorias: string[]
  series: SerieRegistrada[]
}

export interface ColectorExport {
  /** true mientras se exporta: las tarjetas montan su tabla y todo se anota. */
  activo: Ref<boolean>
  tablas: Map<symbol, TablaRegistrada>
  graficos: Map<symbol, GraficoRegistrado>
}

export function crearColector(activo: Ref<boolean>): ColectorExport {
  return { activo, tablas: new Map(), graficos: new Map() }
}

export const CLAVE_COLECTOR: InjectionKey<ColectorExport> = Symbol('colector-export')

export interface TarjetaExport {
  id: symbol
  titulo: () => string
  subtitulo: () => string
}
/** La tarjeta que envuelve una tabla o un gráfico: le da título y subtítulo. */
export const CLAVE_TARJETA: InjectionKey<TarjetaExport> = Symbol('tarjeta-export')

/**
 * Color CSS ("var(--u-ok)", "#10B981", "rgb(...)") → RRGGBB, resuelto contra
 * los tokens del elemento. Lo que el navegador no sepa pintar queda en el
 * color de la medida.
 */
export function colorHex(el: Element, css: string | undefined, defecto = '4A3AA7'): string {
  if (!css) return defecto
  let v = css.trim()
  const variable = v.match(/^var\((--[\w-]+)\)$/)
  if (variable) v = getComputedStyle(el).getPropertyValue(variable[1]!).trim()
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx || !v) return defecto
  ctx.fillStyle = '#010203'
  ctx.fillStyle = v
  const r = String(ctx.fillStyle)
  if (r === '#010203') return defecto
  if (r.startsWith('#')) return r.slice(1, 7).toUpperCase()
  const n = r.match(/\d+(\.\d+)?/g)
  return n && n.length >= 3 ? n.slice(0, 3).map((x) => Math.round(Number(x)).toString(16).padStart(2, '0')).join('').toUpperCase() : defecto
}

/** "5 min" → "min"; "12 %" → "%"; "3" → "". La unidad que pinta un formato de eje. */
export function unidadDeFormato(formato: ((v: number) => string) | undefined): string {
  if (!formato) return ''
  return formato(1).replace(/[\d.,\s−-]+/g, ' ').trim()
}

/**
 * Un gráfico se anota en el colector mientras se exporta. Se llama en el
 * setup del componente con su elemento raíz y cómo armar sus datos.
 */
export function usarRegistroGrafico(
  raiz: Ref<HTMLElement | null>,
  construir: (el: HTMLElement) => Omit<GraficoRegistrado, 'el' | 'tarjeta' | 'titulo' | 'subtitulo'> | null,
): void {
  const colector = inject(CLAVE_COLECTOR, null)
  const tarjeta = inject(CLAVE_TARJETA, null)
  if (!colector) return
  const id = Symbol('grafico')
  watchEffect(() => {
    if (!colector.activo.value || !raiz.value) return
    const datos = construir(raiz.value)
    if (!datos || !datos.categorias.length) { colector.graficos.delete(id); return }
    colector.graficos.set(id, {
      ...datos, el: raiz.value, tarjeta: tarjeta?.id ?? null,
      titulo: tarjeta?.titulo() ?? '', subtitulo: tarjeta?.subtitulo() ?? '',
    })
  })
  onBeforeUnmount(() => colector.graficos.delete(id))
}

// ── Recorrer la pestaña ─────────────────────────────────────────────

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Hay algo cargando dentro: esqueletos, spinners o contenido atenuado. */
const CARGANDO = '.sk-line, .cargando, .recargando, .spin'

/** Espera a que la pestaña termine de cargar y a que sus gráficos se anoten. */
export async function esperarListo(raiz: () => HTMLElement | null, maxMs = 20_000): Promise<void> {
  const inicio = Date.now()
  let quietas = 0
  await esperar(150)
  while (Date.now() - inicio < maxMs) {
    const r = raiz()
    const ocupado = !r || !!r.querySelector(CARGANDO)
    quietas = ocupado ? 0 : quietas + 1
    if (quietas >= 3) break
    await esperar(150)
  }
  await esperar(200)
}

const enOrden = <T extends { el: Element }>(a: T, b: T) =>
  (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)

/** Tablas de la pestaña: las del colector (datos exactos) y las HTML sueltas. */
export function tablasDePestana(raiz: HTMLElement, colector: ColectorExport): Array<HojaExcel & { titulo: string }> {
  const registradas = [...colector.tablas.values()].filter((t) => raiz.contains(t.el))
  const vistas = new Set(registradas.map((t) => t.el))
  const sueltas: TablaRegistrada[] = []
  for (const tabla of Array.from(raiz.querySelectorAll('table'))) {
    if (vistas.has(tabla as HTMLElement) || [...vistas].some((v) => v.contains(tabla))) continue
    const cabeza = Array.from(tabla.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '')
    if (!cabeza.length) continue
    const columnas = cabeza.map((label, i) => ({ key: `c${i}`, label }))
    const filas = Array.from(tabla.querySelectorAll('tbody tr')).map((tr) =>
      Object.fromEntries(Array.from(tr.querySelectorAll('td')).map((td, i) => [`c${i}`, td.textContent?.trim() ?? ''])))
    const titulo = tabla.closest('section')?.querySelector('h2, h3')?.textContent?.trim() ?? ''
    sueltas.push({ el: tabla as HTMLElement, titulo, columnas, filas })
  }
  // Una tarjeta cuya tabla ES su contenido la tiene dos veces (la de pantalla y
  // la copia oculta del export): va una sola.
  const unicas = new Set<string>()
  return [...registradas, ...sueltas]
    .filter((t) => t.filas.length)
    .sort(enOrden)
    .filter((t) => {
      const clave = JSON.stringify([t.titulo, t.columnas.map((c) => c.label), t.filas.length, t.filas[0], t.filas[t.filas.length - 1]])
      if (unicas.has(clave)) return false
      unicas.add(clave)
      return true
    })
    .map((t) => ({ nombre: t.titulo || 'Datos', titulo: t.titulo || 'Datos', columnas: t.columnas, filas: t.filas }))
}

export interface Kpi { indicador: string; valor: string; detalle: string; cambio: string; meta: string }

/** Las tarjetas de cifras marcadas con data-kpi, en el orden de la pantalla. */
export function kpisDePestana(raiz: HTMLElement): Kpi[] {
  const texto = (el: Element, sel: string) => Array.from(el.querySelectorAll(sel))
    .map((x) => x.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter(Boolean).join(' · ')
  return Array.from(raiz.querySelectorAll('[data-kpi]')).map((k) => ({
    indicador: texto(k, '[data-kpi-label]'),
    valor: texto(k, '[data-kpi-valor]'),
    detalle: texto(k, '[data-kpi-nota]'),
    cambio: texto(k, '[data-kpi-cambio]'),
    meta: texto(k, '[data-kpi-meta]'),
  })).filter((k) => k.indicador || k.valor)
}

/** Párrafos que explican cómo se calcula algo (data-export-nota). */
export function notasDePestana(raiz: HTMLElement): string[] {
  return Array.from(raiz.querySelectorAll('[data-export-nota]'))
    .map((n) => n.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter(Boolean)
}

/**
 * Gráficos de la pestaña, en orden. Las líneas de una misma tarjeta (una por
 * persona, o inspeccionadas y entregadas) se juntan en un solo gráfico de
 * varias series, con los días de todas.
 */
export function graficosDePestana(raiz: HTMLElement, colector: ColectorExport): GraficoRegistrado[] {
  const lista = [...colector.graficos.values()].filter((g) => raiz.contains(g.el)).sort(enOrden)
  const out: GraficoRegistrado[] = []
  for (const g of lista) {
    const previo = out[out.length - 1]
    if (g.tipo === 'linea' && previo?.tipo === 'linea' && g.tarjeta && previo.tarjeta === g.tarjeta) {
      const dias = [...new Set([...previo.categorias, ...g.categorias])].sort()
      const reindexar = (s: SerieRegistrada, cats: string[]) => ({
        ...s, valores: dias.map((d) => { const i = cats.indexOf(d); return i >= 0 ? s.valores[i] ?? null : null }),
      })
      out[out.length - 1] = {
        ...previo,
        categorias: dias,
        series: [...previo.series.map((s) => reindexar(s, previo.categorias)), ...g.series.map((s) => reindexar(s, g.categorias))],
      }
      continue
    }
    out.push(g)
  }
  // Varias líneas en un gráfico: cada una con su color (en pantalla eran
  // gráficos separados, todos del color de la medida).
  return out.map((g) => (g.tipo === 'linea' && g.series.length > 1
    ? { ...g, series: g.series.map((x, i) => ({ ...x, color: PALETA_SERIES[i % PALETA_SERIES.length]! })) }
    : g))
}

/** Los --viz-* del sistema, en orden fijo (tokens.css). */
export const PALETA_SERIES = ['4A3AA7', 'EB6834', '1BAF7A', '2A78D6', 'EDA100', 'E87BA4', '8A63D2', '0CA30C', 'D03B3B', '0E7490', 'A16207', '6B7280']

export interface SeccionDashboard {
  nombre: string
  kpis: Kpi[]
  notas: string[]
  graficos: GraficoRegistrado[]
  tablas: Array<HojaExcel & { titulo: string }>
}

// ── El libro ────────────────────────────────────────────────────────

const FORMATO_PESOS = '"$" #,##0'

/**
 * Lo que se ve en pantalla, como celda: "1.234" y "$ 65.540.300" pasan a
 * número (el segundo con formato de pesos); lo demás queda como texto.
 */
export function valorCelda(v: string | number | null | undefined): { valor: string | number | null; formato?: string } {
  if (v == null) return { valor: null }
  if (typeof v === 'number') return { valor: v }
  const pesos = v.match(/^\$\s?(-?[\d.]+(?:,\d+)?)$/)
  if (pesos) return { valor: Number(pesos[1]!.replace(/\./g, '').replace(',', '.')), formato: FORMATO_PESOS }
  const limpio = v.replace(/\./g, '').replace(',', '.')
  return { valor: /^-?\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : v }
}

/** Encabezados de una Tabla de Excel: no vacíos y sin repetir. */
export function encabezadosUnicos(nombres: string[]): string[] {
  const vistos = new Map<string, number>()
  return nombres.map((n, i) => {
    const base = n.trim() || `Columna ${i + 1}`
    const k = base.toLowerCase()
    const veces = (vistos.get(k) ?? 0) + 1
    vistos.set(k, veces)
    return veces === 1 ? base : `${base} (${veces})`
  })
}

const VERDE = 'FF0E9F74'
const GRIS_TEXTO = 'FF6B7785'
const ESTILO_TABLA = 'TableStyleMedium2'
/** El gráfico va sobre las columnas A–I (760 px fijos: caben en ellas); sus datos empiezan en K. */
const COLS_GRAFICO = 9
const COL_DATOS = 10
const ANCHO_GRAFICO_PX = 760
const ALTO_FILA_PX = 20

/** Arma el libro: portada + una hoja por pestaña. */
export async function libroDashboard(opts: {
  titulo: string
  filtros: Array<[string, string]>
  secciones: SeccionDashboard[]
}): Promise<ArrayBuffer> {
  const modulo = await import('exceljs')
  const ExcelJS = (modulo as unknown as { default?: typeof modulo }).default ?? modulo
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Grupo Ambiente · Indicadores'
  const usados = new Set<string>(['Portada'])
  const graficos: GraficoXlsx[] = []

  // ── Portada ──
  const portada = libro.addWorksheet('Portada', { views: [{ showGridLines: false }] })
  portada.getColumn(1).width = 24
  portada.getColumn(2).width = 70
  portada.getCell('A1').value = opts.titulo
  portada.getCell('A1').font = { bold: true, size: 18, color: { argb: VERDE } }
  portada.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-CO')}`
  portada.getCell('A2').font = { color: { argb: GRIS_TEXTO } }
  let filaPortada = 4
  for (const [k, v] of opts.filtros) {
    portada.getCell(`A${filaPortada}`).value = k
    portada.getCell(`A${filaPortada}`).font = { bold: true }
    portada.getCell(`B${filaPortada}`).value = v
    filaPortada++
  }
  filaPortada++
  portada.getCell(`A${filaPortada}`).value = 'Contenido'
  portada.getCell(`A${filaPortada}`).font = { bold: true, size: 13 }
  filaPortada++
  portada.getCell(`A${filaPortada + opts.secciones.length + 1}`).value =
    'Cada gráfico está enlazado a la tabla de su derecha: filtra la tabla y el gráfico cambia.'
  portada.getCell(`A${filaPortada + opts.secciones.length + 1}`).font = { italic: true, color: { argb: GRIS_TEXTO } }

  opts.secciones.forEach((s, iHoja) => {
    let nombre = nombreHoja(s.nombre)
    for (let i = 2; usados.has(nombre); i++) nombre = nombreHoja(`${s.nombre} ${i}`)
    usados.add(nombre)
    const enlace = portada.getCell(`A${filaPortada++}`)
    enlace.value = { text: s.nombre, hyperlink: `#'${nombre.replace(/'/g, "''")}'!A1` }
    enlace.font = { color: { argb: VERDE }, underline: true }

    const hoja = libro.addWorksheet(nombre, { views: [{ showGridLines: false }] })
    for (let c = 1; c <= COLS_GRAFICO; c++) hoja.getColumn(c).width = 13
    hoja.getColumn(COLS_GRAFICO + 1).width = 3
    hoja.getCell('A1').value = `${s.nombre} · ${opts.titulo}`
    hoja.getCell('A1').font = { bold: true, size: 15, color: { argb: VERDE } }
    hoja.getCell('A2').value = opts.filtros.map(([k, v]) => `${k}: ${v}`).join('   ·   ')
    hoja.getCell('A2').font = { color: { argb: GRIS_TEXTO } }
    let fila = 4 // 1-based
    let nTabla = 0
    const nombreTabla = (pref: string) => `${pref}_${iHoja + 1}_${++nTabla}`
    const anchoCol = (c: number, texto: unknown) => {
      const col = hoja.getColumn(c)
      col.width = Math.min(50, Math.max(col.width ?? 10, String(texto ?? '').length + 3))
    }
    const tituloBloque = (texto: string, sub?: string) => {
      hoja.getCell(`A${fila}`).value = texto
      hoja.getCell(`A${fila}`).font = { bold: true, size: 12 }
      fila++
      if (sub) {
        hoja.getCell(`A${fila}`).value = sub
        hoja.getCell(`A${fila}`).font = { color: { argb: GRIS_TEXTO }, size: 10 }
        fila++
      }
    }
    /** Escribe una Tabla de Excel (con filtros) y devuelve dónde quedó. */
    const escribirTabla = (colIni: number, filaIni: number, cabeceras: string[], filas: Array<Array<string | number | null>>, formatos: Array<string | undefined> = [], pref = 'Datos') => {
      const nombres = encabezadosUnicos(cabeceras)
      hoja.addTable({
        name: nombreTabla(pref),
        ref: `${letraColumna(colIni)}${filaIni}`,
        headerRow: true,
        style: { theme: ESTILO_TABLA, showRowStripes: true },
        columns: nombres.map((n) => ({ name: n, filterButton: true })),
        rows: filas.length ? filas : [nombres.map(() => null)],
      })
      nombres.forEach((n, i) => anchoCol(colIni + 1 + i, n))
      filas.forEach((f, r) => f.forEach((v, i) => {
        if (formatos[i]) hoja.getCell(filaIni + 1 + r, colIni + 1 + i).numFmt = formatos[i]!
        anchoCol(colIni + 1 + i, v)
      }))
      return { filaFin: filaIni + Math.max(1, filas.length) }
    }

    // ── Tarjetas de cifras ──
    if (s.kpis.length) {
      tituloBloque('Indicadores')
      const filas = s.kpis.map((k) => [k.indicador, valorCelda(k.valor).valor, k.detalle, k.cambio, k.meta])
      const { filaFin } = escribirTabla(0, fila, ['Indicador', 'Valor', 'Detalle', 'Vs periodo anterior', 'Meta'], filas, [], 'Cifras')
      fila = filaFin + 2
    }
    for (const n of s.notas) {
      hoja.getCell(`A${fila}`).value = n
      hoja.getCell(`A${fila}`).font = { color: { argb: 'FF374151' } }
      fila++
    }
    if (s.notas.length) fila++

    // ── Gráficos, cada uno con sus datos a la derecha ──
    const porTitulo = new Map<string, number>()
    for (const g of s.graficos) {
      const n = g.categorias.length
      const vecesTitulo = (porTitulo.get(g.titulo) ?? 0) + 1
      porTitulo.set(g.titulo, vecesTitulo)
      const titulo = (g.titulo || 'Gráfico') + (vecesTitulo > 1 || s.graficos.filter((x) => x.titulo === g.titulo).length > 1
        ? ` · ${g.series.map((x) => x.nombre).join(', ')}` : '')
      tituloBloque(titulo, g.subtitulo)
      const filaDatos = fila
      const rotulos = g.tipo === 'linea' ? g.categorias.map(fmtDiaCorto) : g.categorias
      const filas = rotulos.map((c, i) => [c, ...g.series.map((x) => x.valores[i] ?? null)])
      escribirTabla(COL_DATOS, filaDatos, [g.categoria, ...g.series.map((x) => x.nombre)], filas, [], 'Grafico')
      const altoFilas = g.tipo === 'linea' ? 18 : Math.min(60, Math.max(14, Math.round(6 + n * 1.5)))
      const primera = filaDatos + 1
      const ultima = filaDatos + n
      graficos.push({
        hoja: nombre,
        tipo: g.tipo,
        titulo,
        desde: { col: 0, fila: filaDatos - 1 },
        tamano: { ancho: ANCHO_GRAFICO_PX, alto: altoFilas * ALTO_FILA_PX },
        categorias: { ref: refHoja(nombre, rangoAbs(COL_DATOS, primera, ultima)), valores: rotulos },
        series: g.series.map((x, i) => ({
          nombre: encabezadosUnicos([g.categoria, ...g.series.map((y) => y.nombre)])[i + 1]!,
          nombreRef: refHoja(nombre, rangoAbs(COL_DATOS + 1 + i, filaDatos, filaDatos)),
          ref: refHoja(nombre, rangoAbs(COL_DATOS + 1 + i, primera, ultima)),
          valores: x.valores,
          color: x.color,
          colores: x.colores,
        })),
      })
      fila = Math.max(filaDatos + altoFilas, ultima + 1) + 3
    }

    // ── Todas las tablas de la pestaña ──
    if (s.tablas.length) {
      hoja.getCell(`A${fila}`).value = 'Datos'
      hoja.getCell(`A${fila}`).font = { bold: true, size: 14, color: { argb: VERDE } }
      fila += 2
    }
    for (const t of s.tablas) {
      tituloBloque(t.titulo)
      const celdas = t.filas.map((f) => t.columnas.map((c) => valorCelda(f[c.key])))
      const formatos = t.columnas.map((_, i) => celdas.find((f) => f[i]?.formato)?.[i]?.formato)
      const { filaFin } = escribirTabla(0, fila, t.columnas.map((c) => c.label), celdas.map((f) => f.map((x) => x.valor)), formatos)
      fila = filaFin + 3
    }
  })

  const buffer = await libro.xlsx.writeBuffer() as ArrayBuffer
  return agregarGraficos(buffer, graficos)
}

export function descargarLibro(buffer: ArrayBuffer, archivo: string): void {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = archivo.endsWith('.xlsx') ? archivo : `${archivo}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Recorre las pestañas, junta lo de cada una y descarga el libro. `irA` abre
 * la pestaña en el módulo; al final se vuelve a la que estaba.
 */
export async function exportarDashboard(opts: {
  archivo: string
  titulo: string
  filtros: Array<[string, string]>
  pestanas: ReadonlyArray<{ key: string; label: string }>
  actual: string
  irA: (key: string) => void
  raiz: () => HTMLElement | null
  colector: ColectorExport
  progreso?: (texto: string) => void
}): Promise<void> {
  const { nextTick } = await import('vue')
  const secciones: SeccionDashboard[] = []
  opts.colector.activo.value = true
  try {
    for (const [i, p] of opts.pestanas.entries()) {
      opts.progreso?.(`${p.label} (${i + 1} de ${opts.pestanas.length})`)
      opts.irA(p.key)
      await nextTick()
      await esperarListo(opts.raiz)
      const raiz = opts.raiz()
      if (!raiz) continue
      secciones.push({
        nombre: p.label,
        kpis: kpisDePestana(raiz),
        notas: notasDePestana(raiz),
        graficos: graficosDePestana(raiz, opts.colector),
        tablas: tablasDePestana(raiz, opts.colector),
      })
    }
  } finally {
    opts.colector.activo.value = false
    opts.irA(opts.actual)
  }
  opts.progreso?.('Armando el Excel…')
  descargarLibro(await libroDashboard({ titulo: opts.titulo, filtros: opts.filtros, secciones }), opts.archivo)
}
