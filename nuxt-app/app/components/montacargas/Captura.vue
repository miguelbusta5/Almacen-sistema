<script setup lang="ts">
// Paso 1: abrir el registro. Basta con el PLU (y de donde sale la mercancia, si
// el tipo lo pide): EL RELOJ ARRANCA AQUI. Las cantidades se completan despues,
// ya con el cronometro corriendo, en la tarjeta del registro abierto.
//
// Es lo que el montacarguista hace decenas de veces al dia, con guantes y desde
// una tablet o con pistola: prioridad absoluta a encadenar sin soltar el teclado.
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, TriangleAlert, Play } from '@lucide/vue'
import {
  esUbicacionCanonica, normalizarCodigoProducto, normalizarUbicacion,
  requiereUbicacionInicial, type FlujoConfig, type ProductoBuscado,
} from '~/utils/montacargas'

const props = defineProps<{ flujo: FlujoConfig; saving: boolean }>()
const emit = defineEmits<{
  (e: 'submit', payload: { codigo: string; ubicacionInicial?: string }): void
  (e: 'dirty', value: boolean): void
}>()

const codigoInput = ref<HTMLInputElement | null>(null)
const form = reactive({ codigo: '', ubicacionInicial: '' })

const pideOrigen = computed(() => requiereUbicacionInicial(props.flujo.tipo))

const producto = ref<ProductoBuscado | null>(null)
// idle -> sin codigo · buscando -> lookup en vuelo · ok -> producto resuelto
// · nohay -> el maestro no lo tiene
const lookupState = ref<'idle' | 'buscando' | 'ok' | 'nohay'>('idle')

const dirty = computed(() => Boolean(form.codigo.trim()))
watch(dirty, (v) => emit('dirty', v))

onMounted(() => { codigoInput.value?.focus() })

const ubicacionInicialNorm = computed(() => normalizarUbicacion(form.ubicacionInicial))
const origenEsLibre = computed(
  () => Boolean(ubicacionInicialNorm.value) && !esUbicacionCanonica(ubicacionInicialNorm.value),
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
    // Busca por PLU **o** por EAN: la pistola lee el codigo de barras, pero la
    // planilla historica se llevaba por PLU y algunos productos se teclean.
    const res = await $fetch<{ data: ProductoBuscado }>('/api/productos-maestro/buscar', {
      query: { codigo },
    })
    producto.value = res.data
    lookupState.value = 'ok'
  } catch {
    producto.value = null
    lookupState.value = 'nohay'
  }
}
const buscarDebounced = useDebounceFn(buscarProducto, 350)

function onCodigoInput() {
  if (!form.codigo.trim()) {
    producto.value = null
    lookupState.value = 'idle'
    return
  }
  void buscarDebounced()
}

const puedeAbrir = computed(() =>
  !props.saving &&
  lookupState.value === 'ok' &&
  (!pideOrigen.value || Boolean(ubicacionInicialNorm.value)),
)

// La pistola teclea el codigo y manda Enter. Si ya esta todo, arranca el reloj
// sin tocar la pantalla; si falta el origen, salta ahi.
async function onCodigoEnter() {
  await buscarProducto()
  if (puedeAbrir.value) submit()
}

function submit() {
  if (!puedeAbrir.value) return
  emit('submit', {
    codigo: normalizarCodigoProducto(form.codigo),
    ...(pideOrigen.value ? { ubicacionInicial: ubicacionInicialNorm.value } : {}),
  })
}

// El padre lo llama tras abrir. La ubicacion inicial NO se limpia: en una tanda
// de movimientos la mercancia suele salir del mismo sitio.
function reset() {
  form.codigo = ''
  producto.value = null
  lookupState.value = 'idle'
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
          enterkeyhint="go" :disabled="saving"
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

      <div class="f f-btn">
        <button class="btn btn-primary submit" :disabled="!puedeAbrir">
          <Spinner v-if="saving" :size="14" /><Play v-else :size="14" />
          {{ saving ? 'Abriendo…' : 'Iniciar tiempo' }}
        </button>
      </div>
    </form>
    <p class="nota">El reloj arranca al iniciar. Las cantidades se completan enseguida.</p>
  </section>
</template>

<style scoped>
.captura { padding: 16px 18px 14px; border-top: 3px solid var(--brand); }

.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; align-items: start; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.f-codigo { grid-column: span 3; }
.f-desc { grid-column: span 4; }
.f-origen { grid-column: span 3; }
.f-btn { grid-column: span 2; justify-content: flex-end; }

.lbl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { display: flex; align-items: center; gap: 4px; font-size: 11px; }
.warn-txt { color: var(--u-aviso); }

.desc { display: flex; align-items: center; gap: 7px; background: var(--surface-2); color: var(--faint); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.desc.ok { color: var(--ink); }
.desc.nohay { color: var(--u-aviso); border-color: color-mix(in srgb, var(--u-aviso) 40%, transparent); }
.desc-ic { flex-shrink: 0; }

.submit { width: 100%; justify-content: center; height: 38px; }
.nota { margin: 10px 0 0; font-size: 11.5px; color: var(--faint); }

@media (max-width: 980px) {
  .grid { grid-template-columns: 1fr; gap: 10px; }
  .f, .f-codigo, .f-desc, .f-origen, .f-btn { grid-column: 1 / -1; }
  .grid :deep(.field) { height: 48px; font-size: 16px; }
  .submit { height: 50px; font-size: 15px; }
}
</style>
