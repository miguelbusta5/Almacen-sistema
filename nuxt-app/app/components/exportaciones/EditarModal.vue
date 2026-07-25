<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { normalizePlu, type Exportacion, type PaisConfig } from '~/utils/exportaciones'

const props = defineProps<{ item: Exportacion; cfg: PaisConfig; canManage: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

// `datetime-local` habla en hora local del navegador; el operario está en Bogotá,
// que es la misma zona del servidor, así que el ida y vuelta no desplaza nada.
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

const form = reactive({
  numeroCaja: props.item.numeroCaja,
  plu: props.item.plu,
  unidadEmpaque: String(props.item.unidadEmpaque),
  horaInicio: toLocalInput(props.item.horaInicio),
  horaFinalizacion: toLocalInput(props.item.horaFinalizacion),
  motivoCorreccion: '',
})

const saving = ref(false)
const error = ref('')

const cambiaHoras = computed(() =>
  props.canManage &&
  (form.horaInicio !== toLocalInput(props.item.horaInicio) ||
    form.horaFinalizacion !== toLocalInput(props.item.horaFinalizacion)),
)
// El servidor también lo valida (400); esto solo evita el viaje inútil.
const faltaMotivo = computed(() => cambiaHoras.value && form.motivoCorreccion.trim().length < 5)
const puedeGuardar = computed(() =>
  !saving.value && !!form.numeroCaja.trim() && !!form.plu.trim() &&
  Number(form.unidadEmpaque) >= 1 && !faltaMotivo.value,
)

async function submit() {
  if (!puedeGuardar.value) return
  saving.value = true
  error.value = ''
  const payload: Record<string, unknown> = {
    numeroCaja: form.numeroCaja.trim(),
    plu: normalizePlu(form.plu),
    unidadEmpaque: Number(form.unidadEmpaque),
  }
  if (props.canManage) {
    if (form.horaInicio) payload.horaInicio = new Date(form.horaInicio).toISOString()
    payload.horaFinalizacion = form.horaFinalizacion ? new Date(form.horaFinalizacion).toISOString() : null
    if (form.motivoCorreccion.trim()) payload.motivoCorreccion = form.motivoCorreccion.trim()
  }
  try {
    await $fetch(`${props.cfg.apiBase}/${props.item.id}`, { method: 'PATCH', body: payload })
    emit('saved')
  } catch (e) {
    error.value = apiErr(e, 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell title="Editar registro" :sub="`Caja ${item.numeroCaja} · PLU ${item.plu}`" wide @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <div class="row">
        <label class="f">
          <span class="lbl">N° de caja</span>
          <input v-model="form.numeroCaja" class="field" autocapitalize="characters">
        </label>
        <label class="f">
          <span class="lbl">PLU</span>
          <input v-model="form.plu" class="field" inputmode="numeric">
        </label>
        <label class="f">
          <span class="lbl">Empaque</span>
          <input v-model="form.unidadEmpaque" class="field tnum" type="number" min="1">
        </label>
      </div>
      <p class="hint">Al cambiar el PLU, la descripción se vuelve a tomar del maestro.</p>

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
.hint { font-size: 11.5px; color: var(--faint); margin: -6px 0 0; }
.warn { font-size: 12px; color: var(--u-aviso); margin: 0; }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acciones { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
</style>
