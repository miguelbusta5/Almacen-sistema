<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { ESTADO_LABEL } from '~/utils/despacho'

defineProps<{ q: string; estado: string; count: number; total: number }>()
const emit = defineEmits<{
  (e: 'update:q', v: string): void
  (e: 'update:estado', v: string): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="toolbar">
    <div class="search">
      <Search :size="16" />
      <input :value="q" @input="emit('update:q', ($event.target as HTMLInputElement).value)" class="field" placeholder="Buscar documento o cliente…">
    </div>
    <select :value="estado" @change="emit('update:estado', ($event.target as HTMLSelectElement).value)" class="field sel">
      <option value="">Todos los estados</option>
      <option v-for="(label, key) in ESTADO_LABEL" :key="key" :value="key">{{ label }}</option>
    </select>
    <button v-if="q || estado" class="btn btn-ghost btn-sm" @click="emit('clear')"><X :size="13" /> Limpiar</button>
    <div class="right"><span class="count mono">{{ count }} de {{ total }}</span></div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); box-shadow: var(--shadow-xs); }
.search { position: relative; flex: 1; min-width: 220px; }
.search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; }
.search .field { padding-left: 38px; }
.search:focus-within svg { color: var(--brand); }
.sel { width: auto; min-width: 170px; cursor: pointer; }
.right { margin-left: auto; }
.count { font-size: 12px; color: var(--muted); white-space: nowrap; }
</style>
