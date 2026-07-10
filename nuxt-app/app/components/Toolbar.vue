<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, X, TriangleAlert, Rows3, Rows4 } from '@lucide/vue'

const props = defineProps<{
  q: string; estado: string; tipo: string; alerta: boolean
  count: number; total: number; density: 'comodo' | 'compacto'
}>()
const emit = defineEmits<{
  (e: 'update:q', v: string): void
  (e: 'update:estado', v: string): void
  (e: 'update:tipo', v: string): void
  (e: 'update:alerta', v: boolean): void
  (e: 'update:density', v: 'comodo' | 'compacto'): void
  (e: 'clear'): void
}>()

// El input refleja cada tecla al instante (localQ); el filtrado del padre
// (que recorre hasta 500 filas) solo recibe el valor 250ms después de la
// última tecla, evitando recalcular el listado en cada pulsación.
const localQ = ref(props.q)
watch(() => props.q, (v) => { if (v !== localQ.value) localQ.value = v })
const emitQ = useDebounceFn((v: string) => emit('update:q', v), 250)
function onInput(e: Event) {
  localQ.value = (e.target as HTMLInputElement).value
  emitQ(localQ.value)
}
// La X del input: borra SOLO la búsqueda (a diferencia de "Limpiar", que
// resetea todos los filtros) y emite directo, sin el debounce, para que
// la lista reaccione al instante.
function clearQ() {
  localQ.value = ''
  emit('update:q', '')
}
</script>

<template>
  <div class="toolbar">
    <div class="search">
      <Search :size="16" class="search-ic" />
      <input
        :value="localQ" @input="onInput"
        class="field" placeholder="Buscar documento o ubicación…"
      >
      <button v-if="localQ" class="clr" aria-label="Borrar búsqueda" @click="clearQ"><X :size="14" /></button>
    </div>
    <select :value="estado" @change="emit('update:estado', ($event.target as HTMLSelectElement).value)" class="field sel">
      <option value="">Todos los estados</option>
      <option value="PENDIENTE DESPACHO">Pendiente despacho</option>
      <option value="DESPACHADO">Despachado</option>
    </select>
    <select :value="tipo" @change="emit('update:tipo', ($event.target as HTMLSelectElement).value)" class="field sel">
      <option value="">Todos los tipos</option>
      <option value="COMUN">Común</option>
      <option value="ECOMMERCE">Ecommerce</option>
    </select>
    <button class="btn btn-sm" :class="{ on: alerta }" @click="emit('update:alerta', !alerta)">
      <TriangleAlert :size="14" /> Solo alertas
    </button>
    <button v-if="localQ || estado || tipo || alerta" class="btn btn-ghost btn-sm" @click="localQ = ''; emit('clear')">
      <X :size="13" /> Limpiar
    </button>

    <div class="right">
      <span class="count mono">{{ count }} de {{ total }}</span>
      <div class="density" role="group" aria-label="Densidad">
        <button class="dbtn" :class="{ on: density === 'comodo' }" title="Cómodo" @click="emit('update:density', 'comodo')"><Rows3 :size="15" /></button>
        <button class="dbtn" :class="{ on: density === 'compacto' }" title="Compacto" @click="emit('update:density', 'compacto')"><Rows4 :size="15" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md);
  background: var(--surface); box-shadow: var(--shadow-xs);
}
.search { position: relative; flex: 1; min-width: 220px; }
.search .search-ic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; }
.search .field { padding-left: 38px; padding-right: 34px; }
.search:focus-within .search-ic { color: var(--brand); }
.clr {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  display: grid; place-items: center; width: 26px; height: 26px;
  border: none; background: transparent; border-radius: var(--r-xs);
  color: var(--faint); cursor: pointer; transition: color .12s, background .12s;
}
.clr:hover { color: var(--ink-2); background: var(--surface-3); }
.sel { width: auto; min-width: 150px; cursor: pointer; }
.btn.on { color: var(--u-critico); border-color: var(--u-critico); background: var(--u-critico-tint); }
.right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.count { font-size: 12px; color: var(--muted); white-space: nowrap; }
.density { display: inline-flex; padding: 3px; gap: 2px; background: var(--surface-3); border-radius: var(--r-sm); }
.dbtn { display: grid; place-items: center; width: 30px; height: 28px; border: none; background: transparent; border-radius: var(--r-xs); color: var(--muted); cursor: pointer; transition: background .12s, color .12s; }
.dbtn:hover { color: var(--ink-2); }
.dbtn.on { background: var(--surface); color: var(--brand-deep); box-shadow: var(--shadow-xs); }
</style>
