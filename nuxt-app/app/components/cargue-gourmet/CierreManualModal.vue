<script setup lang="ts">
import { ref } from 'vue'
import type { PedidoGourmet } from '~/utils/gourmet'

const props = defineProps<{ p: PedidoGourmet; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', payload: Record<string, unknown>): void }>()

const cantidadContadaManual = ref('')
const error = ref('')

function submit() {
  error.value = ''
  const cantidad = parseInt(cantidadContadaManual.value, 10)
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    error.value = 'La cantidad contada debe ser un entero mayor o igual a 0'
    return
  }
  emit('saved', { cantidadContadaManual: cantidad, updatedAt: props.p.updatedAt })
}
</script>

<template>
  <ModalShell title="Cierre manual de contingencia" sub="Documenta una excepción operativa del cargue" @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <div class="advertencia">
        Este cierre documenta una contingencia operativa. Solo debe usarse cuando el cargue no puede finalizarse normalmente.
        El motivo se registra automáticamente como "TIEMPO".
      </div>

      <label class="fw">
        <span class="fl">Cantidad contada manualmente</span>
        <input v-model="cantidadContadaManual" type="number" min="0" class="field">
      </label>

      <p v-if="error" class="err-msg">{{ error }}</p>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-danger" :disabled="saving">
          <Spinner v-if="saving" />{{ saving ? 'Cerrando…' : 'Cerrar manualmente' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.advertencia { font-size: 13px; color: var(--u-aviso); background: var(--u-aviso-tint); border: 1px solid var(--u-aviso); border-radius: var(--r-sm); padding: 10px 12px; }
.fw { display: flex; flex-direction: column; gap: 5px; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.err-msg { font-size: 12px; color: var(--u-critico); margin: 0; }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
</style>
