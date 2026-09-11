<script setup lang="ts">
// Linea de una sola serie por dia, con cruz que sigue al puntero.
//
// Una serie por grafico a proposito: tiempo y unidades tienen escalas que no se
// parecen, y ponerlas en dos ejes del mismo grafico hace que el cruce de las
// lineas parezca decir algo que no dice.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fmtDiaCorto, ticksLimpios, type EstadoTooltip } from '~/utils/indicadores'

const props = defineProps<{
  /** Un punto por dia, en orden. */
  puntos: { dia: string; valor: number }[]
  /** Valor → texto del tooltip. */
  formato: (v: number) => string
  /** Texto corto para la etiqueta al final de la linea (cabe en su margen). */
  formatoFin?: (v: number) => string
  /** Divisor para el eje (3600 = horas) y su sufijo. */
  escalaEje?: number
  sufijoEje?: string
  etiqueta: string
}>()

const caja = ref<HTMLElement | null>(null)
const ancho = ref(600)
let obs: ResizeObserver | null = null
onMounted(() => {
  if (!caja.value) return
  ancho.value = caja.value.clientWidth
  obs = new ResizeObserver(([e]) => { if (e) ancho.value = e.contentRect.width })
  obs.observe(caja.value)
})
onBeforeUnmount(() => obs?.disconnect())

const ALTO = 190
const M = { izq: 46, der: 64, arr: 12, aba: 28 }
const plotW = computed(() => Math.max(40, ancho.value - M.izq - M.der))
const plotH = ALTO - M.arr - M.aba

const div = computed(() => props.escalaEje ?? 1)
const ticks = computed(() => ticksLimpios(Math.max(0, ...props.puntos.map((p) => p.valor)) / div.value, 4))
const tope = computed(() => (ticks.value[ticks.value.length - 1] ?? 1) * div.value)

const x = (i: number) => M.izq + (props.puntos.length <= 1 ? plotW.value / 2 : (i / (props.puntos.length - 1)) * plotW.value)
const y = (v: number) => M.arr + plotH - (tope.value > 0 ? (v / tope.value) * plotH : 0)

const trazo = computed(() => props.puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' '))
const area = computed(() => {
  if (props.puntos.length < 2) return ''
  const base = (M.arr + plotH).toFixed(1)
  return `${trazo.value} L${x(props.puntos.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`
})

// Las fechas que caben (una cada ~56 px, y nunca mas de 7): una por dia en 30
// dias, o en un movil, es una mancha. La ultima siempre sale, y si queda pegada
// a la anterior la reemplaza.
const etiquetasX = computed(() => {
  const n = props.puntos.length
  if (!n) return []
  const caben = Math.max(2, Math.min(7, Math.floor(plotW.value / 56)))
  const paso = Math.max(1, Math.ceil(n / caben))
  const idx: number[] = []
  for (let i = 0; i < n; i += paso) idx.push(i)
  if (idx[idx.length - 1] !== n - 1) {
    if (n - 1 - idx[idx.length - 1]! < paso * 0.6) idx.pop()
    idx.push(n - 1)
  }
  return idx.map((i) => ({ i, texto: fmtDiaCorto(props.puntos[i]!.dia) }))
})
const conPuntos = computed(() => props.puntos.length <= 31)
const ultimo = computed(() => props.puntos[props.puntos.length - 1])

// ── Cruz + tooltip ──────────────────────────────────────────────────
const indice = ref<number | null>(null)
const tip = ref<EstadoTooltip | null>(null)

