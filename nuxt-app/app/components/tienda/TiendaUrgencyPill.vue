<script setup lang="ts">
import { computed } from 'vue'
import { Flag } from '@lucide/vue'
import { TIER_COLOR, TIER_TINT, ALERTA_TIER_LABEL } from '~/utils/guardado'
import { alertaTierDespacho, horasDesde, type Despacho } from '~/utils/despacho'

const props = defineProps<{ d: Despacho }>()

const tier = computed(() => alertaTierDespacho(props.d))
const hot = computed(() => tier.value === 'critico' || tier.value === 'emergencia')
const enviado = computed(() => props.d.estado === 'ENVIADO_CLIENTE')

const sub = computed(() => {
  if (enviado.value) return null
  if (props.d.estado === 'CREADO_TIENDA') return `${horasDesde(props.d.createdAt)}h sin recoger`
  return null
})

const flag = computed(() => {
  if (enviado.value || !props.d.fechaEntregaComprometida) return null
  const dias = Math.ceil((new Date(props.d.fechaEntregaComprometida).getTime() - Date.now()) / 86_400_000)
  if (dias < 0) return { txt: `Entrega vencida hace ${-dias}d`, tone: 'var(--u-critico)' }
  if (dias <= 5) return { txt: `Entrega en ${dias}d`, tone: 'var(--u-aviso)' }
  return null
})
</script>

<template>
  <div class="pill" :class="{ despachado: enviado, hot }" :style="{ '--c': enviado ? 'var(--muted)' : TIER_COLOR[tier], '--t': enviado ? 'var(--surface-3)' : TIER_TINT[tier] }">
    <span class="dot" />
    <div class="body">
      <span class="label">{{ enviado ? 'Enviado' : ALERTA_TIER_LABEL[tier] }}</span>
      <span v-if="sub" class="days mono">{{ sub }}</span>
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
  animation: pillPingTienda 1.6s cubic-bezier(.16,1,.3,1) infinite;
}
@keyframes pillPingTienda { 0% { transform: scale(.8); opacity: .6; } 100% { transform: scale(1.9); opacity: 0; } }
.despachado .dot { box-shadow: none; background: var(--c); }
.body { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.label { font-size: 12px; font-weight: 700; color: color-mix(in srgb, var(--c) 72%, var(--ink)); white-space: nowrap; }
.days { font-size: 10.5px; color: var(--muted); }
.flag { display: inline-flex; margin-left: 2px; flex-shrink: 0; }
</style>
