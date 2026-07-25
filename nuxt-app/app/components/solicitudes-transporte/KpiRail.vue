<script setup lang="ts">
// KPIs alimentados por el groupBy del servidor (la versión React los calculaba sobre
// las ≤25 filas cargadas, así que mentían en cuanto había más registros).
import { computed } from 'vue'
import { Clock, Send, TriangleAlert, CalendarX } from '@lucide/vue'

const props = defineProps<{
  kpis: Record<string, number>
  kpisSemaforo: Record<string, number>
  isGestor: boolean
  activo: { estado: string; semaforo: string }
}>()
const emit = defineEmits<{ (e: 'filter', patch: { estado?: string; semaforo?: string }): void }>()

const n = (o: Record<string, number>, k: string) => o[k] ?? 0

const cards = computed(() => [
  // El número tiene que ser exactamente lo que filtra la tarjeta: si mostrara
  // PENDIENTE+REENVIADA y filtrara solo PENDIENTE, el usuario pulsaría un 12 y la
  // tabla le daría 9. Las reenviadas van en el hint.
  {
    key: 'pend',
    label: 'Pendientes',
    value: n(props.kpis, 'PENDIENTE'),
    hint: `${n(props.kpis, 'REENVIADA')} reenviadas`,
    tone: 'var(--u-aviso)',
    icon: Clock,
    patch: { estado: 'PENDIENTE' },
    on: props.activo.estado === 'PENDIENTE',
  },
  {
    key: 'prog',
    label: 'Programadas',
    value: n(props.kpis, 'PROGRAMADA'),
    hint: `${n(props.kpis, 'EFECTUADA')} efectuadas`,
    tone: 'var(--info)',
    icon: Send,
    patch: { estado: 'PROGRAMADA' },
    on: props.activo.estado === 'PROGRAMADA',
  },
  {
    key: 'rech',
    label: 'Rechazadas',
    value: n(props.kpis, 'RECHAZADA'),
    hint: props.isGestor ? 'por gestionar' : 'por corregir',
    tone: 'var(--u-critico)',
    icon: TriangleAlert,
    patch: { estado: 'RECHAZADA' },
    on: props.activo.estado === 'RECHAZADA',
  },
  {
    key: 'venc',
    label: 'Vencidas',
    value: n(props.kpisSemaforo, 'VENCIDO'),
    hint: `${n(props.kpisSemaforo, 'ALERTA')} por vencer`,
    tone: 'var(--u-emergencia)',
    icon: CalendarX,
    patch: { semaforo: 'VENCIDO' },
    on: props.activo.semaforo === 'VENCIDO',
  },
])

// Segundo clic sobre la tarjeta activa limpia el filtro: la card es un botón y esa
// es la afordancia que espera el usuario.
function onClick(c: { patch: { estado?: string; semaforo?: string }; on: boolean }) {
  if (c.on) {
    emit('filter', c.patch.estado !== undefined ? { estado: '' } : { semaforo: '' })
    return
  }
  emit('filter', c.patch)
}
</script>

<template>
  <div class="rail">
    <button
      v-for="c in cards" :key="c.key" class="kpi" :class="{ on: c.on }"
      :style="{ '--c': c.tone }" :aria-pressed="c.on" @click="onClick(c)"
    >
      <span class="kpi-bar" />
      <div class="kpi-top">
        <span class="kpi-ic"><component :is="c.icon" :size="16" /></span>
        <span class="kpi-hint">{{ c.hint }}</span>
      </div>
      <span class="kpi-value tnum"><CountUp :value="c.value" /></span>
      <span class="kpi-label">{{ c.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi {
  position: relative; text-align: left; cursor: pointer;
  background: radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--c) 6%, transparent), transparent 60%), var(--surface);
  border: 1px solid var(--border); border-radius: var(--r-md); padding: 15px 16px 16px;
  box-shadow: var(--shadow-xs); overflow: hidden;
  transition: transform .16s cubic-bezier(.16,1,.3,1), box-shadow .16s, border-color .16s;
  animation: auroraFade .34s cubic-bezier(.16,1,.3,1) both;
}
.kpi:nth-child(2){animation-delay:45ms}.kpi:nth-child(3){animation-delay:90ms}.kpi:nth-child(4){animation-delay:135ms}
.kpi:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: color-mix(in srgb, var(--c) 45%, var(--border)); }
.kpi.on { border-color: var(--c); box-shadow: 0 0 0 1px var(--c); }
.kpi:active { transform: translateY(-1px); }
.kpi:focus-visible { outline: none; box-shadow: var(--ring); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
.kpi-ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); transition: transform .2s cubic-bezier(.34,1.56,.64,1); flex-shrink: 0; }
.kpi:hover .kpi-ic { transform: scale(1.1) rotate(-4deg); }
.kpi-hint { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); text-align: right; }
.kpi-value { display: block; font-family: var(--display); font-size: 28px; font-weight: 800; letter-spacing: -.035em; color: var(--c); line-height: 1.05; }
.kpi-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-top: 3px; }
.kpi-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 55%, transparent)); }
@media (max-width: 900px) { .rail { grid-template-columns: repeat(2, 1fr); } }
</style>
