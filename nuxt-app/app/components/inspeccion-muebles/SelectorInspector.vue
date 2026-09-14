<script setup lang="ts">
// Quien eres. Es un desplegable y no un login porque el area comparte una sola
// sesion entre ~5 inspectores (solo hay 2 PCs): lo que se necesita saber es de
// quien es cada tiempo, no quien abrio el navegador.
import { ref, watch } from 'vue'
import type { Inspector } from '~/utils/muebles'

const props = defineProps<{
  abierto: boolean
  inspectores: Inspector[]
  seleccionado: string | null
  titulo?: string
}>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'confirmar', inspectorId: string): void }>()

const elegido = ref<string>('')
watch(() => props.abierto, (a) => { if (a) elegido.value = props.seleccionado ?? '' })
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">{{ titulo || '¿Quién eres?' }}</h3>
      <p class="m-desc">Tu nombre queda en los tiempos de esta orden.</p>

      <select v-model="elegido" class="input">
        <option value="" disabled>Elige tu nombre</option>
        <option v-for="i in inspectores" :key="i.id" :value="i.id">{{ i.nombre }}</option>
      </select>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!elegido" @click="emit('confirmar', elegido)">Continuar</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 380px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-desc { margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.input { width: 100%; font-size: 15px; padding: 10px 12px; }
</style>
