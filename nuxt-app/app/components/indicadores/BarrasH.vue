<script setup lang="ts">
// Barras horizontales de una sola medida, con el valor en la punta.
//
// Horizontales y no columnas: las etiquetas son nombres de personas, y en
// vertical habria que girarlos o cortarlos.
import { computed, ref } from 'vue'
import { anclaDeElemento, ticksLimpios, type BarraH, type EstadoTooltip } from '~/utils/indicadores'

const props = defineProps<{
  items: BarraH[]
  /** Nombre de la medida para el tooltip ("und/hora"). */
  medida: string
  /** Marca del eje → texto. */
  formatoEje: (v: number) => string
  /** Divisor del eje (60 = minutos) para que las marcas salgan redondas. */
  escalaEje?: number
  anchoEtiqueta?: number
  /** Sitio a la derecha para el texto de la punta, en px. */
  reserva?: number
}>()

const vars = computed(() => ({
  ...(props.anchoEtiqueta ? { '--nombre': `${props.anchoEtiqueta}px` } : {}),
  ...(props.reserva ? { '--reserva': `${props.reserva}px` } : {}),
}))

const div = computed(() => props.escalaEje ?? 1)
const ticks = computed(() => ticksLimpios(Math.max(0, ...props.items.map((i) => i.valor)) / div.value, 4))
const tope = computed(() => (ticks.value[ticks.value.length - 1] ?? 1) * div.value)
const pct = (v: number) => (tope.value > 0 ? (v / tope.value) * 100 : 0)

const tip = ref<EstadoTooltip | null>(null)
const activa = ref<string | null>(null)
function contenido(b: BarraH): Omit<EstadoTooltip, 'x' | 'y'> {
  return {
    titulo: b.etiqueta,
    filas: [{ color: b.color ?? 'var(--viz-medida)', etiqueta: props.medida, valor: b.texto }, ...(b.detalle ?? [])],
  }
}
function mostrar(e: PointerEvent, b: BarraH) {
  activa.value = b.id
  tip.value = { x: e.clientX, y: e.clientY, ...contenido(b) }
}
function mostrarFoco(e: FocusEvent, b: BarraH) {
  activa.value = b.id
  tip.value = { ...anclaDeElemento(e.target as Element), ...contenido(b) }
}
function ocultar() { activa.value = null; tip.value = null }
</script>

<template>
  <div class="plot" :style="vars">
    <div class="rejilla" aria-hidden="true">
      <span
        v-for="t in ticks" :key="t" class="linea" :class="{ base: t === 0 }"
        :style="{ left: `${pct(t * div)}%` }"
      />
    </div>

    <div
      v-for="b in items" :key="b.id" class="fila" :class="{ on: activa === b.id }" tabindex="0"
      :aria-label="`${b.etiqueta}: ${b.texto} ${medida}`"
      @pointermove="mostrar($event, b)" @pointerleave="ocultar" @focus="mostrarFoco($event, b)" @blur="ocultar"
    >
      <span class="nom" :title="b.etiqueta">{{ b.etiqueta }}</span>
      <div class="pista">
        <span class="barra" :style="{ width: `${pct(b.valor)}%`, background: b.color ?? 'var(--viz-medida)' }" />
        <span class="val tnum" :style="{ left: `calc(${pct(b.valor)}% + 8px)` }">{{ b.texto }}</span>
      </div>
    </div>

    <div class="eje" aria-hidden="true">
      <span v-for="t in ticks" :key="t" :style="{ left: `${pct(t * div)}%` }">{{ formatoEje(t * div) }}</span>
    </div>

    <IndicadoresTooltip v-if="tip" v-bind="tip" />
  </div>
</template>

<style scoped>
.plot { --nombre: 150px; --reserva: 84px; --hueco: 12px; position: relative; }
.rejilla {
  position: absolute; top: 0; bottom: 24px;
  left: calc(var(--nombre) + var(--hueco)); right: var(--reserva);
  pointer-events: none;
}
.linea { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--viz-grid); }
.linea.base { background: var(--border-strong); }

.fila {
  position: relative; display: grid; grid-template-columns: var(--nombre) 1fr; gap: var(--hueco);
  align-items: center; height: 32px; border-radius: var(--r-xs); outline: none;
}
.fila.on, .fila:focus-visible { background: color-mix(in srgb, var(--surface-3) 60%, transparent); }
.fila:focus-visible { box-shadow: var(--ring); }
.nom {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 4px;
  font-size: 12.5px; font-weight: 600; color: var(--ink);
}
.pista { position: relative; height: 100%; margin-right: var(--reserva); }
/* 18px de grueso, 4px redondeado en la punta y recto en la base. */
.barra { position: absolute; left: 0; top: 7px; bottom: 7px; min-width: 2px; border-radius: 0 4px 4px 0; }
.fila.on .barra, .fila:focus-visible .barra { filter: brightness(1.12); }
.val {
  position: absolute; top: 50%; transform: translateY(-50%); white-space: nowrap;
  font-size: 12px; font-weight: 700; color: var(--ink-2);
}

.eje {
  position: relative; height: 24px;
  margin-left: calc(var(--nombre) + var(--hueco)); margin-right: var(--reserva);
}
.eje span {
  position: absolute; top: 6px; transform: translateX(-50%); white-space: nowrap;
  font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .plot { --nombre: 104px; --reserva: 70px; --hueco: 8px; }
  .nom { font-size: 11.5px; }
}
</style>
