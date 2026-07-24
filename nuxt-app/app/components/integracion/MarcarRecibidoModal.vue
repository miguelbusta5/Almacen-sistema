<script setup lang="ts">
import { ref } from 'vue'
import type { Integracion } from '~/utils/integracion'

const props = defineProps<{ integracion: Integracion }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>()

const observaciones = ref('')
const saving = ref(false)
const error = ref('')

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

async function submit() {
  error.value = ''
  saving.value = true
  try {
    await $fetch(`/api/integracion/${props.integracion.id}` as string, {
      method: 'PUT',
      body: { accion: 'MARCAR_COMPLETADA', observaciones: observaciones.value.trim() || undefined },
    })
    emit('done')
  } catch (e: any) {
    error.value = apiErr(e, 'Error')
    saving.value = false
  }
}
</script>

<template>
  <ModalShell title="Confirmar recepción física" :sub="`${integracion.tipoDocumento} ${integracion.numeroDocumento}`" @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <p class="hint">¿Confirmas que recibiste físicamente el pedido de las dos áreas y está listo para despacho?</p>
      <label class="fw">
        <span class="fl">Observaciones (opcional)</span>
        <textarea v-model="observaciones" rows="2" class="field" placeholder="Ej. Pedido revisado sin novedades" />
      </label>
      <span v-if="error" class="fe">{{ error }}</span>
      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn" style="background: var(--u-ok); color: #fff; border-color: transparent;" :disabled="saving">
          <Spinner v-if="saving" />{{ saving ? 'Guardando…' : 'Confirmar recepción' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.hint { font-size: 14px; color: var(--muted); margin: 0; }
.fw { display: flex; flex-direction: column; gap: 5px; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.fe { font-size: 11px; font-weight: 600; color: var(--u-critico); }
.factions { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; }
.factions .btn { justify-content: center; }
</style>
