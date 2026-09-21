<script setup lang="ts">
// Al dar por listo un PLU que viene en varias cajas: ¿estaban todas?
//
// Se pregunta AQUI y no al iniciar porque es al terminar cuando el inspector ya
// las tiene delante. Si falta alguna, el PLU se da por revisado igual (la orden
// no se puede quedar quieta) y lo que falta se va a la cola de picking como un
// faltante, con el numero de cajas que no llegaron.
import { computed, ref, watch } from 'vue'
import { Boxes, X } from '@lucide/vue'
import type { Linea } from '~/utils/muebles'

const props = defineProps<{ linea: Linea | null; partes: number; guardando: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'completas'): void
  (e: 'faltan', datos: { cajas: number; nota: string }): void
}>()

const faltan = ref(false)
const cuantas = ref<number | null>(null)
const nota = ref('')
watch(() => props.linea?.id, () => { faltan.value = false; cuantas.value = null; nota.value = '' })

const maximo = computed(() => Math.max(1, props.partes - 1))
const valido = computed(() => Number.isInteger(cuantas.value) && Number(cuantas.value) >= 1 && Number(cuantas.value) <= maximo.value)
</script>

<template>
  <div v-if="linea" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="alertdialog" aria-modal="true">
      <header class="m-head">
        <span class="ic"><Boxes :size="22" /></span>
        <button class="icono" aria-label="Cancelar" @click="emit('cerrar')"><X :size="16" /></button>
      </header>

      <h3 class="m-titulo">¿Estaban las {{ partes }} cajas?</h3>
      <p class="m-desc">
        <b class="mono">{{ linea.plu }}</b>
        <template v-if="linea.descripcion"> · {{ linea.descripcion }}</template>
      </p>

      <template v-if="!faltan">
        <div class="botones">
          <button class="btn btn-primary btn-grande" :disabled="guardando" @click="emit('completas')">
            Sí, estaban las {{ partes }}
          </button>
          <button class="btn btn-grande" :disabled="guardando" @click="faltan = true">
            Falta alguna
          </button>
        </div>
      </template>

      <template v-else>
        <label class="campo">
          <span class="campo-label">¿Cuántas cajas faltaron?</span>
          <input
            v-model.number="cuantas" class="input" type="number" min="1" :max="maximo"
            autofocus placeholder="0"
          >
        </label>
        <label class="campo">
          <span class="campo-label">Nota (opcional)</span>
          <input v-model="nota" class="input" type="text" maxlength="200" placeholder="Qué caja faltó, dónde se buscó…">
        </label>
        <p class="m-pie">
          El PLU queda revisado y lo que falta se va a la cola de picking como faltante.
        </p>
        <div class="botones">
          <button class="btn btn-primary btn-grande" :disabled="!valido || guardando" @click="emit('faltan', { cajas: Number(cuantas), nota })">
            Reportar faltante y dar por listo
          </button>
          <button class="btn btn-grande" :disabled="guardando" @click="faltan = false">Volver</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.6); }
.modal { width: 100%; max-width: 420px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.25); }
.m-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ic { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; color: var(--brand); background: var(--brand-tint); }
.icono { display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: var(--r-sm); background: transparent; color: var(--muted); cursor: pointer; }
.m-titulo { margin: 0 0 4px; font-size: 19px; font-weight: 800; color: var(--ink); }
.m-desc { margin: 0 0 16px; font-size: 13px; color: var(--muted); }
.campo { display: block; margin-bottom: 12px; }
.campo-label { display: block; margin-bottom: 5px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 14px; }
.m-pie { margin: 0 0 14px; font-size: 12px; color: var(--muted); }
.botones { display: flex; flex-direction: column; gap: 8px; }
.btn-grande { width: 100%; justify-content: center; padding: 12px; font-size: 14.5px; }
</style>
