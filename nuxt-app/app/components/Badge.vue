<script setup lang="ts">
defineProps<{ label: string; tone?: string; solid?: boolean }>()
</script>

<template>
  <span class="badge" :class="{ solid }" :style="{ '--c': tone || 'var(--muted)' }">
    <slot />{{ label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  height: 22px; padding: 0 9px;
  border-radius: var(--r-pill);
  font-size: 11px; font-weight: 700; white-space: nowrap;
  color: color-mix(in srgb, var(--c) 74%, var(--ink));
  background: color-mix(in srgb, var(--c) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 24%, transparent);
  animation: badgePop .24s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes badgePop { 0% { transform: scale(.8); opacity: 0; } 60% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }
.badge.solid { background: var(--c); color: white; border-color: transparent; }
</style>
