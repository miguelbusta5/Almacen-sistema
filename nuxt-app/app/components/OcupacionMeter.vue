<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ ocupadas: number; total: number }>()

const pct = computed(() => props.total > 0 ? Math.min(100, (props.ocupadas / props.total) * 100) : 0)
const nivel = computed(() => {
  if (pct.value >= 90) return 'critico'
  if (pct.value >= 75) return 'alerta'
  return 'ok'
})
</script>

<template>
  <div class="ocup-meter card" :class="nivel">
    <div class="ocup-head">
      <div>
        <div class="ocup-kicker">Ocupación del CEDI</div>
        <div class="ocup-amount mono">{{ pct.toFixed(1) }}%</div>
      </div>
      <div class="ocup-count mono">{{ ocupadas.toLocaleString('es-CO') }} / {{ total.toLocaleString('es-CO') }} posiciones</div>
    </div>
    <div class="ocup-track">
      <span class="ocup-fill" :style="{ '--fill': pct / 100 }" />
    </div>
  </div>
</template>

<style scoped>
.ocup-meter { padding: 15px 18px; border: 1px solid color-mix(in srgb, var(--info) 22%, var(--border)); }
.ocup-meter.alerta { border-color: color-mix(in srgb, var(--u-alerta) 30%, var(--border)); }
.ocup-meter.critico { border-color: color-mix(in srgb, var(--u-critico) 34%, var(--border)); }
.ocup-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 10px; flex-wrap: wrap; }
.ocup-kicker { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--faint); }
.ocup-amount { font-family: var(--display); font-size: 24px; font-weight: 800; letter-spacing: -.03em; color: var(--info); margin-top: 2px; }
.ocup-meter.alerta .ocup-amount { color: var(--u-alerta); }
.ocup-meter.critico .ocup-amount { color: var(--u-critico); }
.ocup-count { font-size: 12px; color: var(--muted); }
.ocup-track { position: relative; height: 10px; border-radius: var(--r-pill); background: var(--surface-3); overflow: hidden; border: 1px solid var(--border); }
.ocup-fill { position: absolute; inset: 0; border-radius: inherit; transform-origin: left; transform: scaleX(var(--fill, 0)); background: linear-gradient(90deg, color-mix(in srgb, var(--info) 70%, white), var(--info)); transition: transform .5s cubic-bezier(.22,1,.36,1); }
.ocup-meter.alerta .ocup-fill { background: linear-gradient(90deg, color-mix(in srgb, var(--u-alerta) 70%, white), var(--u-alerta)); }
.ocup-meter.critico .ocup-fill { background: linear-gradient(90deg, color-mix(in srgb, var(--u-critico) 70%, white), var(--u-critico)); }
</style>
