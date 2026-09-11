<script setup lang="ts">
// Tiempo por persona: barras horizontales apiladas por tipo de tarea.
//
// La barra es el tiempo REAL (reloj de pared con al menos un PLU en la mano),
// asi que tres tapetes a la vez durante 3 minutos pintan 3 minutos, no 9. Si
// dos tipos se pisan, el trozo compartido se reparte entre ellos: los segmentos
// siempre suman la barra.
import { computed } from 'vue'
import { fmtTiempo } from '~/utils/montacargas'
import {
  ejeDeTiempo, fmtNumero, fmtPorcentaje, ROL_MEDIDO_LABEL,
  TIPO_TAREA_COLOR, TIPO_TAREA_LABEL, TIPOS_TAREA,
  type ColumnaTabla, type FilaApilada, type FilaTooltip, type IndicadorPersona,
} from '~/utils/indicadores'

const props = defineProps<{ personas: IndicadorPersona[] }>()

const tipos = computed(() => TIPOS_TAREA.filter((t) => props.personas.some((p) => p.porTipo[t] > 0)))
const eje = computed(() => ejeDeTiempo(Math.max(0, ...props.personas.map((p) => p.segundos))))

const filas = computed<FilaApilada[]>(() => props.personas.map((p) => {
  const tooltip: FilaTooltip[] = TIPOS_TAREA.filter((t) => p.porTipo[t] > 0).map((t) => ({
    color: TIPO_TAREA_COLOR[t], etiqueta: TIPO_TAREA_LABEL[t], valor: fmtTiempo(p.porTipo[t]),
  }))
  tooltip.push({ etiqueta: 'tiempo real laborado', valor: fmtTiempo(p.segundos) })
  if (p.sumaRelojes > p.segundos) {
    tooltip.push({ etiqueta: 'si se sumaran sus relojes', valor: fmtTiempo(p.sumaRelojes) })
  }
  return {
    id: p.id,
    etiqueta: p.nombre,
    total: p.segundos,
    texto: fmtTiempo(p.segundos),
    segmentos: TIPOS_TAREA.map((t) => ({ key: t, valor: p.porTipo[t], color: TIPO_TAREA_COLOR[t] })),
    tooltip,
  }
}))

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

    <IndicadoresBarrasApiladas :filas="filas" :escala-eje="eje.escala" :formato-eje="eje.formato" />

    <template #tabla>
      <IndicadoresTabla :columnas="columnas" :filas="tabla" principal="nombre" />
    </template>
  </IndicadoresTarjeta>
</template>

<style scoped>
.leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 14px; padding: 0; list-style: none; }
.leyenda li { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-2); }
.sw { width: 10px; height: 10px; border-radius: 2px; flex: none; }
</style>
