<script setup lang="ts">
// Tiempo por persona: barras horizontales apiladas por tipo de tarea.
//
// La barra es el tiempo REAL (reloj de pared con al menos un PLU en la mano),
// asi que tres tapetes a la vez durante 3 minutos pintan 3 minutos, no 9. Si
// dos tipos se pisan, el trozo compartido se reparte entre ellos: los segmentos
// siempre suman la barra.
import { computed, ref } from 'vue'
import { fmtTiempo } from '~/utils/montacargas'
import {
  anclaDeElemento, fmtNumero, fmtPorcentaje, ROL_MEDIDO_LABEL, ticksLimpios,
  TIPO_TAREA_COLOR, TIPO_TAREA_LABEL, TIPOS_TAREA,
  type ColumnaTabla, type EstadoTooltip, type FilaTooltip, type IndicadorPersona,
} from '~/utils/indicadores'

const props = defineProps<{ personas: IndicadorPersona[] }>()

const tipos = computed(() => TIPOS_TAREA.filter((t) => props.personas.some((p) => p.porTipo[t] > 0)))

// Eje en horas, o en minutos si nadie llega a una hora: "0,2 h" no lo lee nadie.
const maximo = computed(() => Math.max(0, ...props.personas.map((p) => p.segundos)))
const unidadEje = computed(() => (maximo.value >= 3600 ? 3600 : 60))
const ticks = computed(() => ticksLimpios(maximo.value / unidadEje.value, 4))
const tope = computed(() => (ticks.value[ticks.value.length - 1] ?? 1) * unidadEje.value)
const pct = (seg: number) => (tope.value > 0 ? (seg / tope.value) * 100 : 0)
const etiquetaTick = (t: number) =>
  `${t.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ${unidadEje.value === 3600 ? 'h' : 'min'}`

const filas = computed(() => props.personas.map((p) => ({
  p,
  segmentos: TIPOS_TAREA.filter((t) => p.porTipo[t] > 0).map((t) => ({ tipo: t, seg: p.porTipo[t] })),
})))

// ── Tooltip: todo el desglose de la persona, no solo el segmento ──────
const tip = ref<EstadoTooltip | null>(null)
const activa = ref<string | null>(null)

function contenido(p: IndicadorPersona): Omit<EstadoTooltip, 'x' | 'y'> {
  const filasTip: FilaTooltip[] = TIPOS_TAREA.filter((t) => p.porTipo[t] > 0).map((t) => ({
    color: TIPO_TAREA_COLOR[t],
    etiqueta: TIPO_TAREA_LABEL[t],
    valor: fmtTiempo(p.porTipo[t]),
  }))
  filasTip.push({ etiqueta: 'tiempo real laborado', valor: fmtTiempo(p.segundos) })
  if (p.sumaRelojes > p.segundos) {
    filasTip.push({ etiqueta: 'si se sumaran sus relojes', valor: fmtTiempo(p.sumaRelojes) })
  }
  return { titulo: p.nombre, filas: filasTip }
}
function mostrar(e: PointerEvent, p: IndicadorPersona) {
  activa.value = p.id
  tip.value = { x: e.clientX, y: e.clientY, ...contenido(p) }
}
function mostrarFoco(e: FocusEvent, p: IndicadorPersona) {
  activa.value = p.id
  tip.value = { ...anclaDeElemento(e.target as Element), ...contenido(p) }
}
function ocultar() { activa.value = null; tip.value = null }

// ── Tabla gemela ─────────────────────────────────────────────────────
const columnas = computed<ColumnaTabla[]>(() => [
  { key: 'nombre', label: 'Persona' },
  { key: 'rol', label: 'Rol' },
  { key: 'real', label: 'Tiempo real', num: true },
  { key: 'suma', label: 'Suma de relojes', num: true },
  { key: 'dif', label: 'Contado de más', num: true },
  ...tipos.value.map((t) => ({ key: t, label: TIPO_TAREA_LABEL[t], num: true })),
  { key: 'und', label: 'Unidades', num: true },
  { key: 'plus', label: 'PLUs', num: true },
  { key: 'undh', label: 'Und/hora', num: true },
  { key: 'prom', label: 'Prom. por PLU', num: true },
])
const tabla = computed(() => props.personas.map((p) => ({
  nombre: p.nombre,
  rol: ROL_MEDIDO_LABEL[p.rol] ?? p.rol,
  real: fmtTiempo(p.segundos),
  suma: fmtTiempo(p.sumaRelojes),
  dif: p.sumaRelojes > p.segundos ? `+${fmtPorcentaje(p.sumaRelojes - p.segundos, p.segundos)}` : '—',
  ...Object.fromEntries(tipos.value.map((t) => [t, p.porTipo[t] > 0 ? fmtTiempo(p.porTipo[t]) : '—'])),
  und: fmtNumero(p.unidades),
  plus: fmtNumero(p.plus),
  undh: fmtNumero(p.unidadesPorHora),
  prom: fmtTiempo(p.promedioPorPlu),
})))
</script>

<template>
  <IndicadoresTarjeta
    titulo="Tiempo por persona"
    subtitulo="Tiempo real con al menos un PLU en la mano. Varios PLUs a la vez cuentan una sola vez."
  >
    <template #leyenda>
      <ul class="leyenda" aria-label="Tipos de tarea">
        <li v-for="t in tipos" :key="t">
          <span class="sw" :style="{ background: TIPO_TAREA_COLOR[t] }" />{{ TIPO_TAREA_LABEL[t] }}
        </li>
      </ul>
    </template>

    <div class="plot">
      <div class="rejilla" aria-hidden="true">
        <span v-for="t in ticks" :key="t" class="linea" :class="{ base: t === 0 }" :style="{ left: `${pct(t * unidadEje)}%` }" />
      </div>

      <div
        v-for="f in filas" :key="f.p.id" class="fila" :class="{ on: activa === f.p.id }"
        tabindex="0"
        :aria-label="`${f.p.nombre}: ${fmtTiempo(f.p.segundos)} de tiempo real`"
        @pointermove="mostrar($event, f.p)" @pointerleave="ocultar"
        @focus="mostrarFoco($event, f.p)" @blur="ocultar"
      >
        <span class="nom" :title="f.p.nombre">{{ f.p.nombre }}</span>
        <div class="pista">
          <div class="barra" :style="{ width: `${pct(f.p.segundos)}%` }">
            <span
              v-for="s in f.segmentos" :key="s.tipo" class="seg"
              :style="{ flexGrow: s.seg, background: TIPO_TAREA_COLOR[s.tipo] }"
            />
          </div>
          <span class="val tnum" :style="{ left: `calc(${pct(f.p.segundos)}% + 8px)` }">{{ fmtTiempo(f.p.segundos) }}</span>
        </div>
      </div>

      <div class="eje" aria-hidden="true">
        <span v-for="t in ticks" :key="t" :style="{ left: `${pct(t * unidadEje)}%` }">{{ etiquetaTick(t) }}</span>
      </div>
    </div>

    <template #tabla>
      <IndicadoresTabla :columnas="columnas" :filas="tabla" principal="nombre" />
    </template>

    <IndicadoresTooltip v-if="tip" v-bind="tip" />
  </IndicadoresTarjeta>
</template>

<style scoped>
.leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 14px; padding: 0; list-style: none; }
.leyenda li { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-2); }
.sw { width: 10px; height: 10px; border-radius: 2px; flex: none; }

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
