<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

withDefaults(defineProps<{
  title: string
  message: string
  confirmLabel?: string
  confirmingLabel?: string
  danger?: boolean
  confirming?: boolean
}>(), {
  confirmLabel: 'Confirmar',
  confirmingLabel: 'Procesando…',
  danger: true,
  confirming: false,
})
const emit = defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>()
</script>

<template>
  <ModalShell :title="title" @close="() => !confirming && emit('close')">
    <div class="confirm-body">
      <span class="confirm-ic" :class="{ danger }"><TriangleAlert :size="20" /></span>
      <p class="confirm-msg">{{ message }}</p>
    </div>
    <div class="confirm-actions">
      <button type="button" class="btn" :disabled="confirming" @click="emit('close')">Cancelar</button>
      <button type="button" class="btn" :class="danger ? 'btn-danger' : 'btn-primary'" :disabled="confirming" @click="emit('confirm')">
        <Spinner v-if="confirming" />{{ confirming ? confirmingLabel : confirmLabel }}
      </button>
    </div>
  </ModalShell>
</template>

<style scoped>
.confirm-body { display: flex; gap: 13px; align-items: flex-start; padding-bottom: 4px; }
.confirm-ic { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: var(--u-critico-tint); color: var(--u-critico); }
.confirm-ic:not(.danger) { background: var(--u-aviso-tint); color: var(--u-aviso); }
.confirm-msg { font-size: 13.5px; color: var(--ink-2); line-height: 1.55; margin: 6px 0 0; }
.confirm-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-top: 16px; }
.confirm-actions .btn { justify-content: center; }
</style>
