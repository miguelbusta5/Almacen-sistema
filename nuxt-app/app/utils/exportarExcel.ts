// Exportar a Excel lo que muestra una pestaña de Indicadores: las mismas
// tablas (columnas y filas ya formateadas), una hoja por tabla.
//
// Se arma en el navegador con exceljs, que se carga solo al exportar (pesa
// ~1 MB y nadie lo necesita para mirar la pantalla).
import type { ColumnaTabla } from '~/utils/indicadores'

export interface HojaExcel {
  nombre: string
  columnas: ColumnaTabla[]
  filas: Array<Record<string, string | number>>
}

/** Nombre de hoja valido para Excel: 31 caracteres, sin : \ / ? * [ ]. */
export function nombreHoja(nombre: string): string {
  return nombre.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Hoja'
}

/** "12,5 %" o "1.234" tal cual se ven; los numeros puros quedan como numero. */
function valorCelda(v: string | number): string | number {
  if (typeof v === 'number') return v
  const limpio = v.replace(/\./g, '').replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : v
}

export async function exportarExcel(archivo: string, hojas: HojaExcel[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Grupo Ambiente · Indicadores'
  const usados = new Set<string>()
  for (const h of hojas) {
    let nombre = nombreHoja(h.nombre)
    for (let i = 2; usados.has(nombre); i++) nombre = nombreHoja(`${h.nombre} ${i}`)
    usados.add(nombre)
    const hoja = libro.addWorksheet(nombre)
    hoja.columns = h.columnas.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }))
    hoja.getRow(1).font = { bold: true }
    for (const f of h.filas) {
      hoja.addRow(Object.fromEntries(h.columnas.map((c) => [c.key, valorCelda(f[c.key] ?? '')])))
    }
    hoja.views = [{ state: 'frozen', ySplit: 1 }]
  }
  const buffer = await libro.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = archivo.endsWith('.xlsx') ? archivo : `${archivo}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
