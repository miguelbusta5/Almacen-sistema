<script setup lang="ts">
// Marcar un PLU como averiado y pedir la reposicion.
//
// El inspector elige en el acto al operario de picking que va a traer el
// repuesto: dejarlo en una cola sin dueño obliga a esperar a que alguien lo
// reparta, y el mueble averiado es justo lo que tiene parada la orden.
import { ref, watch } from 'vue'
import type { Linea } from '~/utils/muebles'

const props = defineProps<{
  linea: Linea | null
  operarios: Array<{ id: string; nombre: string }>
}>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { motivo: string; operarioId: string; unidades: number }): void
}>()

const motivo = ref('')
const operarioId = ref('')
const unidades = ref<number | null>(null)

watch(() => props.linea, (l) => {
  if (l) { motivo.value = ''; operarioId.value = ''; unidades.value = Math.max(1, l.unidades) }
})
</script>

<template>
  <div v-if="linea" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">PLU averiado</h3>
      <p class="m-desc">
        <strong>{{ linea.plu }}</strong>{{ linea.descripcion ? ` · ${linea.descripcion}` : '' }}.
        Picking trae el repuesto y tú lo vuelves a inspeccionar. La orden no se cierra hasta entonces.
      </p>

      <label class="campo">
        <span class="campo-label">¿Qué tiene?</span>
        <textarea v-model="motivo" class="input" rows="2" autofocus placeholder="Rayado, golpeado, pata rota…" />
      </label>

      <div class="fila">
        <label class="campo">
          <span class="campo-label">Se lo pido a</span>
          <select v-model="operarioId" class="input">
            <option value="">Elige un operario</option>
            <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          </select>
        </label>
        <label class="campo corto">
          <span class="campo-label">Unidades</span>
          <input v-model.number="unidades" class="input" type="number" min="1">
        </label>
      </div>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button
          class="btn btn-primary" :disabled="!motivo.trim() || !operarioId || !unidades || unidades < 1"
          @click="emit('confirmar', { motivo: motivo.trim(), operarioId, unidades: Number(unidades) })"
        >
          Marcar y pedir reposición
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 440px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
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
