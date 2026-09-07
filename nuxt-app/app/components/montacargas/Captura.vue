<script setup lang="ts">
// Paso 1 del ciclo: registrar el movimiento. Es lo que el montacarguista hace
// decenas de veces al día, con guantes y desde una tablet o con pistola de
// código de barras. Prioridad absoluta a encadenar registros sin soltar el
// teclado.
//
// El mismo componente sirve a los tres flujos: solo cambia si pide ubicación
// inicial (recepción no la tiene: el contenedor llega sin ubicación previa).
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, TriangleAlert } from '@lucide/vue'
import {
  calcularCantidadTotal, esUbicacionCanonica, normalizarCodigoProducto, normalizarUbicacion,
  requiereUbicacionInicial, type FlujoConfig, type ProductoBuscado,
} from '~/utils/montacargas'

const props = defineProps<{ flujo: FlujoConfig; saving: boolean }>()
const emit = defineEmits<{
  (e: 'submit', payload: {
    codigo: string
    cajas: number
    unidadesPorCaja: number
    hayReguero: boolean
    unidadesSueltas: number
    ubicacionInicial?: string
  }): void
  (e: 'dirty', value: boolean): void
}>()

const codigoInput = ref<HTMLInputElement | null>(null)
const cajasInput = ref<HTMLInputElement | null>(null)
const form = reactive({
  codigo: '',
  cajas: '',
  unidadesPorCaja: '',
  hayReguero: false,
  unidadesSueltas: '',
  ubicacionInicial: '',
})

const pideOrigen = computed(() => requiereUbicacionInicial(props.flujo.tipo))

const producto = ref<ProductoBuscado | null>(null)
// PLU cuyas unidades por caja escribió el operario a mano, para no arrastrarlas
// a un producto distinto.
const pluUnidadesManuales = ref('')
// idle → sin código · buscando → lookup en vuelo · ok → producto resuelto
// · nohay → el maestro no lo tiene
const lookupState = ref<'idle' | 'buscando' | 'ok' | 'nohay'>('idle')
// El maestro no trae "Und Emp" para ~71% del catálogo. Cuando falta, el campo se
// habilita para que el operario lo escriba: bloquear pararía 7 de cada 10 capturas.
const unidadesDelMaestro = ref(false)

const dirty = computed(() =>
  Boolean(form.codigo.trim() || form.cajas.trim() || form.unidadesSueltas.trim()),
)
watch(dirty, (v) => emit('dirty', v))

onMounted(() => { codigoInput.value?.focus() })

// Al desmarcar el reguero se limpian las unidades sueltas: dejarlas ahí las
// sumaría al total sin que se vean en pantalla.
watch(() => form.hayReguero, (activo) => { if (!activo) form.unidadesSueltas = '' })

const ubicacionInicialNorm = computed(() => normalizarUbicacion(form.ubicacionInicial))
const origenEsLibre = computed(
  () => Boolean(ubicacionInicialNorm.value) && !esUbicacionCanonica(ubicacionInicialNorm.value),
)

const cantidadTotal = computed(() =>
  calcularCantidadTotal(
    Number(form.cajas || 0),
    Number(form.unidadesPorCaja || 0),
    form.hayReguero ? Number(form.unidadesSueltas || 0) : 0,
  ),
)

async function buscarProducto() {
  const codigo = normalizarCodigoProducto(form.codigo)
  if (!codigo) {
    producto.value = null
    lookupState.value = 'idle'
    return
  }
  lookupState.value = 'buscando'
  try {
    // Busca por PLU **o** por EAN: la pistola lee el código de barras, pero la
    // planilla histórica se llevaba por PLU y algunos productos se teclean.
    const res = await $fetch<{ data: ProductoBuscado }>('/api/productos-maestro/buscar', {
      query: { codigo },
    })
    producto.value = res.data
    lookupState.value = 'ok'
    if (res.data.unidadesPorCaja != null) {
      form.unidadesPorCaja = String(res.data.unidadesPorCaja)
      unidadesDelMaestro.value = true
      pluUnidadesManuales.value = ''
    } else {
      unidadesDelMaestro.value = false
      // Se limpia si las unidades que hay en el campo eran manuales de OTRO
      // producto: como el 71% del maestro no trae "Und Emp", arrastrarlas daría
      // una cantidad total equivocada sin que nadie lo note.
      if (pluUnidadesManuales.value !== res.data.plu) form.unidadesPorCaja = ''
      pluUnidadesManuales.value = res.data.plu
    }
  } catch {
    producto.value = null
    lookupState.value = 'nohay'
    unidadesDelMaestro.value = false
  }
}
const buscarDebounced = useDebounceFn(buscarProducto, 350)

