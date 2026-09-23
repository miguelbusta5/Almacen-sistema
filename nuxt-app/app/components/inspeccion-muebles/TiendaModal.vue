<script setup lang="ts">
// Crear una orden que llega DE TIENDA: ya tiene su OVDM/TSDM en NetSuite, pero
// la mercancía viene de una tienda y no se pickea en el CEDI.
//
// No es contado: hasta el 23-09 se metía como factura de contado
// ("CONTADO-OVDM121831") porque no había otra opción, y eso mezclaba las dos
// cosas en los indicadores. Nace directamente en inspección, igual que el
// contado, y los PLU se agregan dentro de la orden.
import { computed, ref, watch } from 'vue'
import { Store } from '@lucide/vue'
import { normalizarCodigoOrden, validarCodigoOrdenTienda, type TiendaOpcion } from '~/utils/muebles'

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { orden: string; tiendaCodigo: string; cliente: string }): void
}>()

const orden = ref('')
const cliente = ref('')
const tienda = ref<TiendaOpcion | null>(null)
// Cambia al abrir: recrea el buscador para que no arrastre la búsqueda anterior.
const vez = ref(0)

watch(() => props.abierto, (a) => {
  if (!a) return
  orden.value = ''; cliente.value = ''; tienda.value = null; vez.value++
})

const errorOrden = computed(() => (orden.value.trim() ? validarCodigoOrdenTienda(orden.value) : null))
const puede = computed(() => !!orden.value.trim() && !errorOrden.value && !!tienda.value)

function confirmar() {
  if (!puede.value || !tienda.value) return
  emit('confirmar', { orden: normalizarCodigoOrden(orden.value), tiendaCodigo: tienda.value.codigo, cliente: cliente.value.trim() })
}
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="tienda-titulo">
      <h3 id="tienda-titulo" class="m-titulo"><Store :size="16" /> Orden de tienda</h3>
      <p class="m-desc">
        Mercancía que llega de una tienda con su orden de NetSuite. No pasa por picking: se inspecciona directo.
      </p>

      <label class="campo">
        <span class="campo-label">Orden de NetSuite</span>
        <input
          v-model="orden" class="input mono" type="text" autocomplete="off" autocapitalize="characters"
          autofocus placeholder="OVDM121831"
        >
        <span v-if="errorOrden" class="campo-error">{{ errorOrden }}</span>
      </label>

      <div class="campo">
        <span class="campo-label">Tienda de origen</span>
        <MueblesTiendaBuscador :key="vez" v-model="tienda" />
      </div>

      <label class="campo">
        <span class="campo-label">Cliente (opcional)</span>
        <input v-model="cliente" class="input" type="text" autocomplete="off" placeholder="Nombre del cliente">
      </label>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puede" @click="confirmar">Crear e inspeccionar</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 440px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { display: flex; align-items: center; gap: 7px; margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-titulo > svg { color: var(--brand); }
.m-desc { margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
.campo { display: block; margin-bottom: 12px; position: relative; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.campo-error { display: block; margin-top: 4px; font-size: 12px; color: var(--u-aviso); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
@media (max-width: 480px) { .m-pie, .m-pie .btn { width: 100%; } .m-pie .btn { justify-content: center; } }
</style>
