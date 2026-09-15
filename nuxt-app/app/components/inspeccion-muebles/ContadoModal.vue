<script setup lang="ts">
// Crear una orden de contado: mercancia de tienda que no pasa por picking.
//
// La orden nace directamente en inspeccion con el numero de factura como
// codigo; los PLU se agregan despues, uno a uno, dentro de la orden.
import { ref, watch } from 'vue'

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { factura: string; cliente: string }): void
}>()

const factura = ref('')
const cliente = ref('')

watch(() => props.abierto, (a) => { if (a) { factura.value = ''; cliente.value = '' } })
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">Factura de contado</h3>
      <p class="m-desc">Para inspeccionar productos que llegan de tienda, sin orden de NetSuite.</p>

      <label class="campo">
        <span class="campo-label">Número de factura</span>
        <input v-model="factura" class="input" type="text" autocomplete="off" autofocus placeholder="Ej. 45231">
      </label>
      <label class="campo">
        <span class="campo-label">Cliente (opcional)</span>
        <input v-model="cliente" class="input" type="text" autocomplete="off" placeholder="Nombre del cliente">
      </label>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button
          class="btn btn-primary" :disabled="!factura.trim()"
          @click="emit('confirmar', { factura: factura.trim(), cliente: cliente.trim() })"
        >
          Crear e inspeccionar
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
.campo { display: block; margin-bottom: 12px; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
@media (max-width: 480px) { .m-pie, .m-pie .btn { width: 100%; } .m-pie .btn { justify-content: center; } }
</style>
