// Exportar un área de Indicadores COMPLETA a Excel, como se ve el dashboard
// (24-09): una hoja por pestaña con sus tarjetas y gráficos (imagen) y, debajo,
// todos los datos de sus tablas como celdas. Más una portada con el periodo y
// los filtros.
//
// Cómo sale igual a la pantalla sin reescribir cada gráfico:
// - Se recorre cada pestaña de verdad (el módulo la abre), se espera a que
//   cargue y se fotografían sus bloques con html-to-image.
// - Mientras se exporta, cada IndicadoresTarjeta monta también su tabla (oculta)
//   y cada IndicadoresTabla se anota en el colector con sus columnas y filas:
//   los datos van al Excel como números, no como texto de la pantalla.
// - Las tablas HTML que no son IndicadoresTabla se leen del DOM.
import type { InjectionKey, Ref } from 'vue'
import type { ColumnaTabla } from '~/utils/indicadores'
import { nombreHoja, type HojaExcel } from '~/utils/exportarExcel'

export interface TablaRegistrada {
  el: HTMLElement
  titulo: string
  columnas: ColumnaTabla[]
  filas: Array<Record<string, string | number>>
}

export interface ColectorExport {
  /** true mientras se exporta: las tarjetas montan su tabla y las tablas se anotan. */
  activo: Ref<boolean>
  tablas: Map<symbol, TablaRegistrada>
}

export const CLAVE_COLECTOR: InjectionKey<ColectorExport> = Symbol('colector-export')
/** Título de la tarjeta que envuelve una tabla: nombra su bloque de datos. */
export const CLAVE_TITULO_TARJETA: InjectionKey<() => string> = Symbol('titulo-tarjeta')

export interface SeccionDashboard {
  nombre: string
  imagenes: Array<{ png: string; ancho: number; alto: number }>
  tablas: Array<HojaExcel & { titulo: string }>
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Hay algo cargando dentro: esqueletos, spinners o contenido atenuado. */
const CARGANDO = '.sk-line, .cargando, .recargando, .spin'

/** Espera a que la pestaña termine de cargar (y a que los gráficos midan su ancho). */
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
  // Los gráficos miden su ancho con ResizeObserver al montarse.
  await esperar(350)
}

/**
 * No se fotografían los botones ni lo marcado para omitir. Los campos sí: en
 * la proyección muestran la plantilla con que se calculó.
 */
function filtroCaptura(n: HTMLElement): boolean {
  if (!(n instanceof HTMLElement)) return true
  if (n.dataset?.exportOmitir != null) return false
  return n.tagName !== 'BUTTON'
}

const ALTO_MAX_BLOQUE = 1400
/** Un bloque que no se deja fotografiar en este tiempo se salta (sus datos siguen). */
const MS_MAX_BLOQUE = 20_000

/**
 * Solo las fuentes del alfabeto latino: el CSS completo de Inter y Sora (todas
 * las variantes y alfabetos) pesa 3-4 MB y se incrustaría en CADA imagen. El
 * navegador escribe el rango latino como «U+0-FF» (no «U+0000-00FF»).
 */
export function fuentesLatinas(css: string): string {
  // La misma fuente viene declarada varias veces (una por hoja de estilos): una basta.
  const vistas = new Set<string>()
  const dato = (regla: string, prop: RegExp) => regla.match(prop)?.[1]?.trim() ?? ''
  return (css.match(/@font-face\s*{[^}]*}/g) ?? [])
    .filter((regla) => !/unicode-range/i.test(regla) || /U\+0+-0*FF\b/i.test(regla))
    .filter((regla) => {
      const clave = [/font-family:\s*([^;]+)/, /font-weight:\s*([^;]+)/, /font-style:\s*([^;]+)/].map((p) => dato(regla, p)).join('|')
      if (vistas.has(clave)) return false
      vistas.add(clave)
      return true
    })
    .join('\n')
}

function conLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error('tiempo agotado')), ms))])
}

/**
 * Bloques a fotografiar: los hijos de la raíz. Uno muy alto se parte en sus
 * hijos; una tabla muy alta no se fotografía (sus datos van como celdas).
 */
function bloques(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (const hijo of Array.from(el.children) as HTMLElement[]) {
    if (hijo.dataset.exportOmitir != null) continue
    const alto = hijo.offsetHeight
    if (!alto || !hijo.offsetWidth) continue
    if (alto > ALTO_MAX_BLOQUE) {
      if (hijo.tagName === 'TABLE' || hijo.querySelector(':scope > table')) continue
      const partes = bloques(hijo)
      if (partes.length) out.push(...partes)
      continue
    }
    out.push(hijo)
  }
  return out
}

