<script setup lang="ts">
// Card de captura: el flujo que ETIQUETADO usa todo el día, a menudo desde móvil.
// Prioridad absoluta a encadenar cajas sin soltar el teclado.
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { CheckCircle2, Search } from '@lucide/vue'
import { fmtHoraExport, normalizePlu, type Exportacion } from '~/utils/exportaciones'

const props = defineProps<{
  accent: string
  saving: boolean
  abierto: Exportacion | null
  finalizing: boolean
}>()
const emit = defineEmits<{
  (e: 'submit', payload: { numeroCaja: string; plu: string; unidadEmpaque: number }): void
  (e: 'finalize'): void
  (e: 'dirty', value: boolean): void
}>()

const cajaInput = ref<HTMLInputElement | null>(null)
const form = reactive({ numeroCaja: '', plu: '', unidadEmpaque: '1' })
const descripcion = ref('')
// idle → el PLU está vacío · buscando → lookup en vuelo · ok → descripción resuelta
// · nohay → el maestro no lo tiene (avisa, pero NO bloquea: el servidor decide)
const lookupState = ref<'idle' | 'buscando' | 'ok' | 'nohay'>('idle')
const okFlash = ref(false)

const dirty = computed(() => !!(form.numeroCaja.trim() || form.plu.trim()))
watch(dirty, (v) => emit('dirty', v))

// Cronómetro del registro abierto: refuerza al operario que el tiempo corre.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tick = setInterval(() => { ahora.value = Date.now() }, 30_000)
  cajaInput.value?.focus()
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const minutosAbierto = computed(() => {
  if (!props.abierto) return 0
  return Math.max(0, Math.round((ahora.value - new Date(props.abierto.horaInicio).getTime()) / 60000))
})

// Lookup con debounce mientras escribe, además de en blur. La versión React solo
// buscaba en blur: en móvil, si el operario pulsaba Guardar sin desenfocar, nunca
// llegaba a ver la descripción.
async function buscarDescripcion() {
  const plu = normalizePlu(form.plu)
  if (!plu) { descripcion.value = ''; lookupState.value = 'idle'; return }
  lookupState.value = 'buscando'
  try {
    const res = await $fetch<{ data?: { descripcion?: string } }>(`/api/productos-maestro/${encodeURIComponent(plu)}`)
    const d = res?.data?.descripcion?.trim() ?? ''
    descripcion.value = d
    lookupState.value = d ? 'ok' : 'nohay'
  } catch {
    descripcion.value = ''
    lookupState.value = 'nohay'
  }
}
const buscarDebounced = useDebounceFn(buscarDescripcion, 350)

function onPluInput() {
  if (!form.plu.trim()) { descripcion.value = ''; lookupState.value = 'idle'; return }
  void buscarDebounced()
}

const puedeGuardar = computed(() =>
  !props.saving && !!form.numeroCaja.trim() && !!form.plu.trim() && Number(form.unidadEmpaque) >= 1,
)

function submit() {
  if (!puedeGuardar.value) return
  emit('submit', {
    numeroCaja: form.numeroCaja.trim(),
    plu: normalizePlu(form.plu),
    unidadEmpaque: Number(form.unidadEmpaque),
  })
}

// El padre llama a esto tras un POST con éxito. `unidadEmpaque` NO se resetea: el
// empaque se repite por lote y volver a "1" obliga a reescribirlo en cada caja.
function reset() {
  form.numeroCaja = ''
  form.plu = ''
  descripcion.value = ''
  lookupState.value = 'idle'
  okFlash.value = true
  setTimeout(() => { okFlash.value = false }, 600)
  cajaInput.value?.focus()
}
defineExpose({ reset })
</script>

