<script setup lang="ts">
// Panel de gestión de transporte. Solo gestores (el servidor devuelve 403 al resto).
import { computed } from 'vue'
import { CheckCircle2 } from '@lucide/vue'
import { STELLA_LABEL, STELLA_OPTIONS, type GestionForm } from '~/utils/solicitudesTransporte'

const props = defineProps<{
  modelValue: GestionForm
  transportadoras: string[]
  saving: boolean
  puedeRechazar: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: GestionForm): void
  (e: 'guardar'): void
  (e: 'rechazar'): void
}>()

function set<K extends keyof GestionForm>(key: K, value: GestionForm[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const avisoEstado = computed(() => {
  switch (props.modelValue.stellaEstado) {
    case 'PROGRAMADO': return 'Pasará a Programada y el solicitante dejará de poder editarla.'
    case 'EFECTUADO': return 'Pasará a Efectuada y ya no podrá rechazarse.'
    case 'CANCELADO': return 'Pasará a Cancelada y ya no podrá rechazarse.'
    default: return 'Se mantiene como Pendiente hasta que programes el servicio.'
  }
})

// La transportadora es obligatoria: sin ella el servidor no puede cerrar la gestión.
const faltaTransportadora = computed(() => !props.modelValue.transportadora)
</script>

<template>
  <div class="gestion">
    <label class="f">
      <span class="lbl">Estado de gestión (Stella)</span>
      <select
        class="field" :value="modelValue.stellaEstado"
        @change="set('stellaEstado', ($event.target as HTMLSelectElement).value as GestionForm['stellaEstado'])"
      >
        <option v-for="s in STELLA_OPTIONS" :key="s" :value="s">{{ STELLA_LABEL[s] }}</option>
      </select>
      <span class="aviso">{{ avisoEstado }}</span>
    </label>

    <div class="grid">
      <label class="f">
        <span class="lbl">Documento NetSuite</span>
        <input
          class="field" :value="modelValue.documentoNetSuite"
          @input="set('documentoNetSuite', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <label class="f">
        <span class="lbl">Fecha de programación</span>
        <input
          class="field" type="date" :value="modelValue.fechaProgramacion"
          @change="set('fechaProgramacion', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <label class="f">
        <span class="lbl">Transportadora</span>
        <select
          class="field" :class="{ falta: faltaTransportadora }" :value="modelValue.transportadora"
          @change="set('transportadora', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">Seleccionar</option>
          <option v-for="t in transportadoras" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label class="f">
        <span class="lbl">Número de guía</span>
        <input
          class="field" :value="modelValue.numeroGuia"
          @input="set('numeroGuia', ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>

    <label class="f">
      <span class="lbl">Observación de transporte</span>
      <textarea
        class="field" rows="3" :value="modelValue.observacionTransporte"
        @input="set('observacionTransporte', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <p v-if="faltaTransportadora" class="warn">Selecciona una transportadora para guardar la gestión.</p>

    <div class="acc">
      <button class="btn btn-primary guardar" :disabled="saving || faltaTransportadora" @click="emit('guardar')">
        <Spinner v-if="saving" :size="14" /><CheckCircle2 v-else :size="15" />
        {{ saving ? 'Guardando…' : 'Guardar gestión' }}
      </button>
      <button v-if="puedeRechazar" class="btn rechazar" :disabled="saving" @click="emit('rechazar')">
        Rechazar solicitud
      </button>
    </div>
  </div>
</template>

<style scoped>
.gestion { display: flex; flex-direction: column; gap: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 11px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.aviso { font-size: 11.5px; color: var(--faint); }
.falta { border-color: color-mix(in srgb, var(--u-aviso) 45%, transparent); }
.warn { margin: 0; font-size: 12px; color: var(--u-aviso); }
.acc { display: flex; gap: 9px; flex-wrap: wrap; }
.guardar { flex: 1 1 200px; justify-content: center; }
.rechazar { color: var(--u-critico); border-color: color-mix(in srgb, var(--u-critico) 35%, transparent); }
.rechazar:hover:not(:disabled) { background: var(--u-critico-tint); }
</style>
