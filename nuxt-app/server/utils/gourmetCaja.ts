// Validación de códigos de caja escaneados — Cargue Gourmet. Portado 1:1
// desde src/lib/gourmetCajaEscaneo.ts (compartida allá entre cliente y
// servidor; aquí es solo la copia server-side, fuente real de validación).

// Solo dígitos (sin espacios ni letras).
const RE_SOLO_NUMEROS = /^\d+$/
// Prefijos que identifican una orden (no una caja) — se rechazan con aviso.
const PREFIJOS_ORDEN = ['TSDM', 'OVDM']

export function validarCodigoCaja(codigo: string): { ok: true } | { ok: false; error: string } {
  const c = codigo.trim()
  if (c.length === 0) {
    return { ok: false, error: 'El código de caja no puede estar vacío.' }
  }
  const upper = c.toUpperCase()
  for (const p of PREFIJOS_ORDEN) {
    if (upper.startsWith(p)) {
      return { ok: false, error: `"${c}" parece un código de orden (${p}…), no de caja. Escanea solo el código de la caja física.` }
    }
  }
  if (!RE_SOLO_NUMEROS.test(c)) {
    return { ok: false, error: `"${c}" no es un código de caja válido — solo se permiten dígitos.` }
  }
  return { ok: true }
}