const PROPS_SVG = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'opacity', 'font-size', 'font-weight', 'font-family', 'font-variant-numeric',
  'text-anchor', 'dominant-baseline', 'shape-rendering', 'visibility', 'display',
]

/**
 * html-to-image copia un <svg> entero sin recorrer sus hijos, así que los
 * gráficos pintados con clases CSS (líneas, puntos, ejes) salían negros. Se
 * escriben sus estilos calculados en línea mientras se fotografía; devuelve
 * cómo dejarlo como estaba.
 */
function estilosSvgEnLinea(raiz: HTMLElement): () => void {
  const previos: Array<[Element, string | null]> = []
  for (const el of Array.from(raiz.querySelectorAll('svg *'))) {
    previos.push([el, el.getAttribute('style')])
    const cs = getComputedStyle(el)
    const enLinea = PROPS_SVG.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';')
    el.setAttribute('style', `${el.getAttribute('style') ?? ''};${enLinea}`)
  }
  return () => {
    for (const [el, st] of previos) {
      if (st == null) el.removeAttribute('style')
      else el.setAttribute('style', st)
    }
  }
}

/** Fotografía los bloques de la pestaña abierta. `fuentes`: CSS ya recortado (una vez por exportación). */
export async function capturarPestana(raiz: HTMLElement, fuentes?: string): Promise<SeccionDashboard['imagenes']> {
  const { toPng } = await import('html-to-image')
  const fondo = getComputedStyle(document.body).backgroundColor || '#ffffff'
  const imagenes: SeccionDashboard['imagenes'] = []
  for (const b of bloques(raiz)) {
    const restaurar = estilosSvgEnLinea(b)
    try {
      const png = await conLimite(toPng(b, {
        backgroundColor: fondo, pixelRatio: 1.5, filter: filtroCaptura as (n: HTMLElement) => boolean,
        fontEmbedCSS: fuentes, skipFonts: !fuentes, cacheBust: false,
      }), MS_MAX_BLOQUE)
      imagenes.push({ png, ancho: b.offsetWidth, alto: b.offsetHeight })
    } catch {
      // Un bloque que no se deja fotografiar no tumba la exportación: sus datos siguen.
    } finally {
      restaurar()
    }
  }
  return imagenes
}

/** Tablas de la pestaña: las del colector (datos exactos) y las HTML sueltas. */
export function tablasDePestana(raiz: HTMLElement, colector: ColectorExport): SeccionDashboard['tablas'] {
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
    .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .filter((t) => {
      const clave = JSON.stringify([t.titulo, t.columnas.map((c) => c.label), t.filas.length, t.filas[0], t.filas[t.filas.length - 1]])
      if (unicas.has(clave)) return false
      unicas.add(clave)
      return true
    })
    .map((t) => ({ nombre: t.titulo || 'Datos', titulo: t.titulo || 'Datos', columnas: t.columnas, filas: t.filas }))
}

const FORMATO_PESOS = '"$" #,##0'

/**
 * Lo que se ve en pantalla, como celda: "1.234" y "$ 65.540.300" pasan a
 * número (el segundo con formato de pesos); lo demás queda como texto.
 */
export function valorCelda(v: string | number | undefined): { valor: string | number; formato?: string } {
  if (v == null) return { valor: '' }
  if (typeof v === 'number') return { valor: v }
  const pesos = v.match(/^\$\s?(-?[\d.]+(?:,\d+)?)$/)
  if (pesos) return { valor: Number(pesos[1]!.replace(/\./g, '').replace(',', '.')), formato: FORMATO_PESOS }
  const limpio = v.replace(/\./g, '').replace(',', '.')
  return { valor: /^-?\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : v }
}

const VERDE = 'FF0E9F74'
const GRIS = 'FFF1F4F6'
const ALTO_FILA_PX = 20
const ANCHO_IMAGEN_MAX = 1100

