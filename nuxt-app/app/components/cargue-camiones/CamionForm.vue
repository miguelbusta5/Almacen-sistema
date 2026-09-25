<script setup lang="ts">
// Datos del camion: tipo de vehiculo, transportadora, placa, observacion y
// quienes lo cargan. Sirve para iniciar el cargue y para corregirlo.
import { computed, reactive, watch } from 'vue'
import { Truck, Users, Check } from '@lucide/vue'
import type { DatosCamion, OperarioCargue } from '~/utils/cargueCamiones'

const props = withDefaults(defineProps<{
  operarios: OperarioCargue[]
  sugerencias: { transportadoras: string[]; vehiculos: string[] }
  inicial?: DatosCamion | null
  guardando?: boolean
  /** Correccion de un camion ya finalizado: pide motivo. */
  pideMotivo?: boolean
  textoBoton?: string
}>(), { inicial: null, guardando: false, pideMotivo: false, textoBoton: 'Iniciar cargue del camión' })

const emit = defineEmits<{
  (e: 'guardar', datos: DatosCamion): void
  (e: 'cancelar'): void
}>()

const f = reactive({ tipoVehiculo: '', transportadora: '', placa: '', observacion: '', motivo: '', operarios: [] as string[] })
watch(() => props.inicial, (i) => {
  f.tipoVehiculo = i?.tipoVehiculo ?? ''
  f.transportadora = i?.transportadora ?? ''
  f.placa = i?.placa ?? ''
  f.observacion = i?.observacion ?? ''
  f.operarios = [...(i?.operarios ?? [])]
  f.motivo = ''
}, { immediate: true })

function alternar(id: string) {
  f.operarios = f.operarios.includes(id) ? f.operarios.filter((x) => x !== id) : [...f.operarios, id]
}

const falta = computed(() => {
  if (!f.tipoVehiculo.trim()) return 'Escribe el tipo de vehículo'
  if (!f.transportadora.trim()) return 'Escribe la transportadora'
  if (!f.operarios.length) return 'Elige quiénes cargan el camión'
  if (props.pideMotivo && f.motivo.trim().length < 5) return 'Escribe el motivo de la corrección'
  return null
})

function guardar() {
  if (falta.value || props.guardando) return
  emit('guardar', {
    tipoVehiculo: f.tipoVehiculo.trim(),
    transportadora: f.transportadora.trim(),
    placa: f.placa.trim() || null,
    observacion: f.observacion.trim() || null,
    operarios: f.operarios,
    motivo: props.pideMotivo ? f.motivo.trim() : null,
  })
}
</script>

<template>
  <form class="cf" @submit.prevent="guardar">
    <div class="cf-grid">
      <label class="campo">
        <span class="lbl">Tipo de vehículo</span>
        <input v-model="f.tipoVehiculo" class="field" list="cf-vehiculos" maxlength="80" placeholder="Ej. Turbo, sencillo, tractomula" autocomplete="off">
        <datalist id="cf-vehiculos"><option v-for="v in sugerencias.vehiculos" :key="v" :value="v" /></datalist>
      </label>
      <label class="campo">
        <span class="lbl">Transportadora</span>
        <input v-model="f.transportadora" class="field" list="cf-transportadoras" maxlength="120" placeholder="Nombre de la transportadora" autocomplete="off">
        <datalist id="cf-transportadoras"><option v-for="t in sugerencias.transportadoras" :key="t" :value="t" /></datalist>
      </label>
      <label class="campo">
        <span class="lbl">Placa (opcional)</span>
        <input v-model="f.placa" class="field mono" maxlength="20" placeholder="ABC123" autocomplete="off" autocapitalize="characters">
      </label>
      <label class="campo">
        <span class="lbl">Observación (opcional)</span>
        <input v-model="f.observacion" class="field" maxlength="300" placeholder="Nota del cargue" autocomplete="off">
      </label>
    </div>

    <fieldset class="cf-personas">
      <legend class="lbl"><Users :size="13" /> Quiénes cargan el camión <span class="cuenta">{{ f.operarios.length }} elegidos</span></legend>
      <div class="chips">
        <button
          v-for="o in operarios" :key="o.id" type="button" class="chip"
          :class="{ on: f.operarios.includes(o.id) }" :aria-pressed="f.operarios.includes(o.id)" @click="alternar(o.id)"
        >
          <Check v-if="f.operarios.includes(o.id)" :size="13" /> {{ o.nombre }}
        </button>
      </div>
      <p v-if="!operarios.length" class="vacio">No hay personas en la lista: el administrador las agrega en «Personas que cargan».</p>
    </fieldset>

    <label v-if="pideMotivo" class="campo">
      <span class="lbl">Motivo de la corrección</span>
      <input v-model="f.motivo" class="field" maxlength="300" placeholder="Qué se corrige y por qué" autocomplete="off">
    </label>

    <footer class="cf-pie">
      <span v-if="falta" class="falta">{{ falta }}</span>
      <button v-if="inicial" type="button" class="btn btn-ghost" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn btn-primary" :disabled="!!falta || guardando">
        <Truck :size="15" /> {{ guardando ? 'Guardando…' : textoBoton }}
      </button>
    </footer>
  </form>
</template>

<style scoped>
.cf { display: flex; flex-direction: column; gap: 14px; }
.cf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.campo { display: flex; flex-direction: column; gap: 5px; }
.lbl { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.field { font-size: 14px; }
.cf-personas { margin: 0; padding: 0; border: none; }
.cuenta { margin-left: 6px; text-transform: none; letter-spacing: 0; font-weight: 600; color: var(--brand); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; min-height: 38px;
  border: 1px solid var(--border-strong); border-radius: var(--r-pill); background: var(--surface);
  font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer;
}
.chip:hover { border-color: var(--brand); }
.chip.on { border-color: var(--brand); background: var(--brand-tint); color: var(--ink); }
.chip:focus-visible { outline: none; box-shadow: var(--ring); }
.vacio { margin: 6px 0 0; font-size: 12.5px; color: var(--muted); }
.cf-pie { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.falta { margin-right: auto; font-size: 12.5px; font-weight: 600; color: var(--u-aviso); }
@media (max-width: 520px) { .cf-pie .btn { width: 100%; justify-content: center; } .falta { width: 100%; } }
</style>
