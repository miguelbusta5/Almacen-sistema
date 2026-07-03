<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps<{ title: string; sub?: string; wide?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => { window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden' })
onUnmounted(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal scale-in" :class="{ wide }">
        <header class="mhead">
          <div>
            <h2>{{ title }}</h2>
            <p v-if="sub" class="msub">{{ sub }}</p>
          </div>
          <button class="close" @click="emit('close')"><X :size="18" /></button>
        </header>
        <div class="mbody"><slot /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(16, 22, 35, .38); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); }
.modal.wide { max-width: 560px; }
.mhead { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 22px 14px; border-bottom: 1px solid var(--border); }
.mhead h2 { font-size: 17px; font-weight: 700; }
.msub { font-size: 12px; color: var(--muted); margin: 3px 0 0; }
.close { background: var(--surface-3); border: none; border-radius: var(--r-xs); padding: 7px; cursor: pointer; color: var(--muted); display: flex; }
.close:hover { background: var(--border-strong); color: var(--ink); }
.mbody { padding: 18px 22px 22px; overflow-y: auto; }
</style>
