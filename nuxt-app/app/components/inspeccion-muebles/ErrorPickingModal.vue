<script setup lang="ts">
// Marcar (o corregir, o quitar) el error de picking de un PLU. Solo administrador.
//
// El error queda a nombre del operario que pickeo el PLU y sale en Indicadores
// Muebles. Con los errores marcados, la orden se puede terminar aunque esos PLU
// no se hayan inspeccionado.
import { ref, watch } from 'vue'
import { TIPO_ERROR_PICKING_LABEL, type Linea } from '~/utils/muebles'

const props = defineProps<{ linea: Linea | null; guardando: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { tipo: string; nota: string }): void
  (e: 'quitar'): void
}>()

const tipo = ref('')
const nota = ref('')

watch(() => props.linea, (l) => {
  tipo.value = l?.errorPicking?.tipo ?? ''
  nota.value = l?.errorPicking?.nota ?? ''
})
</script>

<template>
  <div v-if="linea" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">{{ linea.errorPicking ? 'Corregir error de picking' : 'Error de picking' }}</h3>
      <p class="m-desc">
        <strong>{{ linea.plu }}</strong>{{ linea.descripcion ? ` · ${linea.descripcion}` : '' }}
        <br>Queda a nombre de <strong>{{ linea.operario?.nombre ?? 'quien lo pickeó' }}</strong> y sale en los indicadores.
      </p>

      <fieldset class="tipos">
        <legend class="campo-label">¿Qué salió mal?</legend>
        <label v-for="(label, key) in TIPO_ERROR_PICKING_LABEL" :key="key" class="tipo" :class="{ on: tipo === key }">
          <input v-model="tipo" type="radio" name="tipo-error" :value="key">
          {{ label }}
        </label>
      </fieldset>

      <label class="campo">
        <span class="campo-label">Nota (opcional)</span>
        <textarea v-model="nota" class="input" rows="2" maxlength="500" placeholder="Ej. bajó el 10073 en vez del 10072" />
      </label>

      <footer class="m-pie">
        <button v-if="linea.errorPicking" class="btn btn-ghost quitar" :disabled="guardando" @click="emit('quitar')">
          Quitar error
        </button>
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!tipo || guardando" @click="emit('confirmar', { tipo, nota: nota.trim() })">
          Marcar error
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 460px; max-height: 100%; overflow-y: auto; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-desc { margin: 0 0 14px; font-size: 12.5px; line-height: 1.5; color: var(--muted); }
.tipos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 0 0 12px; padding: 0; border: none; }
.tipos legend { margin-bottom: 6px; }
.tipo { display: flex; align-items: center; gap: 7px; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.tipo.on { border-color: var(--error); color: var(--error); background: var(--error-tint); }
.campo { display: block; margin-bottom: 12px; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.quitar { margin-right: auto; color: var(--error); }
@media (max-width: 480px) { .tipos { grid-template-columns: 1fr; } .m-pie .btn { flex: 1; justify-content: center; } }
</style>
