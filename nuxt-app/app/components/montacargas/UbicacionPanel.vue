<script setup lang="ts">
// Paso 2 del ciclo: el registro ya esta creado y el reloj corriendo. Asignar la
// ubicacion final es lo que lo cierra - no hay un "finalizar" aparte.
// Ocupa el sitio de la captura mientras hay un registro en curso: el operario
// solo puede hacer una cosa a la vez, y asi no hay forma de equivocarse.
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { MapPin, TriangleAlert } from '@lucide/vue'
import {
  esUbicacionCanonica, fmtHoraMovimiento, normalizarUbicacion, type Movimiento,
} from '~/utils/montacargas'

const props = defineProps<{ movimiento: Movimiento; saving: boolean }>()
const emit = defineEmits<{ (e: 'submit', ubicacionFinal: string): void }>()

const input = ref<HTMLInputElement | null>(null)
const ubicacion = ref('')

// Cronometro: refuerza al operario que el tiempo corre. Tick de 1s porque un
// movimiento se cierra en minutos, no en horas.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
  void nextTick(() => input.value?.focus())
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

// Al pasar de un registro a otro hay que limpiar y volver a enfocar.
watch(() => props.movimiento.id, () => {
  ubicacion.value = ''
  void nextTick(() => input.value?.focus())
})

const transcurrido = computed(() => {
  const seg = Math.max(0, Math.floor((ahora.value - new Date(props.movimiento.horaInicio).getTime()) / 1000))
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const normalizada = computed(() => normalizarUbicacion(ubicacion.value))
// Fuera del formato canonico (INSPECCION, MUEBLES, ECUADOR...) es valido igual:
// el historico tiene 2.406 valores distintos y bloquearlos pararia la operacion.
// Solo se avisa para que el operario confirme que no fue un dedazo.
const esLibre = computed(() => Boolean(normalizada.value) && !esUbicacionCanonica(normalizada.value))

const puedeGuardar = computed(() => !props.saving && Boolean(normalizada.value))

function submit() {
  if (!puedeGuardar.value) return
  emit('submit', normalizada.value)
}
</script>

<template>
  <section class="panel card">
    <header class="cab">
      <span class="pulse" />
      <div class="cab-txt">
        <b>Registro en curso</b>
        <span class="det">
          PLU {{ movimiento.plu }} · {{ movimiento.cajas }} cajas
          <template v-if="movimiento.hayReguero"> + {{ movimiento.unidadesSueltas }} sueltas</template>
          · {{ movimiento.cantidadTotal }} unidades
          <template v-if="movimiento.ubicacionInicial"> · desde {{ movimiento.ubicacionInicial }}</template>
          · {{ fmtHoraMovimiento(movimiento.horaInicio) }}
        </span>
      </div>
      <div class="crono tnum" :title="`Iniciado a las ${fmtHoraMovimiento(movimiento.horaInicio)}`">
        {{ transcurrido }}
      </div>
    </header>

    <p class="desc-prod">{{ movimiento.descripcion }}</p>

    <form class="fila" @submit.prevent="submit">
      <label class="f">
        <span class="lbl">Ubicación final (depósito)</span>
        <input
          ref="input" v-model="ubicacion" class="field" placeholder="05-B-25-03-01"
          autocomplete="off" autocapitalize="characters" enterkeyhint="done" :disabled="saving"
        >
        <span v-if="esLibre" class="hint warn-txt">
          <TriangleAlert :size="11" /> Ubicación libre, fuera del formato 05-B-25-03-01
        </span>
      </label>

      <button class="btn btn-primary submit" :disabled="!puedeGuardar">
        <Spinner v-if="saving" :size="14" /><MapPin v-else :size="14" />
        {{ saving ? 'Cerrando…' : 'Asignar ubicación y cerrar' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.panel {
  padding: 16px 18px 18px;
  border-top: 3px solid var(--info);
  background: color-mix(in srgb, var(--info) 5%, var(--surface));
}

.cab { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--info); flex-shrink: 0; animation: auroraPulse 1.8s ease-in-out infinite; }
.cab-txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.cab-txt b { font-size: 12.5px; color: var(--ink); }
.det { font-size: 12px; color: var(--muted); }
.crono { font-size: 22px; font-weight: 700; color: var(--info); font-variant-numeric: tabular-nums; }

.desc-prod { margin: 10px 0 14px; font-size: 14px; font-weight: 600; color: var(--ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

.fila { display: flex; align-items: flex-end; gap: 12px; }
.f { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { display: flex; align-items: center; gap: 4px; font-size: 11px; }
.warn-txt { color: var(--u-aviso); }
.submit { height: 40px; white-space: nowrap; }

@media (max-width: 700px) {
  .fila { flex-direction: column; align-items: stretch; }
  .fila :deep(.field) { height: 48px; font-size: 16px; }
  .submit { height: 50px; font-size: 15px; justify-content: center; position: sticky; bottom: 12px; }
  .crono { font-size: 26px; }
}
</style>
