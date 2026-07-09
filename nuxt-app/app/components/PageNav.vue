<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps<{ page: number; pages: number }>()
const emit = defineEmits<{ (e: 'update:page', v: number): void }>()

function go(p: number) {
  const clamped = Math.min(props.pages, Math.max(1, p))
  if (clamped !== props.page) emit('update:page', clamped)
}
</script>

<template>
  <div class="pagenav">
    <button class="btn btn-sm" :disabled="page <= 1" @click="go(page - 1)"><ChevronLeft :size="14" /> Anterior</button>
    <span class="pagenav-info mono">Página {{ page }} de {{ pages }}</span>
    <button class="btn btn-sm" :disabled="page >= pages" @click="go(page + 1)">Siguiente <ChevronRight :size="14" /></button>
  </div>
</template>

<style scoped>
.pagenav { display: flex; align-items: center; justify-content: center; gap: 14px; }
.pagenav-info { font-size: 12.5px; color: var(--muted); }
</style>
