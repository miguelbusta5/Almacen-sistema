// Feedback sonoro/háptico del escaneo de cajas — compartido por TODOS los
// métodos de captura (cámara, lector de pistola y teclado; antes solo la
// cámara sonaba). Melodías distintas por veredicto para que el operario se
// entere sin mirar la pantalla, incluso con el veredicto llegando 1-2s
// después de la captura (cola de escaneo).

// AudioContext singleton: los navegadores móviles solo permiten audio tras
// un gesto del usuario — reutilizar un contexto creado/reanudado en la
// primera interacción evita que los tonos disparados desde callbacks de
// red lleguen silenciados.
let audioCtx: AudioContext | null = null
function getCtx(): AudioContext | null {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function tono(freq: number, enSeg: number, durSeg: number, vol: number, tipo: OscillatorType = 'sine') {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tipo
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t0 = ctx.currentTime + enSeg
    gain.gain.setValueAtTime(vol, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durSeg)
    osc.start(t0)
    osc.stop(t0 + durSeg)
  } catch { /* sin audio — el feedback visual sigue funcionando */ }
}

export function vibrar(patron: number | number[]) {
  try { navigator.vibrate?.(patron) } catch { /* iOS no soporta — no-op */ }
}

/** Bip corto neutro de "caja capturada" — inmediato al encolar. */
export function sonarCaptura() {
  tono(600, 0, 0.07, 0.12)
  vibrar(30)
}

/**
 * Veredicto del servidor. Melodías inconfundibles entre sí:
 * - VALIDO: doble bip agudo ascendente (corto, alegre).
 * - DUPLICADO: dos tonos medios descendentes (advertencia).
 * - CAJA_AJENA / EXCEDE_CANTIDAD / FORMATO_INVALIDO: zumbido grave triple
 *   largo (~0.8s) en onda cuadrada — la alerta más dura.
 */
export function sonarVeredicto(resultado: string) {
  if (resultado === 'VALIDO') {
    tono(880, 0, 0.09, 0.25)
    tono(1175, 0.11, 0.1, 0.25)
    vibrar(45)
    return
  }
  if (resultado === 'DUPLICADO') {
    tono(520, 0, 0.16, 0.3)
    tono(392, 0.19, 0.24, 0.3)
    vibrar([90, 50, 90])
    return
  }
  // CAJA_AJENA / EXCEDE_CANTIDAD / FORMATO_INVALIDO / error de red
  tono(240, 0, 0.18, 0.32, 'square')
  tono(240, 0.24, 0.18, 0.32, 'square')
  tono(200, 0.48, 0.3, 0.32, 'square')
  vibrar([140, 60, 140, 60, 220])
}
