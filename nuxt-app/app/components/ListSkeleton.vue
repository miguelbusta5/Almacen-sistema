<script setup lang="ts">
defineProps<{ rows?: number }>()
</script>

<template>
  <div class="panel card">
    <div class="sk-head">
      <span v-for="i in 6" :key="i" class="sk-line" style="width: 60px" />
    </div>
    <div v-for="r in (rows ?? 7)" :key="r" class="sk-row" :style="{ '--d': `${r * 55}ms` }">
      <span class="sk-pill" />
      <span class="sk-line" style="width: 70%" />
      <span class="sk-line" style="width: 55%" />
      <span class="sk-line" style="width: 65%" />
      <span class="sk-bar" />
      <span class="sk-badge" />
    </div>
  </div>
</template>

<style scoped>
.panel { overflow: hidden; }
.sk-head { display: grid; grid-template-columns: 20% 19% 14% 16% 19% 12%; gap: 0; padding: 14px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.sk-row { display: grid; grid-template-columns: 20% 19% 14% 16% 19% 12%; align-items: center; gap: 0; padding: 16px; border-bottom: 1px solid var(--border); animation: skFade .4s both; animation-delay: var(--d); }
.sk-row:last-child { border-bottom: none; }
@keyframes skFade { from { opacity: 0; transform: translateY(6px); } }
.sk-line, .sk-pill, .sk-bar, .sk-badge { position: relative; overflow: hidden; border-radius: 6px; background: var(--surface-3); height: 12px; }
.sk-pill { width: 120px; height: 30px; border-radius: 999px; }
.sk-bar { width: 110px; height: 10px; }
.sk-badge { width: 66px; height: 22px; border-radius: 999px; }
.sk-line::after, .sk-pill::after, .sk-bar::after, .sk-badge::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent);
  transform: translateX(-100%); animation: shimmer 1.3s infinite;
}
</style>
