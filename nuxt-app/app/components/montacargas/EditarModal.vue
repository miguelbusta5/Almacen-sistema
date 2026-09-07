<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import {
  API_MONTACARGAS, calcularCantidadTotal, normalizarCodigoProducto, normalizarUbicacion,
  requiereUbicacionInicial, type Movimiento,
} from '~/utils/montacargas'

const props = defineProps<{ item: Movimiento; canManage: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

// `datetime-local` habla en hora local del navegador; el operario esta en Bogota,
// que es la misma zona del servidor, asi que el ida y vuelta no desplaza nada.
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

const pideOrigen = computed(() => requiereUbicacionInicial(props.item.tipo))

const form = reactive({
  codigo: props.item.plu,
  cajas: String(props.item.cajas),
  unidadesPorCaja: String(props.item.unidadesPorCaja),
  hayReguero: props.item.hayReguero,
  unidadesSueltas: String(props.item.unidadesSueltas),
  ubicacionInicial: props.item.ubicacionInicial ?? '',
  ubicacionFinal: props.item.ubicacionFinal ?? '',
  horaInicio: toLocalInput(props.item.horaInicio),
  horaFinalizacion: toLocalInput(props.item.horaFinalizacion),
  motivoCorreccion: '',
})

const saving = ref(false)
const error = ref('')

const sueltasNum = computed(() => (form.hayReguero ? Number(form.unidadesSueltas || 0) : 0))
const totalPreview = computed(() =>
  calcularCantidadTotal(Number(form.cajas || 0), Number(form.unidadesPorCaja || 0), sueltasNum.value),
)

const cambiaHoras = computed(() =>
  props.canManage &&
  (form.horaInicio !== toLocalInput(props.item.horaInicio) ||
    form.horaFinalizacion !== toLocalInput(props.item.horaFinalizacion)),
)
// El servidor tambien lo valida (400); esto solo evita el viaje inutil.
const faltaMotivo = computed(() => cambiaHoras.value && form.motivoCorreccion.trim().length < 5)
const puedeGuardar = computed(() =>
  !saving.value && Boolean(form.codigo.trim()) &&
  Number(form.unidadesPorCaja) >= 1 &&
  (Number(form.cajas || 0) >= 1 || sueltasNum.value >= 1) &&
  (!form.hayReguero || sueltasNum.value >= 1) &&
  !faltaMotivo.value,
)

async function submit() {
  if (!puedeGuardar.value) return
  saving.value = true
  error.value = ''
  const payload: Record<string, unknown> = {
    codigo: normalizarCodigoProducto(form.codigo),
    cajas: Number(form.cajas || 0),
    unidadesPorCaja: Number(form.unidadesPorCaja),
    hayReguero: form.hayReguero,
    unidadesSueltas: sueltasNum.value,
  }
  if (pideOrigen.value && form.ubicacionInicial.trim()) {
    payload.ubicacionInicial = normalizarUbicacion(form.ubicacionInicial)
  }
  if (form.ubicacionFinal.trim()) payload.ubicacionFinal = normalizarUbicacion(form.ubicacionFinal)
  if (props.canManage) {
    if (form.horaInicio) payload.horaInicio = new Date(form.horaInicio).toISOString()
    payload.horaFinalizacion = form.horaFinalizacion ? new Date(form.horaFinalizacion).toISOString() : null
    if (form.motivoCorreccion.trim()) payload.motivoCorreccion = form.motivoCorreccion.trim()
  }
  try {
    await $fetch(`${API_MONTACARGAS}/${props.item.id}`, { method: 'PATCH', body: payload })
    emit('saved')
  } catch (e) {
    error.value = apiErr(e, 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell
    title="Editar registro" :sub="`PLU ${item.plu} · ${item.descripcion}`" wide
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <div class="row">
        <label class="f">
          <span class="lbl">PLU o código de barras</span>
          <input v-model="form.codigo" class="field" inputmode="numeric">
        </label>
        <label class="f">
          <span class="lbl">Cajas master</span>
          <input v-model="form.cajas" class="field tnum" type="number" min="0">
        </label>
        <label class="f">
          <span class="lbl">Unidades x caja</span>
          <input v-model="form.unidadesPorCaja" class="field tnum" type="number" min="1">
        </label>
      </div>
      <p class="hint">Al cambiar el código, la descripción se vuelve a tomar del maestro.</p>

      <div class="row">
        <label class="f f-check">
          <span class="lbl">¿Hay reguero?</span>
          <label class="check">
            <input v-model="form.hayReguero" type="checkbox">
            <span>Unidades sueltas</span>
          </label>
        </label>
        <label v-if="form.hayReguero" class="f">
          <span class="lbl">Unidades sueltas</span>
          <input v-model="form.unidadesSueltas" class="field tnum" type="number" min="1">
        </label>
        <label class="f">
          <span class="lbl">Cantidad total</span>
          <input class="field tnum" :value="totalPreview" disabled>
        </label>
      </div>

      <div class="row">
        <label v-if="pideOrigen" class="f">
          <span class="lbl">Ubicación inicial</span>
          <input v-model="form.ubicacionInicial" class="field" autocapitalize="characters" placeholder="05-B-25-03-01">
        </label>
        <label class="f">
          <span class="lbl">Ubicación final</span>
          <input v-model="form.ubicacionFinal" class="field" autocapitalize="characters" placeholder="05-B-25-03-01">
        </label>
      </div>

      <template v-if="canManage">
        <div class="row">
          <label class="f">
            <span class="lbl">Hora de inicio</span>
            <input v-model="form.horaInicio" class="field" type="datetime-local">
          </label>
          <label class="f">
            <span class="lbl">Hora de finalización</span>
            <input v-model="form.horaFinalizacion" class="field" type="datetime-local">
          </label>
        </div>
        <label class="f">
          <span class="lbl">Motivo de corrección {{ cambiaHoras ? '(obligatorio)' : '' }}</span>
          <textarea
            v-model="form.motivoCorreccion" class="field" rows="2"
            placeholder="Por qué se corrigen las horas (mínimo 5 caracteres)"
          />
        </label>
        <p v-if="faltaMotivo" class="warn">Cambiaste las horas: hace falta un motivo de al menos 5 caracteres.</p>
      </template>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="acciones">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puedeGuardar">
          <Spinner v-if="saving" :size="14" />{{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 13px; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.f { display: flex; flex-direction: column; gap: 5px; flex: 1 1 130px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.check { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 11px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-2); font-size: 12.5px; cursor: pointer; }
.check input { width: 16px; height: 16px; accent-color: var(--brand); }
.hint { font-size: 11.5px; color: var(--faint); margin: -6px 0 0; }
.warn { font-size: 12px; color: var(--u-aviso); margin: 0; }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acciones { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
</style>
