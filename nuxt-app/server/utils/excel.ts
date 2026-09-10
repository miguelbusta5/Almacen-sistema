// Lectura de libros de Excel en Nitro.
//
// Port de src/lib/excel.ts: Nitro no puede importar de src/lib. Solo la parte de
// LEER — los export a Excel ya construyen su propio libro en cada handler.
import ExcelJS from 'exceljs'

export type ExcelRow = unknown[]

function getCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value
  if (value == null) return null
  if (value instanceof Date) return value
  if (typeof value !== 'object') return value
  if ('text' in value && typeof value.text === 'string') return value.text
  if ('result' in value) return value.result ?? null
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('')
  }
  return String(value)
}

export async function readWorkbook(buffer: Buffer | ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  // exceljs declara su propio `Buffer` (extends ArrayBuffer), distinto al de
  // Node; acepta ambos en runtime.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  return workbook
}

/**
 * Filas crudas, la primera es la cabecera.
 *
 * Se devuelven arrays y no objetos por encabezado a proposito: las columnas se
 * localizan por su nombre en resurtidoCalc, y asi una cabecera repetida no
 * colapsa dos columnas en una.
 */
export function worksheetRows(worksheet: ExcelJS.Worksheet): ExcelRow[] {
  const rows: ExcelRow[] = []
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[]
    rows.push(values.slice(1).map((_, index) => getCellValue(row.getCell(index + 1))))
  })
  return rows
}
