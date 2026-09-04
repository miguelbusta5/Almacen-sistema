<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import {
  API_ESTIBAS, calcularCantidadTotal, normalizarCodigoProducto, normalizarPedido,
  normalizarUbicacion, type Estiba,
} from '~/utils/estibas'

const props = defineProps<{ item: Estiba; canManage: boolean }>()
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
  pedido: props.item.pedido,
  codigo: props.item.plu,
  cajas: String(props.item.cajas),
  unidadesPorCaja: String(props.item.unidadesPorCaja),
  ubicacion: props.item.ubicacion ?? '',
  horaInicio: toLocalInput(props.item.horaInicio),
  horaFinalizacion: toLocalInput(props.item.horaFinalizacion),
  motivoCorreccion: '',
})

const saving = ref(false)
const error = ref('')

const totalPreview = computed(() =>
  calcularCantidadTotal(Number(form.cajas || 0), Number(form.unidadesPorCaja || 0)),
)

const cambiaHoras = computed(() =>
  props.canManage &&
  (form.horaInicio !== toLocalInput(props.item.horaInicio) ||
    form.horaFinalizacion !== toLocalInput(props.item.horaFinalizacion)),
)
// El servidor también lo valida (400); esto solo evita el viaje inútil.
const faltaMotivo = computed(() => cambiaHoras.value && form.motivoCorreccion.trim().length < 5)
const puedeGuardar = computed(() =>
  !saving.value && Boolean(form.pedido.trim()) && Boolean(form.codigo.trim()) &&
  Number(form.cajas) >= 1 && Number(form.unidadesPorCaja) >= 1 && !faltaMotivo.value,
)

async function submit() {
  if (!puedeGuardar.value) return
  saving.value = true
  error.value = ''
  const payload: Record<string, unknown> = {
    pedido: normalizarPedido(form.pedido),
    codigo: normalizarCodigoProducto(form.codigo),
    cajas: Number(form.cajas),
    unidadesPorCaja: Number(form.unidadesPorCaja),
  }
  if (form.ubicacion.trim()) payload.ubicacion = normalizarUbicacion(form.ubicacion)
  if (props.canManage) {
    if (form.horaInicio) payload.horaInicio = new Date(form.horaInicio).toISOString()
    payload.horaFinalizacion = form.horaFinalizacion ? new Date(form.horaFinalizacion).toISOString() : null
    if (form.motivoCorreccion.trim()) payload.motivoCorreccion = form.motivoCorreccion.trim()
  }
  try {
    await $fetch(`${API_ESTIBAS}/${props.item.id}`, { method: 'PATCH', body: payload })
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
    title="Editar estiba" :sub="`Pedido ${item.pedido} · PLU ${item.plu}`" wide
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <div class="row">
        <label class="f">
          <span class="lbl">N° de pedido</span>
          <input v-model="form.pedido" class="field" autocapitalize="characters">
        </label>
        <label class="f">
          <span class="lbl">PLU o código de barras</span>
          <input v-model="form.codigo" class="field" inputmode="numeric">
        </label>
      </div>
      <p class="hint">Al cambiar el código, la descripción se vuelve a tomar del maestro.</p>

      <div class="row">
        <label class="f">
          <span class="lbl">Cajas</span>
          <input v-model="form.cajas" class="field tnum" type="number" min="1">
        </label>
        <label class="f">
          <span class="lbl">Unidades x caja</span>
          <input v-model="form.unidadesPorCaja" class="field tnum" type="number" min="1">
        </label>
        <label class="f">
          <span class="lbl">Cantidad total</span>
          <input class="field tnum" :value="totalPreview" disabled>
        </label>
      </div>

      <label class="f">
        <span class="lbl">Ubicación final</span>
        <input v-model="form.ubicacion" class="field" autocapitalize="characters" placeholder="05-B-25-03-01">
      </label>

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