<template>
  <section class="captura card" :class="{ flash: okFlash }" :style="{ '--pais': accent }">
    <!-- Banner de registro en curso. Se alimenta de /abierto, no de la lista, así
         que sobrevive a filtros y paginación. -->
    <div v-if="abierto" class="abierto">
      <span class="pulse" />
      <div class="abierto-txt">
        <b>Registro en curso</b>
        <span class="abierto-det">
          Caja {{ abierto.numeroCaja }} · PLU {{ abierto.plu }} ·
          desde {{ fmtHoraExport(abierto.horaInicio) }}
          <span class="crono tnum">({{ minutosAbierto }} min)</span>
        </span>
      </div>
      <button class="btn btn-sm finalizar" :disabled="finalizing" @click="emit('finalize')">
        <Spinner v-if="finalizing" :size="13" /><CheckCircle2 v-else :size="13" />
        {{ finalizing ? 'Finalizando…' : 'Finalizar rotulación' }}
      </button>
    </div>

    <form class="grid" @submit.prevent="submit">
      <label class="f">
        <span class="lbl">N° de caja</span>
        <input
          ref="cajaInput" v-model="form.numeroCaja" class="field" placeholder="A-114"
          autocomplete="off" autocapitalize="characters" enterkeyhint="next" :disabled="saving"
        >
      </label>

      <label class="f">
        <span class="lbl">PLU</span>
        <input
          v-model="form.plu" class="field" placeholder="4011" inputmode="numeric"
          autocomplete="off" enterkeyhint="done" :disabled="saving"
          @input="onPluInput" @blur="buscarDescripcion"
        >
      </label>

      <label class="f f-desc">
        <span class="lbl">Descripción</span>
        <div class="desc field" :class="lookupState">
          <Spinner v-if="lookupState === 'buscando'" :size="13" />
          <Search v-else-if="lookupState === 'idle'" :size="13" class="desc-ic" />
          <span v-if="lookupState === 'ok'">{{ descripcion }}</span>
          <span v-else-if="lookupState === 'nohay'">PLU no encontrado en el maestro</span>
          <span v-else-if="lookupState === 'buscando'">Buscando…</span>
          <span v-else>Se carga desde el maestro</span>
        </div>
      </label>

      <label class="f f-emp">
        <span class="lbl">Unidad de empaque</span>
        <input v-model="form.unidadEmpaque" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="saving">
      </label>

      <div class="f f-btn">
        <button class="btn btn-primary submit" :disabled="!puedeGuardar">
          <Spinner v-if="saving" :size="14" />
          {{ saving ? 'Guardando…' : 'Guardar y comenzar siguiente' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.captura { padding: 16px 18px 18px; border-top: 3px solid var(--pais); transition: box-shadow .2s; }
.captura.flash { box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-ok) 55%, transparent); }

.abierto {
  display: flex; align-items: center; gap: 11px; flex-wrap: wrap;
  padding: 10px 13px; margin-bottom: 15px; border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--pais) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--pais) 32%, transparent);
}
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--info); flex-shrink: 0; animation: auroraPulse 1.8s ease-in-out infinite; }
.abierto-txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.abierto-txt b { font-size: 12.5px; color: var(--ink); }
.abierto-det { font-size: 12px; color: var(--muted); }
.crono { color: var(--ink-2); font-weight: 700; }
.finalizar { border-color: color-mix(in srgb, var(--pais) 45%, transparent); color: var(--pais); }

.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; align-items: end; }
.f { display: flex; flex-direction: column; gap: 5px; grid-column: span 2; min-width: 0; }
.f-desc { grid-column: span 4; }
.f-emp { grid-column: span 2; }
.f-btn { grid-column: span 12; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }

.desc { display: flex; align-items: center; gap: 7px; background: var(--surface-2); color: var(--faint); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.desc.ok { color: var(--ink); }
.desc.nohay { color: var(--u-aviso); border-color: color-mix(in srgb, var(--u-aviso) 40%, transparent); }
.desc-ic { flex-shrink: 0; }

.submit { width: 100%; justify-content: center; height: 40px; }

/* Captura desde móvil/tablet: una columna, targets grandes y 16px en los inputs
   (por debajo de eso iOS hace zoom automático al enfocar). */
@media (max-width: 700px) {
  .grid { grid-template-columns: 1fr; gap: 10px; }
  .f, .f-desc, .f-emp, .f-btn { grid-column: 1 / -1; }
  .grid :deep(.field) { height: 48px; font-size: 16px; }
  .submit { height: 50px; font-size: 15px; position: sticky; bottom: 12px; }
}
</style>
