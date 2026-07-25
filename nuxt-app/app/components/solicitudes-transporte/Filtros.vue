<script setup lang="ts">
// Los filtros se aplican en caliente (búsqueda con debounce). La versión React
// obligaba a pulsar Enter para buscar; el patrón del resto de módulos Nuxt es
// aplicar solo. Semáforo, prioridad y área ya los soportaba la API y la UI no los
// exponía.
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, X } from '@lucide/vue'
import {
  ESTADO_LABEL, ESTADO_OPTIONS, PRIORIDAD_LABEL, PRIORIDAD_OPTIONS,
  SEMAFORO_LABEL, SEMAFORO_OPTIONS,
} from '~/utils/solicitudesTransporte'

const props = defineProps<{
  q: string
  estado: string
  semaforo: string
  prioridad: string
  area: string
  areas: string[]
  isGestor: boolean
}>()
const emit = defineEmits<{
  (e: 'update:q', v: string): void
  (e: 'update:estado', v: string): void
  (e: 'update:semaforo', v: string): void
  (e: 'update:prioridad', v: string): void
  (e: 'update:area', v: string): void
  (e: 'clear'): void
}>()

const localQ = ref(props.q)
watch(() => props.q, (v) => { if (v !== localQ.value) localQ.value = v })

const emitQ = useDebounceFn((v: string) => emit('update:q', v), 300)
function onQInput() { void emitQ(localQ.value) }
function clearQ() { localQ.value = ''; emit('update:q', '') }

const hasFilters = computed(() =>
  !!(props.q || props.estado || props.semaforo || props.prioridad || props.area))
</script>

<template>
  <div class="filtros">
    <div class="search-wrap">
      <Search :size="14" class="search-ic" />
      <input v-model="localQ" class="field" placeholder="Buscar solicitante, pedido, ciudad, guía…" @input="onQInput">
      <button v-if="localQ" class="search-clear" aria-label="Borrar búsqueda" @click="clearQ"><X :size="14" /></button>
    </div>

    <select class="field sel" :value="estado" @change="emit('update:estado', ($event.target as HTMLSelectElement).value)">
      <option value="">Todos los estados</option>
      <option v-for="e in ESTADO_OPTIONS" :key="e" :value="e">{{ ESTADO_LABEL[e] }}</option>
    </select>

    <select class="field sel" :value="semaforo" @change="emit('update:semaforo', ($event.target as HTMLSelectElement).value)">
      <option value="">Todo el semáforo</option>
      <option v-for="s in SEMAFORO_OPTIONS" :key="s" :value="s">{{ SEMAFORO_LABEL[s] }}</option>
    </select>

    <select class="field sel" :value="prioridad" @change="emit('update:prioridad', ($event.target as HTMLSelectElement).value)">
      <option value="">Toda prioridad</option>
      <option v-for="p in PRIORIDAD_OPTIONS" :key="p" :value="p">{{ PRIORIDAD_LABEL[p] }}</option>
    </select>

    <!-- Filtrar por área solo tiene sentido para quien ve solicitudes de varias -->
    <select
      v-if="isGestor" class="field sel" :value="area"
      @change="emit('update:area', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">Todas las áreas</option>
      <option v-for="a in areas" :key="a" :value="a">{{ a }}</option>
    </select>

    <button v-if="hasFilters" class="btn-link" @click="emit('clear')">Limpiar</button>
  </div>
</template>

<style scoped>
.filtros { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
.search-wrap { position: relative; flex: 1 1 240px; min-width: 180px; }
.search-wrap .field { padding-left: 32px; padding-right: 32px; width: 100%; }
.search-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; display: grid; place-items: center; border: none; background: none; color: var(--muted); cursor: pointer; border-radius: var(--r-xs); }
.search-clear:hover { background: var(--surface-3); }
.sel { width: auto; }
.btn-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 8px 10px; }
.btn-link:hover { color: var(--ink-2); }
@media (max-width: 700px) { .sel { flex: 1 1 140px; width: auto; } }
</style>
