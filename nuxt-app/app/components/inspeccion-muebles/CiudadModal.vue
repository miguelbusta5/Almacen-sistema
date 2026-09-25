<script setup lang="ts">
// A qué TIENDA va la orden (25-09): la ciudad sale del maestro de tiendas, y
// es con lo que después agrupa el patinador las entregas a transporte.
// E-commerce no tiene ciudad en el maestro: ahí se escribe la ciudad destino.
import { ref, watch } from 'vue'
import type { DestinoOrden } from '~/utils/muebles'

const props = defineProps<{
  abierto: boolean
  /** Lo que tiene hoy la orden, para mostrarlo. */
  actual?: string | null
  sugeridas?: string[]
}>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', destino: DestinoOrden): void
}>()

const destino = ref<DestinoOrden | null>(null)
// Cambia al abrir: recrea el buscador para que no arrastre la búsqueda anterior.
const vez = ref(0)
watch(() => props.abierto, (a) => { if (a) { destino.value = null; vez.value++ } })
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">¿A qué tienda va esta orden?</h3>
      <p class="m-desc">
        La ciudad sale de la tienda. Si es E-commerce, escribe la ciudad destino.
      </p>
      <p v-if="actual" class="m-actual">Hoy: <strong>{{ actual }}</strong></p>

      <MueblesDestinoCampo :key="vez" v-model="destino" :sugeridas="sugeridas" />

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!destino" @click="destino && emit('confirmar', destino)">
          Guardar destino
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
.m-actual { margin: -6px 0 12px; font-size: 12.5px; color: var(--ink-2); }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
@media (max-width: 480px) { .m-pie, .m-pie .btn { width: 100%; } .m-pie .btn { justify-content: center; } }
</style>
