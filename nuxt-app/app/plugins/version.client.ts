import { hayEdicionEnCurso } from '~/composables/useAutoRefresh'
import { useVersionNueva } from '~/composables/useVersionNueva'

/**
 * Versiones nuevas sin pedirle a nadie que recargue.
 *
 * La app es una SPA: quien la tenia abierta seguia con la version vieja hasta
 * recargar, y al cambiar de modulo podia quedar en blanco porque los archivos
 * viejos ya no existen en el servidor.
 *
 * - Cada minuto (y al volver a la pestaña) pregunta /api/version.
 * - Si hay una nueva y la persona no esta escribiendo ni con un modal abierto,
 *   recarga sola. Si esta a mitad de algo, `hayVersionNueva` hace que el layout
 *   muestre "Hay una versión nueva · Actualizar" y se recarga en el siguiente
 *   cambio de modulo (que ya es una recarga natural).
 * - Si un archivo de la version vieja no carga, recarga una vez.
 */
const REVISAR_CADA_MS = 60_000
const CLAVE_RECARGA = 'app-recarga-por-version'

export default defineNuxtPlugin((nuxtApp) => {
  const hayVersionNueva = useVersionNueva()
  const actual = __BUILD_ID__

  function recargar() {
    // Evita un bucle si el servidor aun sirve la version vieja un instante.
    try {
      const antes = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0)
      if (Date.now() - antes < 30_000) return
      sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()))
    } catch { /* sin storage: se recarga igual */ }
    window.location.reload()
  }

  async function revisar() {
    if (document.visibilityState !== 'visible') return
    try {
      const res = await $fetch<{ buildId: string }>('/api/version', { retry: 0 })
      if (!res.buildId || res.buildId === actual) return
      hayVersionNueva.value = true
      if (!hayEdicionEnCurso()) recargar()
    } catch { /* sin red: se vuelve a preguntar en el proximo turno */ }
  }

  // Con version nueva pendiente, cambiar de modulo es el momento seguro: se
  // hace como navegacion completa y entra ya con la version nueva.
  const router = useRouter()
  router.beforeEach((to, from) => {
    if (hayVersionNueva.value && to.fullPath !== from.fullPath) {
      window.location.href = router.resolve(to).href
      return false
    }
  })

  // Un archivo de la version vieja que ya no existe: recargar en vez de quedar en blanco.
  nuxtApp.hook('app:chunkError', () => { recargar() })
  window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); recargar() })

  window.setInterval(() => { void revisar() }, REVISAR_CADA_MS)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void revisar() })
})
