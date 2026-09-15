<script setup lang="ts">
// Agregar a la orden un PLU que llego de tienda.
//
// Entra ya pickeado: nadie lo bajo del rack aqui, asi que no lleva tiempo de
// picking. Se inspecciona como cualquier otro.
import { ref, watch } from 'vue'

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { plu: string; unidades: number }): void
}>()

const plu = ref('')
const unidades = ref<number | null>(null)

watch(() => props.abierto, (a) => { if (a) { plu.value = ''; unidades.value = null } })
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">Agregar PLU a la orden</h3>
      <p class="m-desc">Para la mercancía que llega de tienda. Se inspecciona como los demás.</p>

      <div class="fila">
        <label class="campo">
          <span class="campo-label">PLU</span>
          <input v-model="plu" class="input" type="text" autocomplete="off" autofocus placeholder="PLU">
        </label>
        <label class="campo corto">
          <span class="campo-label">Unidades</span>
          <input v-model.number="unidades" class="input" type="number" min="1" placeholder="0">
        </label>
      </div>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button
          class="btn btn-primary" :disabled="!plu.trim() || !unidades || unidades < 1"
          @click="emit('confirmar', { plu: plu.trim(), unidades: Number(unidades) })"
        >
          Agregar
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 420px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-desc { margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
.fila { display: flex; gap: 10px; flex-wrap: wrap; }
.campo { display: block; flex: 1 1 180px; margin-bottom: 12px; }
.campo.corto { flex: 0 0 110px; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
@media (max-width: 480px) { .m-pie, .m-pie .btn { width: 100%; } .m-pie .btn { justify-content: center; } }
</style>
