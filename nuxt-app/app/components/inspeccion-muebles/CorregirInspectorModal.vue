<script setup lang="ts">
// Corregir a nombre de quién quedó un PLU (25-09). Solo supervisión: las PCs se
// comparten y el PLU a veces queda a nombre de otro inspector. Los tiempos no
// cambian, solo de quién son; el motivo queda en auditoría.
import { computed, ref, watch } from 'vue'
import { UserPen } from '@lucide/vue'
import type { Inspector, Linea } from '~/utils/muebles'

const props = defineProps<{
  linea: Linea | null
  inspectores: Inspector[]
  guardando: boolean
}>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { inspectorId: string; motivo: string }): void
}>()

const elegido = ref('')
const motivo = ref('')
watch(() => props.linea, (l) => { if (l) { elegido.value = ''; motivo.value = '' } })

// El que ya tiene no se ofrece: no habría nada que corregir.
const opciones = computed(() => props.inspectores.filter((i) => i.id !== props.linea?.inspector?.id))
const puede = computed(() => !!elegido.value && motivo.value.trim().length >= 5 && !props.guardando)
</script>

<template>
  <div v-if="linea" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ci-titulo">
      <h3 id="ci-titulo" class="m-titulo"><UserPen :size="16" /> Corregir inspector</h3>
      <p class="m-desc">
        PLU <strong>{{ linea.plu }}</strong><template v-if="linea.descripcion"> · {{ linea.descripcion }}</template>.
        Los tiempos no cambian: solo pasan a quien de verdad lo inspeccionó.
      </p>
      <p class="m-actual">Ahora está a nombre de: <strong>{{ linea.inspector?.nombre ?? 'nadie' }}</strong></p>

      <label class="campo">
        <span class="campo-label">Inspector correcto</span>
        <select v-model="elegido" class="input">
          <option value="" disabled>Elige el inspector</option>
          <option v-for="i in opciones" :key="i.id" :value="i.id">{{ i.nombre }}</option>
        </select>
      </label>
      <label class="campo">
        <span class="campo-label">Motivo</span>
        <input
          v-model="motivo" class="input" type="text" maxlength="300" autocomplete="off"
          placeholder="Ej. lo inspeccionó Laura desde la PC de Diego"
        >
      </label>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puede" @click="emit('confirmar', { inspectorId: elegido, motivo: motivo.trim() })">
          Corregir
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 440px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { display: flex; align-items: center; gap: 7px; margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-titulo > svg { color: var(--brand); }
.m-desc { margin: 0 0 8px; font-size: 12.5px; color: var(--muted); }
.m-actual { margin: 0 0 14px; font-size: 13px; color: var(--ink-2); }
.campo { display: block; margin-bottom: 12px; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
@media (max-width: 480px) { .m-pie, .m-pie .btn { width: 100%; } .m-pie .btn { justify-content: center; } }
</style>
