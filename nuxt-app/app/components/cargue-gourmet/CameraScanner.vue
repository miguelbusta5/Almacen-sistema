<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Camera, X, Flashlight } from '@lucide/vue'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

// Reutiliza el mismo resultado del último escaneo que ya calcula el padre
// (VALIDO/DUPLICADO/CAJA_AJENA/...) para pintar el feedback — no duplica
// lógica de clasificación, solo la muestra.
const props = defineProps<{ ultimoResultado?: { codigo: string; resultado: string } | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'detectado', codigo: string): void }>()

const videoEl = ref<HTMLVideoElement | null>(null)
const error = ref('')
const flash = ref<'ok' | 'error' | null>(null)

let controls: IScannerControls | null = null
let stream: MediaStream | null = null
let detectorTimer: ReturnType<typeof setInterval> | null = null
let flashTimeout: ReturnType<typeof setTimeout> | null = null
// Cooldown por código repetido — evita contar la misma caja varias veces
// mientras sigue en cuadro, sin frenar el escaneo de una caja distinta.
const COOLDOWN_MS = 1500
let ultimoCodigo = ''
let ultimoTs = 0

// Los sonidos y la vibración viven en el padre (utils/escaneoFeedback.ts,
// disparados al encolar y al confirmar cada veredicto) para que suenen
// igual con cámara, pistola o teclado — aquí solo queda el feedback
// visual propio del modo cámara (flash de borde sobre el video).
function onDetectado(codigo: string) {
  const now = Date.now()
  if (codigo === ultimoCodigo && now - ultimoTs < COOLDOWN_MS) return
  ultimoCodigo = codigo
  ultimoTs = now
  emit('detectado', codigo)
}

function mostrarFlash(ok: boolean) {
  flash.value = ok ? 'ok' : 'error'
  if (flashTimeout) clearTimeout(flashTimeout)
  flashTimeout = setTimeout(() => { flash.value = null }, 400)
}

// El padre recalcula `ultimoResultado` tras cada envío — cuando cambia,
// reflejamos el resultado real (válido o no) en el flash de la cámara.
watch(() => props.ultimoResultado, (r) => {
  if (r) mostrarFlash(r.resultado === 'VALIDO')
})

// 1080p: 720p dejaba muy pocos píxeles por barra en códigos densos a
// distancia de brazo y fallaba la lectura. focusMode continuo (ignorado
// donde no exista) reenfoca solo al acercar el código — el desenfoque es
// una causa típica de "no lee".
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  // @ts-expect-error focusMode aún no está en los tipos de TS pero los
  // navegadores Android lo aceptan dentro de `advanced`.
  advanced: [{ focusMode: 'continuous' }],
}

// ── Linterna (torch) — solo se muestra si el track la soporta ────────────
const torchDisponible = ref(false)
const torchOn = ref(false)
let videoTrack: MediaStreamTrack | null = null
function registrarTrack(track: MediaStreamTrack | undefined) {
  videoTrack = track ?? null
  try {
    torchDisponible.value = !!(videoTrack?.getCapabilities() as { torch?: boolean } | undefined)?.torch
  } catch { torchDisponible.value = false }
}
async function toggleTorch() {
  if (!videoTrack) return
  try {
    await videoTrack.applyConstraints({ advanced: [{ torch: !torchOn.value } as MediaTrackConstraintSet] })
    torchOn.value = !torchOn.value
  } catch { /* algunos dispositivos anuncian torch pero fallan — se ignora */ }
}

// ── Motor de detección ────────────────────────────────────────────────────
// Vía preferida: BarcodeDetector nativo (Android Chrome/WebView) — acelerado
// por hardware, lee en CUALQUIER orientación del celular/código y tolera
// blur/poca luz mucho mejor que zxing. Respaldo: zxing con TRY_HARDER (que
// reintenta el frame rotado 90° — sin ese hint un código perpendicular a
// las líneas de escaneo nunca leía) para iOS y navegadores sin la API.
type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }
const FORMATOS_NATIVOS = ['code_128', 'code_39', 'ean_13', 'qr_code']

async function crearDetectorNativo(): Promise<BarcodeDetectorLike | null> {
  try {
    const BD = (window as unknown as { BarcodeDetector?: { getSupportedFormats(): Promise<string[]>; new (opts: { formats: string[] }): BarcodeDetectorLike } }).BarcodeDetector
    if (!BD) return null
    const soportados = await BD.getSupportedFormats()
    const formatos = FORMATOS_NATIVOS.filter((f) => soportados.includes(f))
    // Sin los formatos 1D reales de las cajas la vía nativa no sirve.
    if (!formatos.includes('code_128')) return null
    return new BD({ formats: formatos })
  } catch {
    return null
  }
}

