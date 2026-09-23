<script setup lang="ts">
// Buscador de la tienda de origen sobre el maestro de tiendas (el mismo
// catálogo que usan Tienda y Cargue Gourmet). Lo comparten "Orden de tienda"
// en Inspección y el cambio de tienda en el Historial.
import { ref, watch } from 'vue'
import { Search } from '@lucide/vue'
import type { TiendaOpcion } from '~/utils/muebles'

const props = defineProps<{ modelValue: TiendaOpcion | null; inicial?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: TiendaOpcion | null): void }>()

const busca = ref(props.inicial ?? (props.modelValue ? `${props.modelValue.tienda} · ${props.modelValue.ciudad}` : ''))
const sugerencias = ref<TiendaOpcion[]>([])
const buscando = ref(false)
const buscado = ref(false)
let espera: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (v) => { if (!v && !buscado.value) busca.value = props.inicial ?? '' })

function buscar(valor: string) {
  busca.value = valor
  buscado.value = true
  emit('update:modelValue', null)
  if (espera) clearTimeout(espera)
  if (!valor.trim()) { sugerencias.value = []; return }
  espera = setTimeout(async () => {
    buscando.value = true
    try {
      const res = await $fetch<{ data: TiendaOpcion[] }>('/api/cargue-gourmet/maestro-tiendas', { query: { q: valor.trim() } })
      sugerencias.value = res.data ?? []
    } catch { sugerencias.value = [] }
    finally { buscando.value = false }
  }, 250)
}

function elegir(t: TiendaOpcion) {
  emit('update:modelValue', t)
  busca.value = `${t.tienda} · ${t.ciudad}`
  sugerencias.value = []
  buscado.value = false
}
</script>

<template>
  <div class="tb">
    <div class="tb-campo">
      <Search :size="14" class="tb-ic" />
      <input
        :value="busca" class="tb-input" type="text" autocomplete="off"
        placeholder="Busca por nombre, código o ciudad"
        @input="buscar(($event.target as HTMLInputElement).value)"
      >
    </div>
    <div v-if="buscado && busca && !modelValue && (sugerencias.length || buscando)" class="tb-sug" role="listbox">
      <p v-if="buscando" class="tb-vacio">Buscando…</p>
      <button
        v-for="t in sugerencias" :key="t.codigo" type="button" class="tb-item" role="option"
        @click="elegir(t)"
      >
        <span class="tb-nom">{{ t.tienda }}</span>
        <span class="tb-meta">{{ t.ciudad }} · {{ t.codigo }}</span>
      </button>
    </div>
    <p v-else-if="buscado && busca && !modelValue && !buscando" class="tb-error">Ninguna tienda coincide.</p>
  </div>
</template>

<style scoped>
.tb { position: relative; }
.tb-campo { position: relative; }
.tb-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.tb-input { width: 100%; padding: 9px 11px 9px 30px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.tb-sug { position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 4px); max-height: 220px; overflow: auto; padding: 5px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-sm); box-shadow: var(--shadow-lg, 0 10px 30px rgba(0,0,0,.18)); }
.tb-item { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 7px 9px; border: none; border-radius: var(--r-xs); background: none; text-align: left; cursor: pointer; }
.tb-item:hover { background: var(--surface-3); }
.tb-nom { font-size: 13px; font-weight: 600; color: var(--ink); }
.tb-meta { font-size: 11.5px; color: var(--muted); }
.tb-vacio { margin: 0; padding: 8px; font-size: 12.5px; color: var(--muted); }
.tb-error { margin: 4px 0 0; font-size: 12px; color: var(--u-aviso); }
</style>
