<script setup lang="ts">
import { computed } from 'vue'
import { Boxes, Clock, CheckCircle2, TriangleAlert, Wallet } from '@lucide/vue'
import { fmtCOP } from '~/utils/guardado'

// Antes se calculaba filtrando el arreglo completo de guardados cargado
// en el cliente — con la lista paginada de verdad eso solo reflejaría la
// página visible. Los totales (incluido el costo de almacenaje, que
// depende de la fecha de cada guardado activo) ahora vienen de
// /api/transporte/conteos.
const props = defineProps<{ counts: { total: number; pend: number; desp: number; alertas: number; costo: number } }>()
const emit = defineEmits<{ (e: 'filter', key: string): void }>()

const k = computed(() => props.counts)

const cards = computed(() => [
  { key: 'total', label: 'Total registros', value: k.value.total, tone: 'var(--ink)', icon: Boxes, filter: '', hint: 'en custodia' },
  { key: 'pend', label: 'Pendientes despacho', value: k.value.pend, tone: 'var(--u-aviso)', icon: Clock, filter: 'PENDIENTE DESPACHO', hint: 'por enviar' },
  { key: 'desp', label: 'Despachados', value: k.value.desp, tone: 'var(--u-ok)', icon: CheckCircle2, filter: 'DESPACHADO', hint: 'completados' },
  { key: 'alertas', label: 'Con alerta de entrega', value: k.value.alertas, tone: k.value.alertas ? 'var(--u-critico)' : 'var(--u-ok)', icon: TriangleAlert, filter: 'alerta', hint: 'requieren acción' },
  { key: 'costo', label: 'Almacenaje activo', value: k.value.costo, tone: 'var(--bill)', icon: Wallet, filter: '', hint: 'acumulado', money: true },
])
</script>

<template>
  <div class="rail">
    <button
      v-for="c in cards" :key="c.key" class="kpi" :style="{ '--c': c.tone }"
      @click="emit('filter', c.filter)"
    >
      <span class="kpi-bar" />
      <div class="kpi-top">
        <span class="kpi-ic"><component :is="c.icon" :size="16" /></span>
        <span class="kpi-hint">{{ c.hint }}</span>
      </div>
      <span class="kpi-value tnum"><CountUp :value="c.value" :format="c.money ? fmtCOP : undefined" /></span>
      <span class="kpi-label">{{ c.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.rail { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.kpi {
  position: relative; text-align: left; cursor: pointer;
  background:
    radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--c) 6%, transparent), transparent 60%),
    var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 15px 16px 16px;
  box-shadow: var(--shadow-xs); overflow: hidden;
  transition: transform .16s cubic-bezier(.16,1,.3,1), box-shadow .16s, border-color .16s;
  animation: auroraFade .34s cubic-bezier(.16,1,.3,1) both;
}
.kpi:nth-child(2){animation-delay:45ms}.kpi:nth-child(3){animation-delay:90ms}
.kpi:nth-child(4){animation-delay:135ms}.kpi:nth-child(5){animation-delay:180ms}
.kpi:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: color-mix(in srgb, var(--c) 45%, var(--border)); }
.kpi:active { transform: translateY(-1px); }
.kpi:focus-visible { outline: none; box-shadow: var(--ring); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.kpi-ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); transition: transform .2s cubic-bezier(.34,1.56,.64,1); }
.kpi:hover .kpi-ic { transform: scale(1.1) rotate(-4deg); }
.kpi-hint { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); }
.kpi-value { display: block; font-family: var(--display); font-size: 28px; font-weight: 800; letter-spacing: -.035em; color: var(--c); line-height: 1.05; }
.kpi-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-top: 3px; }
.kpi-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 55%, transparent)); }
@media (max-width: 900px) { .rail { grid-template-columns: repeat(2, 1fr); } }
</style>
