<script setup lang="ts">
import { computed } from 'vue'
import { Boxes, PackageX, Truck, CheckCircle2, TriangleAlert } from '@lucide/vue'

// Antes se calculaba filtrando el arreglo completo de pedidos cargado en
// el cliente — con la lista paginada de verdad eso solo reflejaría la
// página visible. Los totales ahora vienen de un endpoint de conteos
// aparte (/api/cargue-gourmet/conteos), independiente de la paginación.
const props = defineProps<{ counts: { total: number; sinUbicacion: number; enCargue: number; completados: number; novedad: number } }>()
const emit = defineEmits<{ (e: 'filter', key: string): void }>()

const k = computed(() => props.counts)

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
      <div class="kpi-value tnum"><CountUp :value="c.value" /></div>
      <div class="kpi-hint">{{ c.hint }}</div>
    </button>
  </div>
</template>

<style scoped>
.rail { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.kpi {
  position: relative; text-align: left; padding: 14px 16px; border-radius: var(--r-md);
  background:
    radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--c) 6%, transparent), transparent 60%),
    var(--surface);
  border: 1px solid var(--border); box-shadow: var(--shadow-xs);
  cursor: pointer; overflow: hidden;
  transition: transform .16s cubic-bezier(.16,1,.3,1), box-shadow .16s, border-color .16s;
  animation: auroraFade .34s cubic-bezier(.16,1,.3,1) both;
}
.kpi:nth-child(2){animation-delay:45ms}.kpi:nth-child(3){animation-delay:90ms}
.kpi:nth-child(4){animation-delay:135ms}.kpi:nth-child(5){animation-delay:180ms}
.kpi:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: color-mix(in srgb, var(--c) 45%, var(--border)); }
.kpi:active { transform: translateY(-1px); }
.kpi:focus-visible { outline: none; box-shadow: var(--ring); }
.kpi-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 55%, transparent)); }
.kpi-top { display: flex; align-items: center; gap: 7px; color: var(--c); margin-bottom: 8px; }
.kpi-ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); transition: transform .2s cubic-bezier(.34,1.56,.64,1); flex-shrink: 0; }
.kpi:hover .kpi-ic { transform: scale(1.1) rotate(-4deg); }
.kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.kpi-value { font-size: 26px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
.kpi-hint { font-size: 11.5px; color: var(--faint); margin-top: 2px; }
@media (max-width: 900px) { .rail { grid-template-columns: repeat(2, 1fr); } }
</style>
