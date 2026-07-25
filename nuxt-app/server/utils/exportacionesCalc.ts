// Helpers PUROS de Exportaciones. Sin Prisma ni nada de runtime a propósito:
// mapRow.ts los necesita, y mapRow lo importan los handlers de todos los módulos.
// Si estas funciones vivieran junto al delegate de Prisma, cualquier módulo que
// mapea una fila arrastraría el cliente de Prisma en su cadena de imports — el
// tipo de acoplamiento que ya causó BUG-004 (ver docs/cerebro/bugs.md), que solo
// se manifestaba en el bundle de Vercel y no en local.
// Port 1:1 de src/lib/exportaciones.ts.

export function normalizePlu(value: string): string {
  return value.trim().toUpperCase()
}

/**
 * Medianoche UTC del día actual **en Bogotá**. `fecha` es @db.Date, así que este
 * valor tiene que coincidir carácter por carácter con el que escribe la app Next;
 * si no, los registros de un stack no aparecen en el otro.
 * NO reescribir con dayjs ni con `new Date(fecha)` sin la Z.
 */
export function todayBogota(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return new Date(`${parts}T00:00:00.000Z`)
}

export function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

export function calcularDuracionMinutos(
  inicio: Date | string,
  fin: Date | string | null | undefined,
): number | null {
  if (!fin) return null
  const start = inicio instanceof Date ? inicio : new Date(inicio)
  const end = fin instanceof Date ? fin : new Date(fin)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function validarCapturaExportacion(input: {
  numeroCaja?: string
  plu?: string
  unidadEmpaque?: number
}): string | null {
  if (!input.numeroCaja?.trim()) return 'El número de caja es obligatorio'
  if (!input.plu?.trim()) return 'El PLU es obligatorio'
  if (!input.unidadEmpaque || input.unidadEmpaque < 1) return 'La unidad de empaque debe ser mayor a 0'
  return null
}

/** Día 'YYYY-MM-DD' → medianoche UTC, o null si no parsea. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
