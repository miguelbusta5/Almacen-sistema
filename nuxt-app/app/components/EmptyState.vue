<script setup lang="ts">
defineProps<{ icon?: string; title: string; description: string }>()
</script>

<template>
  <div class="empty">
    <div class="empty-ic"><span v-if="icon" v-html="icon" /><slot name="icon" /></div>
    <div class="empty-title">{{ title }}</div>
    <div class="empty-desc">{{ description }}</div>
  </div>
</template>

<style scoped>
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center; }
.empty-ic { width: 44px; height: 44px; border-radius: 12px; background: var(--surface-3); display: grid; place-items: center; color: var(--muted); margin-bottom: 14px; }
.empty-title { font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
.empty-desc { font-size: 13px; color: var(--muted); max-width: 280px; }
</style>
