<script setup lang="ts">
// La novedad la confirma el montacarguista o supervision, no quien la abrio.
// Al resolver, el reloj se reanuda para quien tiene el PLU en la mano: la
// ventana de verificacion queda fuera del tiempo medido.
import { ref, reactive, computed } from 'vue'
import { CheckCircle2 } from '@lucide/vue'
import {
  API_MONTACARGAS, normalizarUbicacion, requiereUbicacionInicial, TIPO_NOVEDAD_LABEL,
  fmtHoraMovimiento, type Movimiento,
} from '~/utils/montacargas'

const props = defineProps<{ movimiento: Movimiento }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'resuelta'): void }>()

const nov = props.movimiento.novedadAbierta
const pideOrigen = computed(() => requiereUbicacionInicial(props.movimiento.tipo))

const form = reactive({
  nota: '',
  cajas: String(props.movimiento.cajas),
  unidadesPorCaja: String(props.movimiento.unidadesPorCaja),
  unidadesSueltas: String(props.movimiento.unidadesSueltas),
  ubicacionInicial: props.movimiento.ubicacionInicial ?? '',
})
const enviando = ref(false)
const error = ref('')

const puedeEnviar = computed(() => !enviando.value && form.nota.trim().length >= 3)

async function submit() {
  if (!puedeEnviar.value) return
  enviando.value = true
  error.value = ''
  const body: Record<string, unknown> = {
    nota: form.nota.trim(),
    cajas: Number(form.cajas || 0),
    unidadesPorCaja: Number(form.unidadesPorCaja || 1),
    unidadesSueltas: Number(form.unidadesSueltas || 0),
  }
  if (pideOrigen.value && form.ubicacionInicial.trim()) {
    body.ubicacionInicial = normalizarUbicacion(form.ubicacionInicial)
  }
  try {
    await $fetch(`${API_MONTACARGAS}/${props.movimiento.id}/resolver-novedad`, { method: 'POST', body })
    emit('resuelta')
  } catch (e) {
    error.value = apiErr(e, 'No se pudo resolver la novedad')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <ModalShell
    title="Verificar y resolver"
    :sub="`PLU ${movimiento.plu} · ${movimiento.descripcion}`"
    @close="emit('close')"
  >
    <div v-if="nov" class="nov">
      <b>{{ TIPO_NOVEDAD_LABEL[nov.tipo] }}</b>
      <span class="det">
        {{ nov.abiertaPorNombre ?? 'Ayudante' }} · {{ fmtHoraMovimiento(nov.abiertaAt) }}
        <template v-if="nov.cantidadEncontrada != null"> · encontró {{ nov.cantidadEncontrada }} unidades</template>
        <template v-if="nov.ubicacionEncontrada"> · encontró en {{ nov.ubicacionEncontrada }}</template>
      </span>
      <p v-if="nov.detalle" class="detalle">{{ nov.detalle }}</p>
    </div>

    <form class="form" @submit.prevent="submit">
      <p class="hint">Corrige lo que haga falta. Al resolver, el reloj se reanuda.</p>

      <div class="row">
        <label class="f">
          <span class="lbl">Cajas master</span>
          <input v-model="form.cajas" class="field tnum" type="number" min="0">
        </label>
        <label class="f">
          <span class="lbl">Unidades x caja</span>
          <input v-model="form.unidadesPorCaja" class="field tnum" type="number" min="1">
        </label>
        <label class="f">
          <span class="lbl">Unidades sueltas</span>
          <input v-model="form.unidadesSueltas" class="field tnum" type="number" min="0">
        </label>
      </div>

      <label v-if="pideOrigen" class="f">
        <span class="lbl">Ubicación inicial</span>
        <input v-model="form.ubicacionInicial" class="field" autocapitalize="characters">
      </label>

      <label class="f">
        <span class="lbl">Qué se verificó (obligatorio)</span>
        <textarea v-model="form.nota" class="field" rows="2" placeholder="Mínimo 3 caracteres" />
      </label>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="acciones">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puedeEnviar">
          <Spinner v-if="enviando" :size="14" /><CheckCircle2 v-else :size="14" />
          {{ enviando ? 'Resolviendo…' : 'Marcar resuelta' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.nov { display: flex; flex-direction: column; gap: 3px; padding: 11px 13px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--u-aviso) 9%, transparent); border: 1px solid color-mix(in srgb, var(--u-aviso) 32%, transparent); margin-bottom: 14px; }
.nov b { font-size: 13px; color: var(--ink); }
.det { font-size: 11.5px; color: var(--muted); }
.detalle { margin: 5px 0 0; font-size: 12.5px; color: var(--ink-2); }
.form { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.f { display: flex; flex-direction: column; gap: 5px; flex: 1 1 120px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { margin: 0; font-size: 12px; color: var(--faint); }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acciones { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
</style>
