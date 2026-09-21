<script setup lang="ts">
// "Este PLU viene en varias cajas": el aviso que tapa la pantalla.
//
// Bloquea a proposito. Bajar una caja y dejar la otra arriba es el error que
// mas se repite, y un letrero al lado se pasa por alto con la pistola en la
// mano. Se usa igual en Picking (al escanear el PLU) y en Inspeccion (al
// iniciarlo), asi que vive aparte de los dos modulos.
import { Boxes, CornerDownLeft } from '@lucide/vue'
import { fmtKg, type CajaPlu } from '~/utils/muebles'

defineProps<{
  abierto: boolean
  plu: string
  descripcion?: string | null
  cajas: CajaPlu[]
}>()
const emit = defineEmits<{ (e: 'entendido'): void }>()

/** "80 × 66 × 160 cm", o vacio si a la caja le falta alguna medida. */
function medidas(c: CajaPlu): string {
  if (c.altoCm == null || c.anchoCm == null || c.profCm == null) return ''
  const n = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 })
  return `${n(c.altoCm)} × ${n(c.anchoCm)} × ${n(c.profCm)} cm`
}
</script>

<template>
  <div v-if="abierto" class="overlay">
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="partes-titulo">
      <span class="ic"><Boxes :size="26" /></span>
      <h3 id="partes-titulo" class="m-titulo">Este PLU viene en {{ cajas.length }} cajas</h3>
      <p class="m-desc">
        <b class="mono">{{ plu }}</b>
        <template v-if="descripcion"> · {{ descripcion }}</template>
      </p>

      <ul class="cajas">
        <li v-for="c in cajas" :key="c.parte" class="caja">
          <span class="c-n">Caja {{ c.parte }}</span>
          <span class="c-med">{{ medidas(c) || 'Sin medidas' }}</span>
          <span class="c-kg tnum">{{ fmtKg(c.pesoBrutoKg) }}</span>
        </li>
      </ul>

      <p class="m-pie">Bájalas todas antes de cerrar el PLU.</p>

      <button class="btn btn-primary btn-entendido" autofocus @click="emit('entendido')">
        <CornerDownLeft :size="15" /> Entendido
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.62); }
.modal { width: 100%; max-width: 420px; padding: 22px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--u-aviso); box-shadow: 0 18px 50px rgba(0,0,0,.28); text-align: center; }
.ic { display: grid; place-items: center; width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 50%; color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 15%, transparent); }
.m-titulo { margin: 0 0 6px; font-size: 20px; font-weight: 800; line-height: 1.25; color: var(--ink); }
.m-desc { margin: 0 0 14px; font-size: 13px; color: var(--muted); }
.cajas { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 6px; text-align: left; }
.caja { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 9px 12px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--ink) 5%, transparent); }
.c-n { font-size: 12.5px; font-weight: 800; color: var(--ink); }
.c-med { flex: 1 1 auto; font-size: 12.5px; color: var(--ink-2); }
.c-kg { font-size: 12.5px; font-weight: 700; color: var(--muted); }
.m-pie { margin: 0 0 16px; font-size: 13px; font-weight: 700; color: var(--ink-2); }
.btn-entendido { width: 100%; justify-content: center; padding: 13px; font-size: 15px; }
</style>
