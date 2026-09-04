<script setup lang="ts">
// Paso 2 del ciclo: la estiba ya está armada y el reloj corriendo. Asignar la
// ubicación es lo que la cierra — no hay un "finalizar" aparte.
// Ocupa el sitio de la captura mientras hay una estiba en curso: el operario
// solo puede hacer una cosa a la vez, y así no hay forma de equivocarse.
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { MapPin, TriangleAlert } from '@lucide/vue'
import {
  esUbicacionCanonica, fmtHoraEstiba, normalizarUbicacion, type Estiba,
} from '~/utils/estibas'

const props = defineProps<{ estiba: Estiba; saving: boolean }>()
const emit = defineEmits<{ (e: 'submit', ubicacion: string): void }>()

const input = ref<HTMLInputElement | null>(null)
const ubicacion = ref('')

// Cronómetro: refuerza al operario que el tiempo corre. Tick de 1s (y no de 30s
// como en Exportaciones) porque una estiba se cierra en minutos, no en horas.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
  void nextTick(() => input.value?.focus())
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

// Al pasar de una estiba a otra hay que limpiar y volver a enfocar.
watch(() => props.estiba.id, () => {
  ubicacion.value = ''
  void nextTick(() => input.value?.focus())
})

const transcurrido = computed(() => {
  const seg = Math.max(0, Math.floor((ahora.value - new Date(props.estiba.horaInicio).getTime()) / 1000))
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const normalizada = computed(() => normalizarUbicacion(ubicacion.value))
// Fuera del formato canónico (INSPECCION, MUEBLES, ECUADOR…) es válido igual:
// el histórico tiene 2.406 valores distintos y bloquearlos pararía la operación.
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
        <b>Estiba en curso</b>
        <span class="det">
          Pedido {{ estiba.pedido }} · PLU {{ estiba.plu }} ·
          {{ estiba.cajas }} cajas · {{ estiba.cantidadTotal }} unidades ·
          desde {{ fmtHoraEstiba(estiba.horaInicio) }}
        </span>
      </div>
      <div class="crono tnum" :title="`Iniciada a las ${fmtHoraEstiba(estiba.horaInicio)}`">
        {{ transcurrido }}
      </div>
    </header>

    <p class="desc-prod">{{ estiba.descripcion }}</p>

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
