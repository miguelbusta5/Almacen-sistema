<script setup lang="ts">
// Barras horizontales apiladas: una fila por persona, un segmento por serie.
//
// Los segmentos van separados por 2 px del color de la tarjeta (no por un
// borde) y la punta de la barra lleva el total. El tooltip muestra el desglose
// entero de la fila, no solo el segmento que toca el puntero.
import { computed, ref } from 'vue'
import { anclaDeElemento, ticksLimpios, type EstadoTooltip, type FilaApilada } from '~/utils/indicadores'
import { colorHex, unidadDeFormato, usarRegistroGrafico } from '~/utils/exportarDashboard'

const props = defineProps<{
  filas: FilaApilada[]
  formatoEje: (v: number) => string
  escalaEje?: number
}>()

const div = computed(() => props.escalaEje ?? 1)
// El eje llega hasta la jornada, si se conoce: la barra tiene que leerse como
// una parte del turno, no ocupar todo el ancho.
const ticks = computed(() => ticksLimpios(
  Math.max(0, ...props.filas.map((f) => Math.max(f.total, f.fondo ?? 0))) / div.value, 4,
))
const tope = computed(() => (ticks.value[ticks.value.length - 1] ?? 1) * div.value)
const pct = (v: number) => (tope.value > 0 ? (v / tope.value) * 100 : 0)

// Al exportar el dashboard: barras apiladas nativas en Excel, una serie por segmento.
const raiz = ref<HTMLElement | null>(null)
usarRegistroGrafico(raiz, (el) => {
  const unidad = unidadDeFormato(props.formatoEje)
  const claves: Array<{ key: string; nombre: string; color: string }> = []
  for (const f of props.filas) for (const s of f.segmentos) {
    if (!claves.some((c) => c.key === s.key)) claves.push({ key: s.key, nombre: s.nombre ?? s.key, color: s.color })
  }
  return {
    tipo: 'apiladas',
    categoria: 'Nombre',
    categorias: props.filas.map((f) => f.etiqueta),
    series: claves.map((c) => ({
      nombre: unidad ? `${c.nombre} (${unidad})` : c.nombre,
      valores: props.filas.map((f) => (f.segmentos.find((s) => s.key === c.key)?.valor ?? 0) / div.value),
      color: colorHex(el, c.color),
    })),
  }
})

const tip = ref<EstadoTooltip | null>(null)
const activa = ref<string | null>(null)
function mostrar(e: PointerEvent, f: FilaApilada) {
  activa.value = f.id
  tip.value = { x: e.clientX, y: e.clientY, titulo: f.etiqueta, filas: f.tooltip }
}
function mostrarFoco(e: FocusEvent, f: FilaApilada) {
  activa.value = f.id
  tip.value = { ...anclaDeElemento(e.target as Element), titulo: f.etiqueta, filas: f.tooltip }
}
function ocultar() { activa.value = null; tip.value = null }
</script>

<template>
  <div ref="raiz" class="plot">
    <div class="rejilla" aria-hidden="true">
      <span
        v-for="t in ticks" :key="t" class="linea" :class="{ base: t === 0 }"
        :style="{ left: `${pct(t * div)}%` }"
      />
    </div>

    <div
      v-for="f in filas" :key="f.id" class="fila" :class="{ on: activa === f.id }" tabindex="0"
      :aria-label="`${f.etiqueta}: ${f.texto}`"
      @pointermove="mostrar($event, f)" @pointerleave="ocultar" @focus="mostrarFoco($event, f)" @blur="ocultar"
    >
      <span class="nom" :title="f.etiqueta">{{ f.etiqueta }}</span>
      <div class="pista">
        <!-- La jornada del turno, detras: la barra se lee como parte de ella. -->
        <span v-if="f.fondo" class="jornada" :style="{ width: `${pct(f.fondo)}%` }" />
        <div class="barra" :style="{ width: `${pct(f.total)}%` }">
          <span
            v-for="s in f.segmentos.filter((x) => x.valor > 0)" :key="s.key" class="seg"
            :style="{ flexGrow: s.valor, background: s.color }"
          />
        </div>
        <span class="val tnum" :style="{ left: `calc(${pct(f.total)}% + 8px)` }">{{ f.texto }}</span>
      </div>
    </div>

    <div class="eje" aria-hidden="true">
      <span v-for="t in ticks" :key="t" :style="{ left: `${pct(t * div)}%` }">{{ formatoEje(t * div) }}</span>
    </div>

    <IndicadoresTooltip v-if="tip" v-bind="tip" />
  </div>
</template>

<style scoped>
/* Nombre | pista. La pista deja a la derecha sitio para el total, que va
   pegado a la punta de la barra y nunca se sale de la tarjeta. */
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
  align-items: center; height: 34px; border-radius: var(--r-xs); outline: none;
}
.fila.on, .fila:focus-visible { background: color-mix(in srgb, var(--surface-3) 60%, transparent); }
.fila:focus-visible { box-shadow: var(--ring); }
.nom {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 4px;
  font-size: 12.5px; font-weight: 600; color: var(--ink);
}
.pista { position: relative; height: 100%; margin-right: var(--reserva); }
.jornada {
  position: absolute; left: 0; top: 8px; bottom: 8px; border-radius: 0 4px 4px 0;
  background: var(--surface-3); border-right: 1px solid var(--border-strong);
}
.barra { position: absolute; left: 0; top: 8px; bottom: 8px; display: flex; gap: 2px; min-width: 3px; }
/* 4px redondeado en la punta, recto en la base. */
.seg { flex-basis: 0; flex-shrink: 1; min-width: 2px; height: 100%; }
.seg:last-child { border-radius: 0 4px 4px 0; }
.fila.on .seg, .fila:focus-visible .seg { filter: brightness(1.08) saturate(1.05); }
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
