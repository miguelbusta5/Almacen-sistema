<script setup lang="ts">
// Ciudad de envio de la orden. Se pide al empezar a inspeccionar porque es lo
// que despues usa el patinador para agrupar las entregas a transporte.
//
// Se escribe a mano, pero la lista de abajo sugiere las que ya se han usado y el
// servidor la guarda normalizada: asi "medellin" y "MEDELLÍN" no se vuelven dos
// ciudades distintas.
import { ref, watch } from 'vue'

const props = defineProps<{
  abierto: boolean
  actual?: string | null
  sugeridas?: string[]
}>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', ciudad: string): void
}>()

const ciudad = ref('')
watch(() => props.abierto, (a) => { if (a) ciudad.value = props.actual ?? '' })
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">¿A qué ciudad va esta orden?</h3>
      <p class="m-desc">Es con lo que el patinador agrupa las entregas a transporte.</p>

      <label class="campo">
        <span class="campo-label">Ciudad</span>
        <input
          v-model="ciudad" class="input" type="text" autocomplete="off" autofocus
          list="ciudades-muebles" placeholder="Medellín, Bogotá…"
          @keyup.enter="ciudad.trim() && emit('confirmar', ciudad.trim())"
        >
        <datalist id="ciudades-muebles">
          <option v-for="c in sugeridas ?? []" :key="c" :value="c" />
        </datalist>
      </label>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="ciudad.trim().length < 3" @click="emit('confirmar', ciudad.trim())">
          Guardar ciudad
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