/** Arma el libro: portada + una hoja por pestaña (imágenes arriba, datos abajo). */
export async function libroDashboard(opts: {
  titulo: string
  filtros: Array<[string, string]>
  secciones: SeccionDashboard[]
}): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Grupo Ambiente · Indicadores'
  const usados = new Set<string>(['Portada'])

  // ── Portada ──
  const portada = libro.addWorksheet('Portada', { views: [{ showGridLines: false }] })
  portada.getColumn(1).width = 22
  portada.getColumn(2).width = 60
  portada.getCell('A1').value = opts.titulo
  portada.getCell('A1').font = { bold: true, size: 18, color: { argb: VERDE } }
  portada.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-CO')}`
  portada.getCell('A2').font = { color: { argb: 'FF6B7785' } }
  let fila = 4
  for (const [k, v] of opts.filtros) {
    portada.getCell(`A${fila}`).value = k
    portada.getCell(`A${fila}`).font = { bold: true }
    portada.getCell(`B${fila}`).value = v
    fila++
  }
  fila++
  portada.getCell(`A${fila}`).value = 'Contenido'
  portada.getCell(`A${fila}`).font = { bold: true, size: 13 }
  fila++

  for (const s of opts.secciones) {
    let nombre = nombreHoja(s.nombre)
    for (let i = 2; usados.has(nombre); i++) nombre = nombreHoja(`${s.nombre} ${i}`)
    usados.add(nombre)
    const celda = portada.getCell(`A${fila++}`)
    celda.value = { text: s.nombre, hyperlink: `#'${nombre}'!A1` }
    celda.font = { color: { argb: VERDE }, underline: true }

    const hoja = libro.addWorksheet(nombre, { views: [{ showGridLines: false }] })
    for (let c = 1; c <= 12; c++) hoja.getColumn(c).width = 16
    hoja.getCell('A1').value = `${s.nombre} · ${opts.titulo}`
    hoja.getCell('A1').font = { bold: true, size: 15, color: { argb: VERDE } }
    hoja.getCell('A2').value = opts.filtros.map(([k, v]) => `${k}: ${v}`).join('   ·   ')
    hoja.getCell('A2').font = { color: { argb: 'FF6B7785' } }
    let r = 4 // fila (1-based) donde va lo siguiente

    // ── El dashboard: tarjetas y gráficos ──
    for (const img of s.imagenes) {
      const escala = Math.min(1, ANCHO_IMAGEN_MAX / img.ancho)
      const ancho = Math.round(img.ancho * escala)
      const alto = Math.round(img.alto * escala)
      const id = libro.addImage({ base64: img.png, extension: 'png' })
      hoja.addImage(id, { tl: { col: 0, row: r - 1 }, ext: { width: ancho, height: alto } })
      r += Math.ceil(alto / ALTO_FILA_PX) + 1
    }

    // ── Los datos ──
    if (s.tablas.length) {
      r += 1
      hoja.getCell(`A${r}`).value = 'Datos'
      hoja.getCell(`A${r}`).font = { bold: true, size: 14 }
      r += 2
    }
    for (const t of s.tablas) {
      hoja.getCell(`A${r}`).value = t.titulo
      hoja.getCell(`A${r}`).font = { bold: true, size: 12 }
      r++
      const cab = hoja.getRow(r)
      t.columnas.forEach((c, i) => {
        const x = cab.getCell(i + 1)
        x.value = c.label
        x.font = { bold: true }
        x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
        x.alignment = { horizontal: c.num ? 'right' : 'left', wrapText: true }
        const col = hoja.getColumn(i + 1)
        col.width = Math.min(45, Math.max(col.width ?? 12, c.label.length + 3))
      })
      r++
      for (const f of t.filas) {
        const row = hoja.getRow(r++)
        t.columnas.forEach((c, i) => {
          const texto = f[c.key]
          const { valor, formato } = valorCelda(texto)
          const celda = row.getCell(i + 1)
          celda.value = valor
          if (formato) celda.numFmt = formato
          const col = hoja.getColumn(i + 1)
          col.width = Math.min(45, Math.max(col.width ?? 12, String(texto ?? '').length + 2))
        })
      }
      r += 2
    }
  }
  return libro.xlsx.writeBuffer() as Promise<ArrayBuffer>
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
 * Recorre las pestañas, fotografía cada una con sus datos y descarga el libro.
 * `irA` abre la pestaña en el módulo; al final se vuelve a la que estaba.
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
  let fuentes: string | undefined
  try {
    for (const [i, p] of opts.pestanas.entries()) {
      opts.progreso?.(`${p.label} (${i + 1} de ${opts.pestanas.length})`)
      opts.irA(p.key)
      await nextTick()
      await esperarListo(opts.raiz)
      const raiz = opts.raiz()
      if (!raiz) continue
      if (fuentes === undefined) {
        const { getFontEmbedCSS } = await import('html-to-image')
        fuentes = fuentesLatinas(await conLimite(getFontEmbedCSS(raiz), MS_MAX_BLOQUE).catch(() => ''))
      }
      secciones.push({ nombre: p.label, imagenes: await capturarPestana(raiz, fuentes || undefined), tablas: tablasDePestana(raiz, opts.colector) })
    }
  } finally {
    opts.colector.activo.value = false
    opts.irA(opts.actual)
  }
  opts.progreso?.('Armando el Excel…')
  descargarLibro(await libroDashboard({ titulo: opts.titulo, filtros: opts.filtros, secciones }), opts.archivo)
}
