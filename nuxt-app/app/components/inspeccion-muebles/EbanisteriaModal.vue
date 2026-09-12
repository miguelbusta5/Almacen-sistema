<script setup lang="ts">
// Enviar un PLU a ebanisteria. El motivo es obligatorio: sin el, el tiempo de
// taller es un numero sin causa y no sirve para atacar el problema de raiz.
import { ref, watch } from 'vue'
import type { Linea } from '~/utils/muebles'

const props = defineProps<{ linea: Linea | null }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'confirmar', motivo: string): void }>()

const motivo = ref('')
watch(() => props.linea, () => { motivo.value = '' })
</script>

<template>
  <div v-if="linea" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">Enviar a ebanistería</h3>
      <p class="m-desc">PLU {{ linea.plu }}. Se detiene el tiempo de inspección y arranca el de taller.</p>

      <label class="campo">
        <span class="campo-label">¿Qué tiene?</span>
        <textarea
          v-model="motivo" class="input" rows="3" autofocus
          placeholder="Ej. golpe en la tapa superior, falta tornillería…"
        />
      </label>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="motivo.trim().length < 3" @click="emit('confirmar', motivo.trim())">
          Enviar a ebanistería
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
.campo { display: flex; flex-direction: column; gap: 5px; }
.campo-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.input { width: 100%; font-size: 14px; padding: 10px 12px; resize: vertical; }
</style>
