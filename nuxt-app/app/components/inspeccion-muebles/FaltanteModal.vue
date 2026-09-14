<script setup lang="ts">
// Reportar un PLU faltante. NO bloquea la orden: la inspeccion sigue con los
// demas PLU y el faltante se va a la cola de picking, que la reparte un
// supervisor. Encadenarlos dejaria al inspector esperando a alguien que esta en
// otra parte del CEDI.
import { ref, watch } from 'vue'

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { plu: string; unidades: number; observacion: string }): void
}>()

const plu = ref('')
const unidades = ref<number | null>(null)
const observacion = ref('')

watch(() => props.abierto, (a) => {
  if (a) { plu.value = ''; unidades.value = null; observacion.value = '' }
})
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">Reportar faltante</h3>
      <p class="m-desc">Va a la cola de picking. La orden sigue inspeccionándose.</p>

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

      <label class="campo">
        <span class="campo-label">Observación</span>
        <textarea v-model="observacion" class="input" rows="2" placeholder="Opcional" />
      </label>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button
          class="btn btn-primary" :disabled="!plu.trim() || !unidades || unidades < 1"
          @click="emit('confirmar', { plu: plu.trim(), unidades: Number(unidades), observacion: observacion.trim() })"
        >
          Reportar
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
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.fila { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.campo { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
.campo.corto { flex: 0 0 110px; }
.campo-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.input { width: 100%; font-size: 14px; padding: 10px 12px; }
textarea.input { resize: vertical; }
</style>
