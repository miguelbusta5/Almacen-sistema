<script setup lang="ts">
// Una cifra de un proceso con su comparación frente al periodo anterior y, si
// tiene, frente a la meta (el día típico de las 4 semanas anteriores).
defineProps<{
  label: string
  valor: string
  hint?: string
  cambio?: { texto: string; tono: 'bien' | 'mal' | 'igual' } | null
  meta?: string | null
}>()
</script>

<template>
  <div class="cp">
    <span class="cp-label">{{ label }}</span>
    <span class="cp-num tnum">{{ valor }}</span>
    <span v-if="hint" class="cp-hint">{{ hint }}</span>
    <span v-if="cambio" class="cp-cambio" :class="cambio.tono">{{ cambio.texto }}</span>
    <span v-if="meta" class="cp-meta">Meta: {{ meta }}</span>
  </div>
</template>

<style scoped>
.cp { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); min-width: 0; }
.cp-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.cp-num { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
.cp-hint { font-size: 12px; color: var(--muted); }
.cp-cambio { margin-top: 4px; font-size: 11.5px; font-weight: 700; }
.cp-cambio.bien { color: var(--u-ok); }
.cp-cambio.mal { color: var(--u-critico); }
.cp-cambio.igual { color: var(--muted); }
.cp-meta { font-size: 11.5px; color: var(--ink-2); }
</style>
