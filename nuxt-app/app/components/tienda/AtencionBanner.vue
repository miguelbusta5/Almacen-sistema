<script setup lang="ts">
import { TriangleAlert, ArrowRight } from '@lucide/vue'
import { ESTADO_LABEL, type Despacho } from '~/utils/despacho'

defineProps<{ items: Despacho[] }>()
const emit = defineEmits<{ (e: 'open', d: Despacho): void }>()
</script>

<template>
  <section v-if="items.length" class="banner">
    <div class="head">
      <span class="ic"><TriangleAlert :size="16" /></span>
      <div>
        <div class="title">Facturas que requieren atención</div>
        <div class="sub">{{ items.length }} con novedad o rechazada(s) — necesitan una acción</div>
      </div>
    </div>
    <div class="list">
      <button v-for="d in items" :key="d.id" class="row" @click="emit('open', d)">
        <div class="info">
          <div class="doc"><span class="mono">{{ d.numeroDocumento }}</span> · {{ d.clienteNombre }}</div>
          <div class="meta">{{ ESTADO_LABEL[d.estado] }}<template v-if="d.motivoRechazo"> · {{ d.motivoRechazo }}</template><template v-if="d.novedad"> · {{ d.novedad }}</template></div>
        </div>
        <span class="go"><ArrowRight :size="14" /></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.banner {
  border: 1px solid color-mix(in srgb, var(--u-critico) 26%, var(--border));
  border-radius: var(--r-md);
  background: linear-gradient(180deg, var(--u-critico-tint), var(--surface) 60%);
  padding: 16px; box-shadow: var(--shadow-xs);
}
.head { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
.ic { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid color-mix(in srgb, var(--u-critico) 30%, var(--border)); display: grid; place-items: center; color: var(--u-critico); transition: transform .3s cubic-bezier(.16,1,.3,1); }
.banner:hover .ic { transform: rotate(-6deg) scale(1.05); }
.title { font-size: 13.5px; font-weight: 700; color: var(--ink); }
.sub { font-size: 12px; color: var(--muted); }
.list { display: flex; flex-direction: column; gap: 8px; }
.row {
  display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
  padding: 11px 13px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm);
  cursor: pointer; transition: border-color .14s, box-shadow .14s, transform .14s;
}
.row:hover { border-color: color-mix(in srgb, var(--u-critico) 40%, var(--border)); box-shadow: var(--shadow-xs); transform: translateY(-1px); }
.info { flex: 1; min-width: 0; }
.doc { font-size: 13px; font-weight: 700; color: var(--ink); }
.meta { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.go { display: inline-flex; color: var(--faint); flex-shrink: 0; transition: transform .14s; }
.row:hover .go { transform: translateX(2px); color: var(--u-critico); }
</style>
