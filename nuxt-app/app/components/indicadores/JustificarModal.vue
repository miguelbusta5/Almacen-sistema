<script setup lang="ts">
// Justificar uno o varios tiempos muertos con el mismo motivo. Varios a la vez
// porque el almuerzo de todo el equipo se explica de una sola vez.
import { computed, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { fmtTiempo } from '~/utils/montacargas'
import {
  API_TIEMPOS_MUERTOS, fmtDiaCorto, fmtHora, MOTIVO_TIEMPO_MUERTO_LABEL, MOTIVOS_TIEMPO_MUERTO,
  type MotivoTiempoMuerto, type TiempoMuertoDetalle,
} from '~/utils/indicadores'

const props = defineProps<{ tramos: TiempoMuertoDetalle[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'justificado'): void }>()
const { show: showToast } = useToast()

// Si todos traian ya el mismo motivo (se esta corrigiendo), se parte de ese.
const motivoPrevio = computed(() => {
  const m = props.tramos.map((t) => t.justificacion?.motivo ?? null)
  return m.length > 0 && m.every((x) => x && x === m[0]) ? m[0] : null
})
const motivo = ref<MotivoTiempoMuerto | ''>(motivoPrevio.value ?? '')
const observacion = ref(props.tramos.length === 1 ? (props.tramos[0]!.justificacion?.observacion ?? '') : '')
const guardando = ref(false)

const total = computed(() => props.tramos.reduce((s, t) => s + t.segundos, 0))
const personas = computed(() => new Set(props.tramos.map((t) => t.usuarioId)).size)
const titulo = computed(() => props.tramos.length === 1
  ? 'Justificar tiempo muerto'
  : `Justificar ${props.tramos.length} tiempos muertos`)
const sub = computed(() => {
  if (props.tramos.length === 1) {
    const t = props.tramos[0]!
    return `${t.nombre} · ${fmtDiaCorto(t.dia)} · ${fmtHora(t.inicio)} a ${fmtHora(t.fin)} (${fmtTiempo(t.segundos)})`
  }
  return `${fmtTiempo(total.value)} en total · ${personas.value} persona${personas.value !== 1 ? 's' : ''}`
})
const exigeObservacion = computed(() => motivo.value === 'OTRO')
const listo = computed(() => !!motivo.value && (!exigeObservacion.value || observacion.value.trim().length >= 3))

async function guardar() {
  if (!listo.value || guardando.value) return
  guardando.value = true
  try {
    await $fetch(API_TIEMPOS_MUERTOS, {
      method: 'POST',
      body: {
        motivo: motivo.value,
        observacion: observacion.value.trim() || undefined,
        tramos: props.tramos.map((t) => ({ usuarioId: t.usuarioId, inicio: t.inicio, fin: t.fin })),
      },
    })
    showToast(props.tramos.length === 1 ? 'Tiempo muerto justificado' : `${props.tramos.length} tiempos muertos justificados`)
    emit('justificado')
  } catch (e) {
    showToast(apiErr(e, 'No se pudo guardar la justificación'), true)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <ModalShell :title="titulo" :sub="sub" wide @close="emit('close')">
    <form class="jf" @submit.prevent="guardar">
      <fieldset class="motivos">
        <legend class="lbl">Motivo</legend>
        <label
          v-for="m in MOTIVOS_TIEMPO_MUERTO" :key="m" class="motivo"
          :class="{ on: motivo === m, malo: m === 'SIN_JUSTIFICACION' }"
        >
          <input v-model="motivo" type="radio" name="motivo" :value="m">
          {{ MOTIVO_TIEMPO_MUERTO_LABEL[m] }}
        </label>
      </fieldset>
      <p v-if="motivo === 'SIN_JUSTIFICACION'" class="nota">
        Queda revisado como tiempo perdido: deja de estar por justificar, pero no cuenta como justificado.
      </p>

      <label class="f">
        <span class="lbl">Observación {{ exigeObservacion ? '(obligatoria)' : '(opcional)' }}</span>
        <textarea
          v-model="observacion" class="field" rows="3" maxlength="500"
          :placeholder="exigeObservacion ? 'Escribe qué pasó' : 'Detalle que ayude a entenderlo después'"
        />
      </label>

      <div class="acciones">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="!listo || guardando">
          <Spinner v-if="guardando" :size="14" />
          {{ guardando ? 'Guardando…' : 'Justificar' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.jf { display: flex; flex-direction: column; gap: 14px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.motivos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0; padding: 0; border: none; }
.motivos legend { margin-bottom: 7px; }
.motivo {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--r-sm);
  border: 1px solid var(--border); font-size: 13px; color: var(--ink-2); cursor: pointer;
  transition: border-color .12s, background .12s;
}
.motivo:hover { border-color: var(--border-strong); background: var(--surface-2); }
.motivo.on { border-color: var(--brand); background: var(--brand-tint); color: var(--ink); font-weight: 600; }
.motivo.malo.on { border-color: var(--error); background: var(--error-tint); }
.motivo input { accent-color: var(--brand); margin: 0; }
.nota { margin: -4px 0 0; font-size: 12px; color: var(--muted); }
.f { display: flex; flex-direction: column; gap: 5px; }
.f textarea { resize: vertical; min-height: 64px; font-family: inherit; padding: 8px 10px; }
.acciones { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 520px) { .motivos { grid-template-columns: 1fr; } }
</style>
