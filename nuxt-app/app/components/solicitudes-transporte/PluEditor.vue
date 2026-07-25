<script setup lang="ts">
// Filas dinámicas de PLU con autocompletado desde el maestro.
import { Plus, Minus } from '@lucide/vue'
import { emptyPlu, type PluRow } from '~/utils/solicitudesTransporte'

const props = defineProps<{ modelValue: PluRow[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: PluRow[]): void }>()

function patch(i: number, campo: keyof PluRow, valor: string | number) {
  const next = props.modelValue.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p))
  emit('update:modelValue', next)
}
function agregar() { emit('update:modelValue', [...props.modelValue, emptyPlu()]) }
function quitar(i: number) { emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i)) }

// Solo rellena si la descripción está VACÍA: la versión React la pisaba siempre y
// machacaba lo que el usuario hubiera escrito a mano.
async function autocompletar(i: number) {
  const fila = props.modelValue[i]
  const plu = fila?.plu.trim()
  if (!plu || fila?.descripcion.trim()) return
  try {
    const res = await $fetch<{ data?: { descripcion?: string } }>(`/api/productos-maestro/${encodeURIComponent(plu)}`)
    const d = res?.data?.descripcion?.trim()
    if (d) patch(i, 'descripcion', d)
  } catch { /* PLU no está en el maestro: se escribe a mano */ }
}
</script>

<template>
  <div class="plus">
    <header class="head">
      <span class="lbl">PLUs</span>
      <button type="button" class="btn btn-sm" @click="agregar"><Plus :size="13" /> Añadir PLU</button>
    </header>

    <div v-for="(p, i) in modelValue" :key="i" class="fila">
      <input
        class="field mono" placeholder="PLU" :value="p.plu"
        @input="patch(i, 'plu', ($event.target as HTMLInputElement).value)"
        @blur="autocompletar(i)"
      >
      <input
        class="field" placeholder="Descripción" :value="p.descripcion"
        @input="patch(i, 'descripcion', ($event.target as HTMLInputElement).value)"
      >
      <input
        class="field tnum" type="number" min="1" placeholder="Unid." :value="p.unidades"
        @input="patch(i, 'unidades', Math.max(1, Number(($event.target as HTMLInputElement).value) || 1))"
      >
      <button
        type="button" class="quitar" :disabled="modelValue.length === 1"
        aria-label="Quitar PLU" @click="quitar(i)"
      >
        <Minus :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.plus { display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.fila { display: grid; grid-template-columns: 120px 1fr 92px 34px; gap: 8px; align-items: center; }
.quitar { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border); background: var(--surface); color: var(--muted); border-radius: var(--r-xs); cursor: pointer; }
.quitar:hover:not(:disabled) { color: var(--u-critico); border-color: color-mix(in srgb, var(--u-critico) 40%, transparent); }
.quitar:disabled { opacity: .4; cursor: not-allowed; }
@media (max-width: 640px) { .fila { grid-template-columns: 1fr 1fr 34px; } .fila .field:nth-child(2) { grid-column: 1 / -1; } }
</style>
