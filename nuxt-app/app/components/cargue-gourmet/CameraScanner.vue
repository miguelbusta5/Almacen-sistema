<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Camera, X } from '@lucide/vue'
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

onMounted(async () => {
  try {
    // Restricción de formatos + intervalo de decodificación + resolución
    // acotada: con los defaults, zxing intentaba TODOS los formatos de
    // código sobre frames a resolución máxima de la cámara — la razón de
    // que la detección se sintiera lenta. Los códigos reales de las cajas
    // son de barras 1D (CODE_128/CODE_39, con EAN por si acaso) o QR.
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.QR_CODE,
    ])
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100,
      delayBetweenScanSuccess: 250,
    })
    controls = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
      videoEl.value!,
      (result) => {
        if (result) onDetectado(result.getText())
      },
    )
  } catch {
    error.value = 'No se pudo acceder a la cámara. Verifica el permiso o usa el campo de texto.'
  }
})

onUnmounted(() => {
  controls?.stop()
  if (flashTimeout) clearTimeout(flashTimeout)
})
</script>

<template>
  <Teleport to="body">
    <div class="cam-overlay" :class="{ 'flash-ok': flash === 'ok', 'flash-error': flash === 'error' }">
      <div class="cam-head">
        <span class="cam-title"><Camera :size="16" /> Escaneo con cámara</span>
        <button class="cam-close" aria-label="Cerrar" @click="emit('close')"><X :size="20" /></button>
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
.cam-close { background: rgba(255, 255, 255, .12); border: none; border-radius: var(--r-xs); padding: 8px; cursor: pointer; color: #fff; display: flex; }
.cam-close:hover { background: rgba(255, 255, 255, .22); }
.cam-body { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.cam-video { width: 100%; height: 100%; object-fit: cover; }
.cam-guide { position: absolute; inset: 15% 10%; border: 2px solid rgba(255, 255, 255, .7); border-radius: var(--r-md); pointer-events: none; }
.cam-hint, .cam-error { position: absolute; bottom: 18px; left: 16px; right: 16px; text-align: center; font-size: 13px; padding: 8px 12px; border-radius: var(--r-sm); background: rgba(0, 0, 0, .55); color: #fff; }
.cam-error { color: var(--u-critico); }
.cam-ultimo { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; background: rgba(0, 0, 0, .5); color: #fff; font-size: 13px; }
.cam-ultimo .ok { color: var(--u-ok); font-weight: 700; }
.cam-ultimo .bad { color: var(--u-critico); font-weight: 700; }
</style>
