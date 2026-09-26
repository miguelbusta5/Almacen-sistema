// Refresco automatico de datos: que lo que hace otra persona aparezca sin recargar.
//
// Cada pantalla le pasa su funcion de carga y esto la vuelve a correr:
// - cada `intervalMs` (60 s por defecto) mientras la pestaña esta visible y
//   alguien la esta usando (ver INACTIVO_MS);
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

// ── Pantallas desatendidas ──
// Un PC del CEDI puede quedar con un modulo abierto toda la noche. "Visible" no
// basta: sin nadie delante no se consulta nada. Tras INACTIVO_MS sin teclado,
// mouse ni toque el refresco se detiene, y al volver la actividad refresca ya.
// (El 17-09 Vercel pauso el proyecto por uso: cada pestaña abierta consultaba
// cada 20 s aunque no hubiera nadie.)
export const INACTIVO_MS = 5 * 60_000
let ultimaActividad = Date.now()
let escuchandoActividad = false

function escucharActividad() {
  if (escuchandoActividad || typeof window === 'undefined') return
  escuchandoActividad = true
  const marcar = () => {
    const estabaInactivo = Date.now() - ultimaActividad > INACTIVO_MS
    ultimaActividad = Date.now()
    // Vuelve alguien a una pantalla que llevaba rato quieta: datos al dia ya.
    if (estabaInactivo) avisarDatosCambiaron()
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'focus']) {
    window.addEventListener(ev, marcar, { passive: true })
  }
  // Volver a la pestaña o desbloquear el celular tambien es alguien delante.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') marcar() })
}

/** true si alguien uso la pantalla en los ultimos INACTIVO_MS. */
export function hayActividadReciente(): boolean {
  return Date.now() - ultimaActividad <= INACTIVO_MS
}

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
  // 60 s: con 20 s cada pestaña abierta multiplicaba las consultas a Vercel.
  const intervalMs = opts.intervalMs ?? 60_000
  const pause = opts.pause ?? false
  const refreshing = ref(false)
  const lastUpdatedAt = ref<Date | null>(null)
  // La misma hora para la barra superior ("Actualizado hace 20 s").
  const ultimaActualizacion = useUltimaActualizacion()
  let ultimo = Date.now()

  const refreshNow = async (forzar = false) => {
    if (!enabled || pause || document.visibilityState === 'hidden') return
    // Nadie delante de la pantalla: no se consulta (ver INACTIVO_MS). El aviso
    // de "algo cambio" (forzar) si pasa, porque llega por actividad real.
    if (!forzar && !hayActividadReciente()) return
    if (refreshing.value) return
    if (!forzar && Date.now() - ultimo < ESPERA_MINIMA_MS) return
    if (hayEdicionEnCurso()) return
    refreshing.value = true
    silenciosos++
    try {
      await opts.onRefresh()
      lastUpdatedAt.value = new Date()
      ultimaActualizacion.value = Date.now()
    } catch {
      // Un refresco automatico que falla no molesta: el siguiente lo reintenta.
    } finally {
      silenciosos--
      refreshing.value = false
      ultimo = Date.now()
    }
  }

  onMounted(() => {
    escucharActividad()
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

/** Cuando se trajeron datos por ultima vez (ms), compartido con la barra superior. */
export function useUltimaActualizacion() {
  return useState<number | null>('ultimaActualizacion', () => null)
}

/** "hace 20 s", "hace 3 min", "hace 1 h". */
export function haceCuanto(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `hace ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  return `hace ${Math.floor(m / 60)} h`
}

export function formatLastUpdated(date: Date | null) {
  if (!date) return 'Esperando actualización'
  return `Actualizado ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}
