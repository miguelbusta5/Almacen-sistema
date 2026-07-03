<script setup lang="ts">
import { computed } from 'vue'
import { Boxes, Clock, Truck, CheckCircle2, TriangleAlert } from '@lucide/vue'
import type { Despacho } from '~/utils/despacho'

const props = defineProps<{ items: Despacho[] }>()
const emit = defineEmits<{ (e: 'filter', key: string): void }>()

const k = computed(() => {
  const pendRecogida = props.items.filter(d => d.estado === 'CREADO_TIENDA').length
  const enTransito = props.items.filter(d => d.estado === 'RECOGIDO_TIENDA' || d.estado === 'ENTREGADO_CEDI').length
  const completados = props.items.filter(d => d.estado === 'ENVIADO_CLIENTE').length
  const atencion = props.items.filter(d => d.estado === 'CON_NOVEDAD' || d.estado === 'RECHAZADO').length
  return { total: props.items.length, pendRecogida, enTransito, completados, atencion }
})

const cards = computed(() => [
  { key: 'total', label: 'Total facturas', value: k.value.total, tone: 'var(--ink)', icon: Boxes, filter: '' },
  { key: 'pend', label: 'Pendientes recogida', value: k.value.pendRecogida, tone: 'var(--u-critico)', icon: Clock, filter: 'CREADO_TIENDA' },
  { key: 'transito', label: 'En tránsito CEDI', value: k.value.enTransito, tone: 'var(--u-aviso)', icon: Truck, filter: '' },
  { key: 'completados', label: 'Enviadas al cliente', value: k.value.completados, tone: 'var(--u-ok)', icon: CheckCircle2, filter: 'ENVIADO_CLIENTE' },
  { key: 'atencion', label: 'Requieren atención', value: k.value.atencion, tone: k.value.atencion ? 'var(--u-critico)' : 'var(--u-ok)', icon: TriangleAlert, filter: 'CON_NOVEDAD' },
])
</script>

<template>
  <div class="rail">
    <button v-for="c in cards" :key="c.key" class="kpi" :style="{ '--c': c.tone }" @click="emit('filter', c.filter)">
      <span class="kpi-bar" />
      <div class="kpi-top">
        <span class="kpi-ic"><component :is="c.icon" :size="16" /></span>
      </div>
      <span class="kpi-value tnum"><CountUp :value="c.value" /></span>
      <span class="kpi-label">{{ c.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.rail { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.kpi {
  position: relative; text-align: left; cursor: pointer;
  background: radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--c) 6%, transparent), transparent 60%), var(--surface);
  border: 1px solid var(--border); border-radius: var(--r-md); padding: 15px 16px 16px;
  box-shadow: var(--shadow-xs); overflow: hidden;
  transition: transform .16s cubic-bezier(.16,1,.3,1), box-shadow .16s, border-color .16s;
  animation: auroraFade .34s cubic-bezier(.16,1,.3,1) both;
}
.kpi:nth-child(2){animation-delay:45ms}.kpi:nth-child(3){animation-delay:90ms}
.kpi:nth-child(4){animation-delay:135ms}.kpi:nth-child(5){animation-delay:180ms}
.kpi:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: color-mix(in srgb, var(--c) 45%, var(--border)); }
.kpi:focus-visible { outline: none; box-shadow: var(--ring); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.kpi-ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); transition: transform .2s cubic-bezier(.34,1.56,.64,1); }
.kpi:hover .kpi-ic { transform: scale(1.1) rotate(-4deg); }
.kpi-value { display: block; font-family: var(--display); font-size: 28px; font-weight: 800; letter-spacing: -.035em; color: var(--c); line-height: 1.05; }
.kpi-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-top: 3px; }
.kpi-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 55%, transparent)); }
@media (max-width: 900px) { .rail { grid-template-columns: repeat(2, 1fr); } }
</style>
