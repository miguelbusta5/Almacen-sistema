<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, X } from '@lucide/vue'
import { labelAccion, labelModulo, type LogUser } from '~/utils/auditoria'

const props = defineProps<{
  q: string
  modulo: string
  accion: string
  userId: string
  from: string
  to: string
  modulos: string[]
  acciones: string[]
  users: LogUser[]
}>()
const emit = defineEmits<{
  (e: 'update:q', v: string): void
  (e: 'update:modulo', v: string): void
  (e: 'update:accion', v: string): void
  (e: 'update:userId', v: string): void
  (e: 'update:from', v: string): void
  (e: 'update:to', v: string): void
  (e: 'clear'): void
}>()

const localQ = ref(props.q)
watch(() => props.q, (v) => { if (v !== localQ.value) localQ.value = v })
const emitQ = useDebounceFn((v: string) => emit('update:q', v), 300)

const hasFilters = computed(() =>
  !!(props.q || props.modulo || props.accion || props.userId || props.from || props.to))
</script>

<template>
  <div class="filtros">
    <div class="search-wrap">
      <Search :size="14" class="search-ic" />
      <input v-model="localQ" class="field" placeholder="Buscar en detalle o id de registro…" @input="emitQ(localQ)">
      <button v-if="localQ" class="search-clear" aria-label="Borrar búsqueda" @click="localQ = ''; emit('update:q', '')">
        <X :size="14" />
      </button>
    </div>

    <!-- Opciones derivadas de los datos: la tabla tiene módulos históricos
         (muebles, logistica, conteo) que ya no existen como módulo vivo. -->
    <select class="field sel" :value="modulo" @change="emit('update:modulo', ($event.target as HTMLSelectElement).value)">
      <option value="">Todos los módulos</option>
      <option v-for="m in modulos" :key="m" :value="m">{{ labelModulo(m) }}</option>
    </select>

    <select class="field sel" :value="accion" @change="emit('update:accion', ($event.target as HTMLSelectElement).value)">
      <option value="">Todas las acciones</option>
      <option v-for="a in acciones" :key="a" :value="a">{{ labelAccion(a) }}</option>
    </select>

    <select class="field sel" :value="userId" @change="emit('update:userId', ($event.target as HTMLSelectElement).value)">
      <option value="">Todos los usuarios</option>
      <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
    </select>

    <label class="rango">
      <span>Desde</span>
      <input class="field fecha" type="date" :value="from" @change="emit('update:from', ($event.target as HTMLInputElement).value)">
    </label>
    <label class="rango">
      <span>Hasta</span>
      <input class="field fecha" type="date" :value="to" @change="emit('update:to', ($event.target as HTMLInputElement).value)">
    </label>

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
.rango { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.fecha { width: auto; }
.btn-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 8px 10px; }
.btn-link:hover { color: var(--ink-2); }
@media (max-width: 700px) { .sel, .fecha { flex: 1 1 130px; width: auto; } }
</style>
