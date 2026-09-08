/**
 * Mensaje legible de un error de $fetch contra la API de Nitro.
 *
 * Nitro serializa los errores de `createError()` como:
 *   { error: true, url, statusCode, statusMessage, message, stack: [...] }
 *
 * El `error: true` es un FLAG, no un mensaje. Cada componente tenía su propia
 * copia de este helper que lo leía primero (`e?.data?.error || ...`), así que
 * en cuanto un endpoint fallaba el operario veía un cuadro rojo con la palabra
 * "true" en vez del motivo. Estaba duplicado en 24 archivos, o sea en todos los
 * módulos: por eso vive aquí y Nuxt lo auto-importa.
 *
 * Solo se aceptan cadenas no vacías: cualquier otra cosa (booleanos, objetos)
 * cae al texto de respaldo, que al menos dice algo útil.
 */
function textoUtil(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function apiErr(e: any, fallback: string): string {
  return (
    textoUtil(e?.data?.statusMessage) ??
    textoUtil(e?.data?.message) ??
    // `data.error` puede ser un string en endpoints de la app Next (que
    // responden { error: "..." }); en Nitro es el booleano y se descarta solo.
    textoUtil(e?.data?.error) ??
    textoUtil(e?.statusMessage) ??
    textoUtil(e?.message) ??
    fallback
  )
}