function onCodigoInput() {
  if (!form.codigo.trim()) {
    producto.value = null
    lookupState.value = 'idle'
    unidadesDelMaestro.value = false
    return
  }
  void buscarDebounced()
}

// La pistola teclea el código y manda Enter: se resuelve ya, sin esperar el
// debounce, y el foco salta a cajas para no tocar la pantalla.
async function onCodigoEnter() {
  await buscarProducto()
  if (lookupState.value === 'ok') cajasInput.value?.focus()
}

const cajasNum = computed(() => Number(form.cajas || 0))
const sueltasNum = computed(() => (form.hayReguero ? Number(form.unidadesSueltas || 0) : 0))

const puedeGuardar = computed(() =>
  !props.saving &&
  lookupState.value === 'ok' &&
  Number(form.unidadesPorCaja) >= 1 &&
  // Un registro tiene que mover algo: cajas completas o unidades sueltas.
  (cajasNum.value >= 1 || sueltasNum.value >= 1) &&
  (!form.hayReguero || sueltasNum.value >= 1) &&
  (!pideOrigen.value || Boolean(ubicacionInicialNorm.value)),
)

function submit() {
  if (!puedeGuardar.value) return
  emit('submit', {
    codigo: normalizarCodigoProducto(form.codigo),
    cajas: cajasNum.value,
    unidadesPorCaja: Number(form.unidadesPorCaja),
    hayReguero: form.hayReguero,
    unidadesSueltas: sueltasNum.value,
    ...(pideOrigen.value ? { ubicacionInicial: ubicacionInicialNorm.value } : {}),
  })
}

// El padre lo llama tras cerrar un registro. La ubicación inicial NO se limpia:
// en una tanda de movimientos la mercancía suele salir del mismo sitio.
function reset() {
  form.codigo = ''
  form.cajas = ''
  form.unidadesPorCaja = ''
  form.hayReguero = false
  form.unidadesSueltas = ''
  producto.value = null
  pluUnidadesManuales.value = ''
  lookupState.value = 'idle'
  unidadesDelMaestro.value = false
  codigoInput.value?.focus()
}
defineExpose({ reset })
</script>

