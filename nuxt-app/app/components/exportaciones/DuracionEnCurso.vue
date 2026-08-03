<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  horaInicio: string
  objetivoMin: number
  // Date.now() en ms, ticado por el padre (Tabla.vue) — un solo reloj
  // compartido para toda la tabla, no un setInterval por fila.
  ahora: number
}>()

// Blindado contra desfases de reloj (horaInicio "en el futuro" nunca da tiempo negativo).
const elapsedMs = computed(() => Math.max(0, props.ahora - new Date(props.horaInicio).getTime()))
const elapsedMin = computed(() => elapsedMs.value / 60000)

const mmss = computed(() => {
  const totalSec = Math.floor(elapsedMs.value / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
})

// objetivoMin llega siempre > 0 por la cadena de fallback de objetivoPlu(), pero
// se blinda igual: sin esto, un dato inesperado en 0 rompería el ratio (división por cero).
const ratio = computed(() => (props.objetivoMin > 0 ? elapsedMin.value / props.objetivoMin : 0))
const widthPct = computed(() => Math.min(100, Math.max(0, ratio.value * 100)))
const tone = computed(() => {
  if (ratio.value <= 1) return 'var(--u-ok)'
  if (ratio.value <= 1.5) return 'var(--u-aviso)'
  return 'var(--u-critico)'
})
</script>

<template>
  <div class="dur-live" :style="{ '--c': tone }" :title="`Objetivo: ${objetivoMin} min`">
    <span class="dur-time mono tnum">{{ mmss }}</span>
    <span class="dur-track">
      <span class="dur-fill" :style="{ width: `${widthPct}%` }" />
    </span>
  </div>
</template>

<style scoped>
.dur-live { display: flex; flex-direction: column; gap: 3px; min-width: 52px; }
.dur-time { font-size: 12.5px; font-weight: 700; color: var(--c); }
.dur-track { display: block; width: 100%; height: 4px; border-radius: var(--r-pill); background: var(--surface-3); overflow: hidden; }
.dur-fill {
  display: block; height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) 60%, white), var(--c));
  transition: width .6s cubic-bezier(.22,1,.36,1), background-color .3s ease;
}
</style>
