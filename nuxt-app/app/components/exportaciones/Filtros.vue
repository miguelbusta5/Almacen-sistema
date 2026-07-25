<script setup lang="ts">
// Los filtros se aplican solos (búsqueda con debounce, selects al instante). La
// versión React obligaba a pulsar "Filtrar"; en Nuxt el patrón ya establecido
// (Toolbar.vue, integracion.vue) es aplicar en caliente.
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, X } from '@lucide/vue'
import type { Operario } from '~/utils/exportaciones'

const props = defineProps<{
  q: string
  fecha: string
  estado: string
  usuarioId: string
  operarios: Operario[]
  canManage: boolean
}>()
const emit = defineEmits<{
  (e: 'update:q', v: string): void
  (e: 'update:fecha', v: string): void
  (e: 'update:estado', v: string): void
  (e: 'update:usuarioId', v: string): void
  (e: 'clear'): void
}>()

const localQ = ref(props.q)
watch(() => props.q, (v) => { if (v !== localQ.value) localQ.value = v })

const emitQ = useDebounceFn((v: string) => emit('update:q', v), 300)
function onQInput() { void emitQ(localQ.value) }
function clearQ() { localQ.value = ''; emit('update:q', '') }

const hasFilters = computed(() => !!(props.q || props.fecha || props.estado || props.usuarioId))
</script>

<template>
  <div class="filtros">
    <div class="search-wrap">
      <Search :size="14" class="search-ic" />
      <input v-model="localQ" class="field" placeholder="Buscar caja, PLU o descripción…" @input="onQInput">
      <button v-if="localQ" class="search-clear" @click="clearQ"><X :size="14" /></button>
    </div>

    <input
      class="field sel" type="date" :value="fecha"
      @change="emit('update:fecha', ($event.target as HTMLInputElement).value)"
    >

    <select class="field sel" :value="estado" @change="emit('update:estado', ($event.target as HTMLSelectElement).value)">
      <option value="">Todos los estados</option>
      <option value="en-curso">En curso</option>
      <option value="finalizado">Finalizado</option>
    </select>

    <select
      v-if="canManage" class="field sel" :value="usuarioId"
      @change="emit('update:usuarioId', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">Todos los operarios</option>
      <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
    </select>

    <button v-if="hasFilters" class="btn-link" @click="emit('clear')">Limpiar</button>
  </div>
</template>

<style scoped>
.filtros { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
.search-wrap { position: relative; flex: 1 1 220px; min-width: 170px; }
.search-wrap .field { padding-left: 32px; padding-right: 32px; width: 100%; }
.search-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; display: grid; place-items: center; border: none; background: none; color: var(--muted); cursor: pointer; border-radius: var(--r-xs); }
.search-clear:hover { background: var(--surface-3); }
.sel { width: auto; }
.btn-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 8px 10px; }
.btn-link:hover { color: var(--ink-2); }
@media (max-width: 700px) { .sel { flex: 1 1 140px; width: auto; } }
</style>