<template>
  <section class="captura card">
    <form class="grid" @submit.prevent="submit">
      <label class="f f-codigo">
        <span class="lbl">PLU o código de barras</span>
        <input
          ref="codigoInput" v-model="form.codigo" class="field" placeholder="26403 o 7703596000036"
          inputmode="numeric" autocomplete="off" autocapitalize="characters"
          enterkeyhint="next" :disabled="saving"
          @input="onCodigoInput" @blur="buscarProducto" @keydown.enter.prevent="onCodigoEnter"
        >
      </label>

      <label class="f f-desc">
        <span class="lbl">Descripción</span>
        <div class="desc field" :class="lookupState">
          <Spinner v-if="lookupState === 'buscando'" :size="13" />
          <Search v-else-if="lookupState === 'idle'" :size="13" class="desc-ic" />
          <span v-if="lookupState === 'ok'">{{ producto?.descripcion }}</span>
          <span v-else-if="lookupState === 'nohay'">No está en el maestro</span>
          <span v-else-if="lookupState === 'buscando'">Buscando…</span>
          <span v-else>Se carga desde el maestro</span>
        </div>
      </label>

      <label v-if="pideOrigen" class="f f-origen">
        <span class="lbl">Ubicación inicial</span>
        <input
          v-model="form.ubicacionInicial" class="field" placeholder="05-B-25-03-01"
          autocomplete="off" autocapitalize="characters" :disabled="saving"
        >
        <span v-if="origenEsLibre" class="hint warn-txt">
          <TriangleAlert :size="11" /> Fuera del formato 05-B-25-03-01
        </span>
      </label>

      <label class="f f-cajas">
        <span class="lbl">Cajas master</span>
        <input
          ref="cajasInput" v-model="form.cajas" class="field tnum" type="number" min="0" step="1"
          inputmode="numeric" enterkeyhint="done" :disabled="saving"
        >
      </label>

      <label class="f f-und">
        <span class="lbl">
          Unidades x caja
          <span v-if="unidadesDelMaestro" class="tag-maestro">maestro</span>
        </span>
        <input
          v-model="form.unidadesPorCaja" class="field tnum" type="number" min="1" step="1"
          inputmode="numeric" :disabled="saving"
        >
        <span v-if="lookupState === 'ok' && !unidadesDelMaestro" class="hint warn-txt">
          <TriangleAlert :size="11" /> El maestro no la trae — escríbela
        </span>
      </label>

      <!-- Reguero: unidades sueltas que no vienen en caja master. El campo solo
           aparece con el check marcado, para que nadie meta un número suelto
           por accidente y descuadre la cantidad total. -->
      <div class="f f-reguero">
        <span class="lbl">¿Hay reguero?</span>
        <label class="check">
          <input v-model="form.hayReguero" type="checkbox" :disabled="saving">
          <span>Unidades sueltas sin caja master</span>
        </label>
      </div>

      <label v-if="form.hayReguero" class="f f-sueltas">
        <span class="lbl">Unidades sueltas</span>
        <input
          v-model="form.unidadesSueltas" class="field tnum" type="number" min="1" step="1"
          inputmode="numeric" :disabled="saving"
        >
      </label>

      <div class="f f-total">
        <span class="lbl">Cantidad total</span>
        <div class="total tnum" :class="{ on: cantidadTotal > 0 }">{{ cantidadTotal }}</div>
      </div>

      <div class="f f-btn">
        <button class="btn btn-primary submit" :disabled="!puedeGuardar">
          <Spinner v-if="saving" :size="14" />
          {{ saving ? 'Registrando…' : 'Registrar e iniciar tiempo' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.captura { padding: 16px 18px 18px; border-top: 3px solid var(--brand); }

.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; align-items: start; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.f-codigo { grid-column: span 3; }
.f-desc { grid-column: span 5; }
.f-origen { grid-column: span 4; }
.f-cajas { grid-column: span 2; }
.f-und { grid-column: span 3; }
.f-reguero { grid-column: span 3; }
.f-sueltas { grid-column: span 2; }
.f-total { grid-column: span 2; }
.f-btn { grid-column: span 12; }

.lbl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.tag-maestro { font-size: 9px; font-weight: 700; letter-spacing: .06em; padding: 1px 5px; border-radius: 999px; background: color-mix(in srgb, var(--brand) 16%, transparent); color: var(--brand); }

.check { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 11px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-2); font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.check input { width: 17px; height: 17px; accent-color: var(--brand); cursor: pointer; }

.hint { display: flex; align-items: center; gap: 4px; font-size: 11px; }
.warn-txt { color: var(--u-aviso); }

.desc { display: flex; align-items: center; gap: 7px; background: var(--surface-2); color: var(--faint); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.desc.ok { color: var(--ink); }
.desc.nohay { color: var(--u-aviso); border-color: color-mix(in srgb, var(--u-aviso) 40%, transparent); }
.desc-ic { flex-shrink: 0; }

/* El total es el número que el operario contrasta contra el pallet: grande. */
.total { display: flex; align-items: center; height: 38px; padding: 0 12px; border-radius: var(--r-sm); background: var(--surface-2); font-size: 20px; font-weight: 700; color: var(--faint); }
.total.on { color: var(--brand); }

.submit { width: 100%; justify-content: center; height: 40px; }

/* Captura desde móvil/tablet: una columna, targets grandes y 16px en los inputs
   (por debajo de eso iOS hace zoom automático al enfocar). */
@media (max-width: 980px) {
  .grid { grid-template-columns: 1fr; gap: 10px; }
  .f, .f-codigo, .f-desc, .f-origen, .f-cajas, .f-und, .f-reguero, .f-sueltas, .f-total, .f-btn { grid-column: 1 / -1; }
  .grid :deep(.field) { height: 48px; font-size: 16px; }
  .check { height: 48px; font-size: 15px; }
  .total { height: 48px; font-size: 24px; }
  .submit { height: 50px; font-size: 15px; position: sticky; bottom: 12px; }
}
</style>
