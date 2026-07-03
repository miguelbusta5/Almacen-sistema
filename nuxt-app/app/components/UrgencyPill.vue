<script setup lang="ts">
import { computed } from 'vue'
import { Flag } from '@lucide/vue'
import { alertaTier, ALERTA_TIER_LABEL, TIER_COLOR, TIER_TINT, diasEnBodega, urgencia, type Guardado } from '~/utils/guardado'

const props = defineProps<{ g: Guardado; compact?: boolean }>()

const tier = computed(() => alertaTier(props.g))
const hot = computed(() => tier.value === 'critico' || tier.value === 'emergencia')
const dias = computed(() => diasEnBodega(props.g))
const u = computed(() => urgencia(props.g))
const despachado = computed(() => props.g.estado === 'DESPACHADO')

const flag = computed(() => {
  if (!u.value) return null
  if (u.value.tipo === 'vencida') return { txt: `Entrega vencida hace ${u.value.dias}d`, tone: 'var(--u-critico)' }
  if (u.value.tipo === 'proxima') return { txt: `Entrega en ${u.value.dias}d`, tone: 'var(--u-aviso)' }
  return null
})
</script>

<template>
  <div class="pill" :class="{ despachado, hot }" :style="{ '--c': despachado ? 'var(--muted)' : TIER_COLOR[tier], '--t': despachado ? 'var(--surface-3)' : TIER_TINT[tier] }">
    <span class="dot" />
    <div class="body">
      <span class="label">{{ despachado ? 'Despachado' : ALERTA_TIER_LABEL[tier] }}</span>
      <span v-if="!despachado" class="days mono">{{ dias }}d en bodega</span>
    </div>
    <span v-if="flag" class="flag" :style="{ color: flag.tone }" :title="flag.txt">
      <Flag :size="12" />
    </span>
  </div>
</template>

<style scoped>
.pill {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 5px 11px 5px 8px;
  border-radius: var(--r-pill);
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 4%, var(--t)), var(--t));
  border: 1px solid color-mix(in srgb, var(--c) 26%, transparent);
  min-width: 0;
}
.dot {
  position: relative;
  width: 9px; height: 9px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 55%, white), var(--c));
  flex-shrink: 0;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 16%, transparent);
}
.hot .dot::after {
  content: ''; position: absolute; inset: -3px; border-radius: 50%;
  border: 1px solid var(--c); opacity: .6;
  animation: pillPing 1.6s cubic-bezier(.16,1,.3,1) infinite;
}
@keyframes pillPing { 0% { transform: scale(.8); opacity: .6; } 100% { transform: scale(1.9); opacity: 0; } }
.despachado .dot { box-shadow: none; background: var(--c); }
.body { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.label { font-size: 12px; font-weight: 700; color: color-mix(in srgb, var(--c) 72%, var(--ink)); white-space: nowrap; }
.days { font-size: 10.5px; color: var(--muted); }
.flag { display: inline-flex; margin-left: 2px; flex-shrink: 0; }
</style>
