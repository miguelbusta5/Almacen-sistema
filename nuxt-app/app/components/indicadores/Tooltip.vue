<script setup lang="ts">
// Tooltip compartido por los graficos. Fijo a la ventana (no al grafico) para
// que el scroll horizontal de una tarjeta no lo recorte.
//
// El valor manda y la etiqueta acompaña: quien pasa el raton ya sabe que serie
// mira, lo que quiere es el numero. Cada fila se marca con un trazo corto del
// color de la serie, no con una caja.
import { computed } from 'vue'
import type { FilaTooltip } from '~/utils/indicadores'

const props = defineProps<{
  x: number
  y: number
  titulo: string
  filas: FilaTooltip[]
}>()

// Se da la vuelta cerca del borde derecho o inferior en vez de salirse.
const estilo = computed(() => {
  const ancho = typeof window === 'undefined' ? 1200 : window.innerWidth
  const alto = typeof window === 'undefined' ? 800 : window.innerHeight
  const izq = props.x + 14 + 240 > ancho ? props.x - 14 - 240 : props.x + 14
  const arriba = props.y + 14 + 40 + props.filas.length * 22 > alto ? props.y - 14 - 40 - props.filas.length * 22 : props.y + 14
  return { left: `${Math.max(8, izq)}px`, top: `${Math.max(8, arriba)}px` }
})
</script>

<template>
  <div class="tip" :style="estilo" role="status" aria-live="polite">
    <p class="tip-titulo">{{ titulo }}</p>
    <p v-for="(f, i) in filas" :key="i" class="tip-fila">
      <span v-if="f.color" class="tip-key" :style="{ background: f.color }" />
      <b class="tnum">{{ f.valor }}</b>
      <span class="tip-etq">{{ f.etiqueta }}</span>
    </p>
  </div>
</template>

<style scoped>
.tip {
  position: fixed; z-index: 60; width: max-content; max-width: 240px; pointer-events: none;
  padding: 9px 11px; border-radius: var(--r-sm);
  background: var(--surface); border: 1px solid var(--border-strong); box-shadow: var(--shadow);
}
.tip-titulo { margin: 0 0 5px; font-size: 11.5px; font-weight: 700; color: var(--muted); }
.tip-fila { display: flex; align-items: center; gap: 7px; margin: 3px 0 0; font-size: 12.5px; white-space: nowrap; }
.tip-fila b { font-weight: 700; color: var(--ink); }
.tip-etq { color: var(--muted); }
.tip-key { width: 12px; height: 3px; border-radius: 2px; flex: none; }
</style>
