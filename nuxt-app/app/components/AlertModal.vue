<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

withDefaults(defineProps<{
  title?: string
  items: string[]
}>(), {
  title: 'Campos obligatorios',
})
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <ModalShell :title="title" @close="emit('close')">
    <div class="alert-body">
      <span class="alert-ic"><TriangleAlert :size="20" /></span>
      <div>
        <p class="alert-msg">Completa los siguientes campos antes de continuar:</p>
        <ul class="alert-list">
          <li v-for="it in items" :key="it">{{ it }}</li>
        </ul>
      </div>
    </div>
    <div class="alert-actions">
      <button type="button" class="btn btn-primary" @click="emit('close')">OK</button>
    </div>
  </ModalShell>
</template>

<style scoped>
.alert-body { display: flex; gap: 13px; align-items: flex-start; padding-bottom: 4px; }
.alert-ic { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: var(--u-aviso-tint); color: var(--u-aviso); }
.alert-msg { font-size: 13.5px; color: var(--ink-2); line-height: 1.5; margin: 6px 0 8px; }
.alert-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--ink); font-weight: 600; }
.alert-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
.alert-actions .btn { min-width: 120px; justify-content: center; }
</style>
