<script setup lang="ts">
import { computed } from 'vue'
import { Boxes, PackageX, Truck, CheckCircle2, TriangleAlert } from '@lucide/vue'
import type { PedidoGourmet } from '~/utils/gourmet'

const props = defineProps<{ items: PedidoGourmet[] }>()
const emit = defineEmits<{ (e: 'filter', key: string): void }>()

const k = computed(() => {
  const sinUbicacion = props.items.filter((p) => p.estado === 'BORRADOR').length
  const enCargue = props.items.filter((p) => p.estado === 'EN_CARGUE').length
  const completados = props.items.filter((p) => p.estado === 'CARGUE_COMPLETO' || p.estado === 'CARGUE_COMPLETO_MANUAL').length
  const novedad = props.items.filter((p) => p.estado === 'CON_NOVEDAD').length
  return { total: props.items.length, sinUbicacion, enCargue, completados, novedad }
})

const cards = computed(() => [
  { key: 'total', label: 'Total pedidos', value: k.value.total, tone: 'var(--ink)', icon: Boxes, filter: '', hint: 'registrados' },
  { key: 'sinUbicacion', label: 'Sin ubicación', value: k.value.sinUbicacion, tone: 'var(--u-critico)', icon: PackageX, filter: 'BORRADOR', hint: 'por ubicar' },
  { key: 'enCargue', label: 'En cargue', value: k.value.enCargue, tone: 'var(--u-aviso)', icon: Truck, filter: 'EN_CARGUE', hint: 'en camión' },
  { key: 'completados', label: 'Completados', value: k.value.completados, tone: 'var(--u-ok)', icon: CheckCircle2, filter: 'CARGUE_COMPLETO', hint: 'cargue completo' },
  { key: 'novedad', label: 'Con novedad', value: k.value.novedad, tone: k.value.novedad ? 'var(--u-critico)' : 'var(--u-ok)', icon: TriangleAlert, filter: 'CON_NOVEDAD', hint: 'requieren atención' },
])
</script>

<template>
  <div class="rail">
    <button v-for="c in cards" :key="c.key" class="kpi" :style="{ '--c': c.tone }" @click="emit('filter', c.filter)">
      <span class="kpi-bar" />
      <div class="kpi-top">
        <span class="kpi-ic"><component :is="c.icon" :size="15" /></span>
        <span class="kpi-label">{{ c.label }}</span>
      </div>
      <div class="kpi-value">{{ c.value }}</div>
      <div class="kpi-hint">{{ c.hint }}</div>
    </button>
  </div>
</template>

<style scoped>
.rail { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.kpi {
  position: relative; text-align: left; padding: 14px 16px; border-radius: var(--r-md);
  background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-xs);
  cursor: pointer; transition: transform .14s, box-shadow .14s; overflow: hidden;
}
.kpi:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
.kpi-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); }
.kpi-top { display: flex; align-items: center; gap: 7px; color: var(--c); margin-bottom: 8px; }
.kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.kpi-value { font-size: 26px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
.kpi-hint { font-size: 11.5px; color: var(--faint); margin-top: 2px; }
@media (max-width: 900px) { .rail { grid-template-columns: repeat(2, 1fr); } }
</style>