function contenido(i: number): Omit<EstadoTooltip, 'x' | 'y'> {
  const p = props.puntos[i]!
  return { titulo: fmtDiaCorto(p.dia), filas: [{ color: 'var(--viz-medida)', etiqueta: props.etiqueta, valor: props.formato(p.valor) }] }
}
function mover(e: PointerEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const r = svg.getBoundingClientRect()
  const px = e.clientX - r.left - M.izq
  const n = props.puntos.length
  if (!n) return
  const i = n === 1 ? 0 : Math.round(Math.min(1, Math.max(0, px / plotW.value)) * (n - 1))
  indice.value = i
  tip.value = { x: e.clientX, y: e.clientY, ...contenido(i) }
}
function teclado(e: KeyboardEvent) {
  const n = props.puntos.length
  if (!n) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const actual = indice.value ?? n - 1
  const i = Math.min(n - 1, Math.max(0, actual + (e.key === 'ArrowRight' ? 1 : -1)))
  indice.value = i
  const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  tip.value = { x: r.left + x(i), y: r.top + y(props.puntos[i]!.valor), ...contenido(i) }
}
function enfocar(e: FocusEvent) {
  const n = props.puntos.length
  if (!n) return
  const i = indice.value ?? n - 1
  indice.value = i
  const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  tip.value = { x: r.left + x(i), y: r.top + y(props.puntos[i]!.valor), ...contenido(i) }
}
function salir() { indice.value = null; tip.value = null }
</script>

<template>
  <div ref="caja" class="linea-caja">
    <svg
      :width="ancho" :height="ALTO" class="linea-svg" tabindex="0" role="img"
      :aria-label="`${etiqueta} por día. Usa las flechas para recorrer los días.`"
      @pointermove="mover" @pointerleave="salir" @keydown="teclado" @focus="enfocar" @blur="salir"
    >
      <!-- Rejilla: una linea fina por marca, recesiva. -->
      <g aria-hidden="true">
        <line
          v-for="t in ticks" :key="t"
          :x1="M.izq" :x2="M.izq + plotW" :y1="y(t * div)" :y2="y(t * div)"
          :class="t === 0 ? 'base' : 'grid'"
        />
        <text
          v-for="t in ticks" :key="`t${t}`" class="tick" :x="M.izq - 8" :y="y(t * div) + 4" text-anchor="end"
        >{{ t.toLocaleString('es-CO', { maximumFractionDigits: 1 }) }}{{ sufijoEje ?? '' }}</text>
        <text
          v-for="l in etiquetasX" :key="`x${l.i}`" class="tick" :x="x(l.i)" :y="ALTO - 8"
          :text-anchor="puntos.length === 1 ? 'middle' : l.i === 0 ? 'start' : l.i === puntos.length - 1 ? 'end' : 'middle'"
        >{{ l.texto }}</text>
      </g>

      <path v-if="area" :d="area" class="area" />
      <path :d="trazo" class="trazo" />

      <line
        v-if="indice !== null" class="cruz"
        :x1="x(indice)" :x2="x(indice)" :y1="M.arr" :y2="M.arr + plotH"
      />

      <template v-if="conPuntos">
        <circle
          v-for="(p, i) in puntos" :key="p.dia" :cx="x(i)" :cy="y(p.valor)"
          :r="indice === i ? 5.5 : 4" class="punto"
        />
      </template>
      <circle v-else-if="indice !== null" :cx="x(indice)" :cy="y(puntos[indice]!.valor)" r="5.5" class="punto" />

      <!-- El valor del ultimo dia, al final de la linea. -->
      <text
        v-if="ultimo" class="fin" :x="x(puntos.length - 1) + 10" :y="y(ultimo.valor) + 4"
      >{{ (formatoFin ?? formato)(ultimo.valor) }}</text>
    </svg>
    <IndicadoresTooltip v-if="tip" v-bind="tip" />
  </div>
</template>

<style scoped>
.linea-caja { width: 100%; min-width: 0; }
.linea-svg { display: block; overflow: visible; outline: none; border-radius: var(--r-xs); }
.linea-svg:focus-visible { box-shadow: var(--ring); }
.grid { stroke: var(--viz-grid); stroke-width: 1; shape-rendering: crispEdges; }
.base { stroke: var(--border-strong); stroke-width: 1; shape-rendering: crispEdges; }
.tick { font-size: 11px; fill: var(--muted); font-variant-numeric: tabular-nums; }
.area { fill: var(--viz-medida); fill-opacity: .1; stroke: none; }
.trazo { fill: none; stroke: var(--viz-medida); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
/* Anillo del color de la tarjeta: el punto se lee aunque cruce la linea. */
.punto { fill: var(--viz-medida); stroke: var(--surface); stroke-width: 2; }
.cruz { stroke: var(--faint); stroke-width: 1; shape-rendering: crispEdges; }
.fin { font-size: 12px; font-weight: 700; fill: var(--ink-2); }
</style>
