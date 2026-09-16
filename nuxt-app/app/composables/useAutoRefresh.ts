// Refresco automatico de datos: que lo que hace otra persona aparezca sin recargar.
//
// Cada pantalla le pasa su funcion de carga y esto la vuelve a correr:
// - cada `intervalMs` (20 s por defecto) mientras la pestaña esta visible;
// - al volver a la pestaña o desbloquear el celular;
// - en cuanto llega un aviso nuevo a la campana (te asignaron algo).
//
// Nunca refresca con trabajo a medias: si hay un campo con texto enfocado o un
// modal abierto, espera al siguiente turno. Y refresca "en silencio": las
// pantallas no muestran el esqueleto de carga ni avisos de error de red por un
// refresco que la persona no pidio (ver enRefrescoSilencioso).

/** Evento global: "algo cambio, vuelve a traer tus datos". */
export const EVENTO_DATOS_CAMBIARON = 'app:datos-cambiaron'

export function avisarDatosCambiaron() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_DATOS_CAMBIARON))
}

let silenciosos = 0

/**
 * true mientras corre un refresco automatico. Las funciones de carga lo miran
 * para no poner el esqueleto (`if (!enRefrescoSilencioso()) loading.value = true`)
 * y el toast para no mostrar errores de red que nadie pidio.
 */
export function enRefrescoSilencioso(): boolean {
  return silenciosos > 0
}

/**
 * Hay trabajo a medias en pantalla: un campo con texto enfocado o un modal
 * abierto. Un campo de escaneo VACIO no cuenta: esos viven enfocados todo el
 * turno y bloquearian el refresco para siempre.
 */
export function hayEdicionEnCurso(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement as HTMLElement | null
  if (el) {
    if (el.isContentEditable) return true
    if (el instanceof HTMLTextAreaElement && el.value.trim() !== '') return true
    if (el instanceof HTMLInputElement) {
      const tipo = el.type
      const esTexto = !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(tipo)
      if (esTexto && el.value.trim() !== '') return true
    }
  }
  return document.querySelector('[role="dialog"], .overlay, .modal-backdrop') != null
}

/** Mínimo entre dos refrescos seguidos (foco + visibilidad llegan juntos). */
const ESPERA_MINIMA_MS = 5_000

export function useAutoRefresh(opts: {
  enabled?: boolean
  intervalMs?: number
  pause?: boolean
  onRefresh: () => void | Promise<unknown>
}) {
  const enabled = opts.enabled ?? true
  const intervalMs = opts.intervalMs ?? 20_000
  const pause = opts.pause ?? false
  const refreshing = ref(false)
  const lastUpdatedAt = ref<Date | null>(null)
  let ultimo = Date.now()

  const refreshNow = async (forzar = false) => {
    if (!enabled || pause || document.visibilityState === 'hidden') return
    if (refreshing.value) return
    if (!forzar && Date.now() - ultimo < ESPERA_MINIMA_MS) return
    if (hayEdicionEnCurso()) return
    refreshing.value = true
    silenciosos++
    try {
      await opts.onRefresh()
      lastUpdatedAt.value = new Date()
    } catch {
      // Un refresco automatico que falla no molesta: el siguiente lo reintenta.
    } finally {
      silenciosos--
      refreshing.value = false
      ultimo = Date.now()
    }
  }

  onMounted(() => {
    if (!enabled || pause) return
    const id = window.setInterval(() => { void refreshNow() }, intervalMs)
    const alVolver = () => { if (document.visibilityState === 'visible') void refreshNow() }
    const alFoco = () => { void refreshNow() }
    const alCambio = () => { void refreshNow(true) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alFoco)
    window.addEventListener(EVENTO_DATOS_CAMBIARON, alCambio)
    onUnmounted(() => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alFoco)
      window.removeEventListener(EVENTO_DATOS_CAMBIARON, alCambio)
    })
  })

  return { refreshing, lastUpdatedAt, refreshNow }
}

export function formatLastUpdated(date: Date | null) {
  if (!date) return 'Esperando actualización'
  return `Actualizado ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}
