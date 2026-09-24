<script setup lang="ts">
// Orden SIN CREAR (24-09): una OVDM/TSDM que se pickeó en el CEDI pero el
// operario de picking no registró. La crea el inspector a nombre de quien la
// pickeó: sus PLU le cuentan y se ve cuántas deja sin registrar. Sin tiempo de
// picking (no se midió).
import { computed, ref, watch } from 'vue'
import { FilePlus2 } from '@lucide/vue'
import { normalizarCodigoOrden, validarCodigoOrdenTienda } from '~/utils/muebles'

const props = defineProps<{
  abierto: boolean
  operarios: Array<{ id: string; nombre: string }>
  /** Quién la crea (se eligió antes, en su propia ventana). */
  inspector: string | null
}>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { orden: string; operarioId: string; cliente: string }): void
}>()

const orden = ref('')
const operarioId = ref('')
const cliente = ref('')

watch(() => props.abierto, (a) => {
  if (!a) return
  orden.value = ''; operarioId.value = ''; cliente.value = ''
})

// Misma regla que la orden de tienda: OVDM o TSDM con su número.
const errorOrden = computed(() => (orden.value.trim() ? validarCodigoOrdenTienda(orden.value) : null))
const puede = computed(() => !!orden.value.trim() && !errorOrden.value && !!operarioId.value)

function confirmar() {
  if (!puede.value) return
  emit('confirmar', { orden: normalizarCodigoOrden(orden.value), operarioId: operarioId.value, cliente: cliente.value.trim() })
}
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sincrear-titulo">
      <h3 id="sincrear-titulo" class="m-titulo"><FilePlus2 :size="16" /> Orden sin crear</h3>
      <p class="m-desc">
        Orden que se pickeó pero el operario no registró en Picking Muebles. Queda a nombre de quien la pickeó,
        sin tiempo de picking.
      </p>
      <p v-if="inspector" class="m-quien">La crea: <strong>{{ inspector }}</strong></p>

      <label class="campo">
        <span class="campo-label">Orden de NetSuite</span>
        <input
          v-model="orden" class="input mono" type="text" autocomplete="off" autocapitalize="characters"
          autofocus placeholder="OVDM121831"
        >
        <span v-if="errorOrden" class="campo-error">{{ errorOrden }}</span>
      </label>

      <label class="campo">
        <span class="campo-label">Operario que la pickeó</span>
        <select v-model="operarioId" class="input">
          <option value="" disabled>Elige el operario</option>
          <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
      </label>

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
.m-desc { margin: 0 0 10px; font-size: 12.5px; color: var(--muted); }
.m-quien { margin: 0 0 14px; font-size: 13px; color: var(--ink-2); }
.campo { display: block; margin-bottom: 12px; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.campo-error { display: block; margin-top: 4px; font-size: 12px; color: var(--u-aviso); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
@media (max-width: 480px) { .m-pie, .m-pie .btn { width: 100%; } .m-pie .btn { justify-content: center; } }
</style>