async function iniciarNativo(detector: BarcodeDetectorLike) {
  stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS })
  const video = videoEl.value!
  video.srcObject = stream
  await video.play().catch(() => {})
  registrarTrack(stream.getVideoTracks()[0])
  let detectando = false
  detectorTimer = setInterval(async () => {
    if (detectando || !videoEl.value || videoEl.value.readyState < 2) return
    detectando = true
    try {
      const codigos = await detector.detect(videoEl.value)
      for (const c of codigos) {
        if (c.rawValue) { onDetectado(c.rawValue); break }
      }
    } catch { /* frame no procesable — se reintenta en el próximo tick */ }
    finally { detectando = false }
  }, 120)
}

async function iniciarZxing() {
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.QR_CODE,
  ])
  // TRY_HARDER: reintenta cada frame rotado 90° (OneDReader) — necesario
  // para leer códigos de barras con el celular en horizontal. Cuesta más
  // CPU por intento, por eso el intervalo sube a 150ms.
  hints.set(DecodeHintType.TRY_HARDER, true)
  const reader = new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 150,
    delayBetweenScanSuccess: 250,
  })
  controls = await reader.decodeFromConstraints(
    { video: VIDEO_CONSTRAINTS },
    videoEl.value!,
    (result) => {
      if (result) onDetectado(result.getText())
    },
  )
  registrarTrack((videoEl.value?.srcObject as MediaStream | null)?.getVideoTracks()[0])
}

onMounted(async () => {
  try {
    const detector = await crearDetectorNativo()
    if (detector) await iniciarNativo(detector)
    else await iniciarZxing()
  } catch {
    error.value = 'No se pudo acceder a la cámara. Verifica el permiso o usa el campo de texto.'
  }
})

onUnmounted(() => {
  if (detectorTimer) clearInterval(detectorTimer)
  controls?.stop()
  stream?.getTracks().forEach((t) => t.stop())
  if (flashTimeout) clearTimeout(flashTimeout)
})
</script>

<template>
  <Teleport to="body">
    <div class="cam-overlay" :class="{ 'flash-ok': flash === 'ok', 'flash-error': flash === 'error' }">
      <div class="cam-head">
        <span class="cam-title"><Camera :size="16" /> Escaneo con cámara</span>
        <div class="cam-actions">
          <button v-if="torchDisponible" class="cam-btn" :class="{ on: torchOn }" aria-label="Linterna" @click="toggleTorch"><Flashlight :size="18" /></button>
          <button class="cam-btn" aria-label="Cerrar" @click="emit('close')"><X :size="20" /></button>
        </div>
      </div>

      <div class="cam-body">
        <video ref="videoEl" class="cam-video" muted playsinline autoplay />
        <div class="cam-guide" />
        <p v-if="error" class="cam-error">{{ error }}</p>
        <p v-else class="cam-hint">Apunta la cámara al código de la caja — se registra automáticamente.</p>
      </div>

      <div v-if="ultimoResultado" class="cam-ultimo">
        <span class="mono">{{ ultimoResultado.codigo }}</span>
        <span :class="ultimoResultado.resultado === 'VALIDO' ? 'ok' : 'bad'">{{ ultimoResultado.resultado }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cam-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: #000;
  display: flex; flex-direction: column;
  transition: box-shadow .15s ease;
}
.cam-overlay.flash-ok { box-shadow: inset 0 0 0 8px var(--u-ok); }
.cam-overlay.flash-error { box-shadow: inset 0 0 0 8px var(--u-critico); }
.cam-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; color: #fff; background: rgba(0, 0, 0, .5); }
.cam-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
.cam-actions { display: flex; align-items: center; gap: 8px; }
.cam-btn { background: rgba(255, 255, 255, .12); border: none; border-radius: var(--r-xs); padding: 8px; cursor: pointer; color: #fff; display: flex; }
.cam-btn:hover { background: rgba(255, 255, 255, .22); }
.cam-btn.on { background: var(--u-aviso); color: #000; }
.cam-body { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.cam-video { width: 100%; height: 100%; object-fit: cover; }
.cam-guide { position: absolute; inset: 15% 10%; border: 2px solid rgba(255, 255, 255, .7); border-radius: var(--r-md); pointer-events: none; }
.cam-hint, .cam-error { position: absolute; bottom: 18px; left: 16px; right: 16px; text-align: center; font-size: 13px; padding: 8px 12px; border-radius: var(--r-sm); background: rgba(0, 0, 0, .55); color: #fff; }
.cam-error { color: var(--u-critico); }
.cam-ultimo { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; background: rgba(0, 0, 0, .5); color: #fff; font-size: 13px; }
.cam-ultimo .ok { color: var(--u-ok); font-weight: 700; }
.cam-ultimo .bad { color: var(--u-critico); font-weight: 700; }
</style>
