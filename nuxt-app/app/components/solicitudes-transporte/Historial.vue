<script setup lang="ts">
// Timeline del historial. El endpoint de detalle ya lo devolvía en la app Next, pero
// su UI nunca lo pedía ni lo mostraba: es trazabilidad que estaba escrita en la base
// y no llegaba a nadie.
import { ESTADO_LABEL, ESTADO_TONE, fmtFechaHoraSol, type HistorialItem } from '~/utils/solicitudesTransporte'

defineProps<{ items: HistorialItem[] }>()
</script>

<template>
  <div v-if="items.length" class="tl">
    <div v-for="h in items" :key="h.id" class="ev" :style="{ '--c': ESTADO_TONE[h.estadoNuevo] }">
      <span class="dot" />
      <div class="body">
        <div class="cab">
          <span class="paso">
            <template v-if="h.estadoAnterior">{{ ESTADO_LABEL[h.estadoAnterior] }} → </template>
            <b>{{ ESTADO_LABEL[h.estadoNuevo] }}</b>
          </span>
          <span class="fecha tnum">{{ fmtFechaHoraSol(h.createdAt) }}</span>
        </div>
        <p v-if="h.observacion" class="obs">{{ h.observacion }}</p>
        <span class="autor">{{ h.usuarioNombre || 'Sistema' }}</span>
      </div>
    </div>
  </div>
  <p v-else class="vacio">Sin movimientos registrados.</p>
</template>

<style scoped>
.tl { display: flex; flex-direction: column; }
.ev { position: relative; display: flex; gap: 12px; padding: 0 0 16px 0; }
.ev::before { content: ''; position: absolute; left: 5px; top: 14px; bottom: 0; width: 1px; background: var(--border); }
.ev:last-child { padding-bottom: 0; }
.ev:last-child::before { display: none; }
.dot { width: 11px; height: 11px; border-radius: 50%; background: var(--c); flex-shrink: 0; margin-top: 3px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent); position: relative; z-index: 1; }
.body { flex: 1; min-width: 0; }
.cab { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.paso { font-size: 12.5px; color: var(--muted); }
.paso b { color: var(--ink); font-weight: 600; }
.fecha { font-size: 11.5px; color: var(--faint); }
.obs { margin: 4px 0 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
.autor { display: block; margin-top: 3px; font-size: 11.5px; color: var(--faint); }
.vacio { font-size: 13px; color: var(--muted); margin: 0; }
</style>
