<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps<{ title: string; sub?: string; wide?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const modalEl = ref<HTMLElement | null>(null)
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  if (!modalEl.value) return []
  return Array.from(modalEl.value.querySelectorAll<HTMLElement>(FOCUSABLE))
}

// Foco atrapado: Tab/Shift+Tab ciclan solo entre los elementos del modal,
// para que no se escape al contenido de fondo (que queda inerte visualmente
// pero seguía siendo alcanzable por teclado antes de este fix).
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key !== 'Tab') return
  const els = focusables()
  if (!els.length) return
  const first = els[0]!, last = els[els.length - 1]!
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
}

let previouslyFocused: HTMLElement | null = null
onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  requestAnimationFrame(() => focusables()[0]?.focus())
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  previouslyFocused?.focus?.()
})
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div ref="modalEl" class="modal scale-in" :class="{ wide }" role="dialog" aria-modal="true" :aria-label="title">
        <header class="mhead">
          <div>
            <h2>{{ title }}</h2>
            <p v-if="sub" class="msub">{{ sub }}</p>
          </div>
          <button class="close" @click="emit('close')" aria-label="Cerrar"><X :size="18" /></button>
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
