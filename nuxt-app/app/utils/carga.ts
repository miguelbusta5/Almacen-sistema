// Peso y volumen de lo que se mueve, para las pantallas.
//
// El calculo vive en el servidor (server/utils/carga.ts, copia de
// src/lib/carga.ts): aqui solo se muestran los numeros que llegan. Un PLU sin
// medir llega en null y se pinta "—", nunca un cero.

export interface Carga { kg: number | null; m3: number | null }
export interface CargaTotal { kg: number; m3: number; sinMedida: number }

/** "45 kg" o "—" si el PLU no esta medido. */
export function fmtKg(kg: number | null | undefined): string {
  if (kg == null) return '—'
  return `${kg.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`
}

/** "1,2 m³" o "—" si el PLU no esta medido. */
export function fmtM3(m3: number | null | undefined): string {
  if (m3 == null) return '—'
  return `${m3.toLocaleString('es-CO', { maximumFractionDigits: 2 })} m³`
}

/** "45 kg · 1,2 m³", y "—" cuando no hay ninguna de las dos. */
export function fmtCarga(c: Carga | null | undefined): string {
  if (!c || (c.kg == null && c.m3 == null)) return '—'
  return `${fmtKg(c.kg)} · ${fmtM3(c.m3)}`
}

/** Aviso de lo que no se pudo contar: "2 sin medida". */
export function avisoSinMedida(sinMedida: number | null | undefined): string {
  if (!sinMedida) return ''
  return `${sinMedida} sin medida`
}
