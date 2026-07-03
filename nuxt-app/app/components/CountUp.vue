<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  value: number
  format?: (n: number) => string
  duration?: number
}>()

const display = ref(0)
let raf = 0

function animate(to: number) {
  cancelAnimationFrame(raf)
  const from = display.value
  const dur = props.duration ?? 750
  const start = performance.now()
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / dur)
    // easeOutExpo
    const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
    display.value = from + (to - from) * e
    if (t < 1) raf = requestAnimationFrame(tick)
    else display.value = to
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => animate(props.value))
watch(() => props.value, (v) => animate(v))
</script>

<template>
  <span>{{ format ? format(Math.round(display)) : Math.round(display).toLocaleString('es-CO') }}</span>
</template>
