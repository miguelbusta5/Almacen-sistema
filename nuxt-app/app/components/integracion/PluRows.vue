<script setup lang="ts">
import { Plus, Minus } from '@lucide/vue'
import type { PluRow } from '~/utils/integracion'

const props = defineProps<{ modelValue: PluRow[]; label: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: PluRow[]): void }>()

function update(i: number, patch: Partial<PluRow>) {
  emit('update:modelValue', props.modelValue.map((r, j) => (j === i ? { ...r, ...patch } : r)))
}
function add() { emit('update:modelValue', [...props.modelValue, emptyPlu()]) }
function remove(i: number) {
  if (props.modelValue.length <= 1) return
  emit('update:modelValue', props.modelValue.filter((_, j) => j !== i))
}
</script>

<template>
  <div class="plu-block">
    <div class="plu-head">
      <span class="fl">{{ label }}</span>
      <button type="button" class="plu-add" @click="add"><Plus :size="12" /> Añadir fila</button>
    </div>
    <div class="plu-cols">
      <span>PLU</span><span>Descripción</span><span>Uds</span><span />
    </div>
    <div class="plu-rows">
      <div v-for="(row, i) in modelValue" :key="i" class="plu-row">
        <input :value="row.plu" class="field" placeholder="PLU" @input="update(i, { plu: ($event.target as HTMLInputElement).value })">
        <input :value="row.descripcion" class="field" placeholder="Descripción (opcional)" @input="update(i, { descripcion: ($event.target as HTMLInputElement).value })">
        <input
          :value="row.unidades" type="number" min="1" class="field"
          @input="update(i, { unidades: Math.max(1, parseInt(($event.target as HTMLInputElement).value) || 1) })"
        >
        <button type="button" class="plu-rm" :disabled="modelValue.length <= 1" @click="remove(i)"><Minus :size="13" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plu-block { display: flex; flex-direction: column; gap: 8px; }
.plu-head { display: flex; align-items: center; justify-content: space-between; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.plu-add { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--brand-deep); background: none; border: none; cursor: pointer; padding: 2px 4px; }
.plu-cols { display: grid; grid-template-columns: 110px 1fr 72px 28px; gap: 6px; padding: 0 2px; }
.plu-cols span { font-size: 11px; color: var(--faint); }
.plu-rows { display: flex; flex-direction: column; gap: 6px; }
.plu-row { display: grid; grid-template-columns: 110px 1fr 72px 28px; gap: 6px; align-items: center; }
.plu-rm { width: 28px; height: 28px; border-radius: var(--r-xs); border: none; background: var(--u-critico-tint); color: var(--u-critico); cursor: pointer; display: grid; place-items: center; }
.plu-rm:disabled { opacity: .4; cursor: not-allowed; }
@media (max-width: 560px) { .plu-cols, .plu-row { grid-template-columns: 80px 1fr 56px 28px; } }
</style>
