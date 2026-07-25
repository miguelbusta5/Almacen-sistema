<script setup lang="ts">
// Solo para NO gestores: es su bandeja de "esto te lo devolvieron, corrígelo".
import { computed } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import type { Solicitud } from '~/utils/solicitudesTransporte'

const props = defineProps<{ items: Solicitud[] }>()
const emit = defineEmits<{
  (e: 'corregir', item: Solicitud): void
  (e: 'abrir', item: Solicitud): void
  (e: 'verTodas'): void
}>()

const visibles = computed(() => props.items.slice(0, 3))
const resto = computed(() => Math.max(0, props.items.length - visibles.value.length))
</script>

<template>
  <section class="banner">
    <header class="b-head">
      <TriangleAlert :size="15" />
      <b>Solicitudes rechazadas por corregir</b>
    </header>

    <div v-for="item in visibles" :key="item.id" class="fila">
      <div class="txt">
        <span class="tit">{{ item.numeroPedido || item.ciudadEntrega }}</span>
        <span class="motivo">{{ item.motivoRechazo || 'Sin motivo registrado' }}</span>
      </div>
      <div class="acc">
        <button class="btn btn-sm" @click="emit('abrir', item)">Ver</button>
        <button class="btn btn-primary btn-sm" @click="emit('corregir', item)">Corregir</button>
      </div>
    </div>

    <button v-if="resto" class="mas" @click="emit('verTodas')">y {{ resto }} más</button>
  </section>
</template>

<style scoped>
.banner {
  padding: 13px 15px; border-radius: var(--r-md); margin-bottom: 18px;
  background: color-mix(in srgb, var(--u-critico) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--u-critico) 25%, transparent);
}
.b-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: var(--u-critico); font-size: 13px; }
.fila { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; background: var(--surface); border-radius: var(--r-sm); padding: 10px 12px; margin-bottom: 7px; }
.txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tit { font-size: 13px; font-weight: 600; color: var(--ink); }
.motivo { font-size: 12px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.acc { display: flex; gap: 7px; flex-shrink: 0; }
.mas { background: none; border: none; color: var(--u-critico); font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 2px; }
</style>
