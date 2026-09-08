<script setup lang="ts">
// El ayudante no corrige: si lo que recibe no cuadra, marca la novedad. Eso
// DETIENE EL RELOJ y manda el registro a verificacion, que no se cronometra.
//
// Que se verifica depende del tipo: en recepcion las unidades de la estiba (no
// hay ubicacion de origen que revisar); en movimientos y resurtido, de donde
// salio la mercancia.
import { ref, reactive, computed } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import {
  API_MONTACARGAS, normalizarUbicacion, novedadEsperada, TIPO_NOVEDAD_LABEL,
  type Movimiento,
} from '~/utils/montacargas'

const props = defineProps<{ movimiento: Movimiento }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'creada'): void }>()

const sugerido = novedadEsperada(props.movimiento.tipo)
const form = reactive({
  tipo: sugerido,
  detalle: '',
  cantidadEncontrada: '',
  ubicacionEncontrada: '',
})
const enviando = ref(false)
const error = ref('')

const esUnidades = computed(() => form.tipo === 'UNIDADES')
const puedeEnviar = computed(() => !enviando.value)

async function submit() {
  if (!puedeEnviar.value) return
  enviando.value = true
  error.value = ''
  const body: Record<string, unknown> = { tipo: form.tipo }
  if (form.detalle.trim()) body.detalle = form.detalle.trim()
  if (esUnidades.value && form.cantidadEncontrada !== '') {
    body.cantidadEncontrada = Number(form.cantidadEncontrada)
  }
  if (!esUnidades.value && form.ubicacionEncontrada.trim()) {
    body.ubicacionEncontrada = normalizarUbicacion(form.ubicacionEncontrada)
  }
  try {
    await $fetch(`${API_MONTACARGAS}/${props.movimiento.id}/novedad`, { method: 'POST', body })
    emit('creada')
  } catch (e) {
    error.value = apiErr(e, 'No se pudo marcar la novedad')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <ModalShell
    title="Marcar novedad"
    :sub="`PLU ${movimiento.plu} · ${movimiento.descripcion}`"
    @close="emit('close')"
  >
    <p class="intro">
      <TriangleAlert :size="14" />
      El reloj se detiene y el registro queda en verificación, que no se cronometra.
    </p>

    <div class="esperado card-in">
      <span class="lbl">Lo registrado</span>
      <b class="tnum">{{ movimiento.cantidadTotal }} unidades</b>
      <span class="det">
        {{ movimiento.cajas }} cajas × {{ movimiento.unidadesPorCaja }}
        <template v-if="movimiento.hayReguero"> + {{ movimiento.unidadesSueltas }} sueltas</template>
        <template v-if="movimiento.ubicacionInicial"> · desde {{ movimiento.ubicacionInicial }}</template>
      </span>
    </div>

    <form class="form" @submit.prevent="submit">
      <label class="f">
        <span class="lbl">¿Qué no cuadra?</span>
        <select v-model="form.tipo" class="field">
          <option value="UNIDADES">{{ TIPO_NOVEDAD_LABEL.UNIDADES }}</option>
          <option value="UBICACION_INICIAL">{{ TIPO_NOVEDAD_LABEL.UBICACION_INICIAL }}</option>
        </select>
      </label>

      <label v-if="esUnidades" class="f">
        <span class="lbl">Unidades que encontraste (opcional)</span>
        <input v-model="form.cantidadEncontrada" class="field tnum" type="number" min="0" inputmode="numeric">
      </label>
      <label v-else class="f">
        <span class="lbl">Ubicación que encontraste (opcional)</span>
        <input v-model="form.ubicacionEncontrada" class="field" autocapitalize="characters" placeholder="05-B-25-03-01">
      </label>

      <label class="f">
        <span class="lbl">Detalle (opcional)</span>
        <textarea v-model="form.detalle" class="field" rows="2" placeholder="Qué encontraste al recibir" />
      </label>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="acciones">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-danger" :disabled="!puedeEnviar">
          <Spinner v-if="enviando" :size="14" />{{ enviando ? 'Marcando…' : 'Marcar novedad' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.intro { display: flex; align-items: center; gap: 7px; margin: 0 0 12px; font-size: 12.5px; color: var(--u-aviso); }
.esperado { display: flex; flex-direction: column; gap: 2px; padding: 11px 13px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); margin-bottom: 14px; }
.esperado b { font-size: 20px; color: var(--ink); }
.det { font-size: 12px; color: var(--muted); }
.form { display: flex; flex-direction: column; gap: 12px; }
.f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acciones { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
.btn-danger { background: var(--u-critico); color: #fff; border-color: transparent; }
</style>
