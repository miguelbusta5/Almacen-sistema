<script setup lang="ts">
import { PackageCheck, Truck } from '@lucide/vue'
import type { PendienteTienda } from '~/utils/sampleData'

defineProps<{ items: PendienteTienda[]; busy?: string | null }>()
const emit = defineEmits<{ (e: 'registrar', p: PendienteTienda): void }>()
</script>

<template>
  <section v-if="items.length" class="banner">
    <div class="head">
      <span class="ic"><Truck :size="16" /></span>
      <div>
        <div class="title">Despachos de tienda pendientes por guardar</div>
        <div class="sub">{{ items.length }} pendiente(s) asignado(s) a bodega</div>
      </div>
    </div>
    <div class="list">
      <div v-for="p in items" :key="p.id" class="row">
        <div class="info">
          <div class="doc"><span class="mono">{{ p.numeroDocumento }}</span> · {{ p.clienteNombre }}</div>
          <div class="meta">{{ p.centroCostos }}<template v-if="p.numeroCajas"> · {{ p.numeroCajas }} cajas</template><template v-if="p.nota"> · {{ p.nota }}</template></div>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="emit('registrar', p)">
          <Spinner v-if="busy === `pendiente:${p.id}`" /><PackageCheck v-else :size="14" />
          {{ busy === `pendiente:${p.id}` ? 'Registrando…' : 'Registrar guardado' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.banner {
  border: 1px solid color-mix(in srgb, var(--brand) 26%, var(--border));
  border-radius: var(--r-md);
  background: linear-gradient(180deg, var(--brand-tint), var(--surface) 60%);
  padding: 16px; box-shadow: var(--shadow-xs);
}
.head { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
.ic { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid color-mix(in srgb, var(--brand) 30%, var(--border)); display: grid; place-items: center; color: var(--brand-deep); }
.title { font-size: 13.5px; font-weight: 700; color: var(--ink); }
.sub { font-size: 12px; color: var(--muted); }
.list { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 12px; padding: 11px 13px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); transition: border-color .14s, box-shadow .14s, transform .14s; }
.row:hover { border-color: color-mix(in srgb, var(--brand) 40%, var(--border)); box-shadow: var(--shadow-xs); transform: translateY(-1px); }
.ic { transition: transform .3s cubic-bezier(.16,1,.3,1); }
.banner:hover .ic { transform: rotate(-6deg) scale(1.05); }
.info { flex: 1; min-width: 0; }
.doc { font-size: 13px; font-weight: 700; color: var(--ink); }
.meta { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
