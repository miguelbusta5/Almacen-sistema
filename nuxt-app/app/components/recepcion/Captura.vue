<script setup lang="ts">
// Apertura de la planilla. Todo se pide de golpe porque guardar ARRANCA EL
// RELOJ: abrir a medias dejaría un cronómetro corriendo sobre datos que nadie
// puede interpretar después.
import { ref, reactive, computed, watch } from 'vue'
import { Play, Users } from '@lucide/vue'
import {
  TIPO_CONTENEDOR_LABEL, TIPO_PRODUCTO_LABEL, TIPOS_CONTENEDOR, TIPOS_PRODUCTO, validarApertura,
  type TipoContenedorRecepcion, type TipoProductoRecepcion,
} from '~/utils/recepcion'

interface Descargador { id: string; nombre: string; rol: string }

const props = defineProps<{
  descargadores: Descargador[]
  saving: boolean
}>()
const emit = defineEmits<{
  (e: 'submit', payload: {
    numeroPedido: string
    proveedor: string
    tipoProducto: TipoProductoRecepcion
    tipoContenedor: TipoContenedorRecepcion
    pesoKg: number
    referenciasEsperadas: number
    cajas: number
    unidades: number
    descargadores: string[]
  }): void
  (e: 'dirty', v: boolean): void
}>()

const form = reactive({
  numeroPedido: '',
  proveedor: '',
  tipoProducto: 'GOURMET' as TipoProductoRecepcion,
  // Sin valor por defecto: el contenedor se elige, no se asume.
  tipoContenedor: null as TipoContenedorRecepcion | null,
  pesoKg: '',
  referenciasEsperadas: '',
  cajas: '',
  unidades: '',
})
const seleccionados = ref<string[]>([])
const listaAbierta = ref(false)

const payload = computed(() => ({
  numeroPedido: form.numeroPedido,
  proveedor: form.proveedor,
  tipoProducto: form.tipoProducto,
  tipoContenedor: form.tipoContenedor,
  pesoKg: Number(form.pesoKg || 0),
  referenciasEsperadas: Number(form.referenciasEsperadas || 0),
  cajas: Number(form.cajas || 0),
  unidades: Number(form.unidades || 0),
  descargadores: seleccionados.value,
}))

const error = computed(() => validarApertura(payload.value))
const puedeGuardar = computed(() => !props.saving && !error.value)

// Avisa al módulo de que hay trabajo a medias: el auto-refresh no debe
// re-renderizar y robarle al operario lo que está escribiendo.
const sucio = computed(() => Boolean(
  form.numeroPedido || form.proveedor || form.tipoContenedor || form.pesoKg || form.referenciasEsperadas
  || form.cajas || form.unidades || seleccionados.value.length,
))
watch(sucio, (v) => emit('dirty', v))

const nombresSeleccionados = computed(() =>
  props.descargadores.filter((d) => seleccionados.value.includes(d.id)).map((d) => d.nombre),
)

function alternar(id: string) {
  const i = seleccionados.value.indexOf(id)
  if (i >= 0) seleccionados.value.splice(i, 1)
  else seleccionados.value.push(id)
}

function enviar() {
  if (!puedeGuardar.value) return
  emit('submit', { ...payload.value, tipoContenedor: form.tipoContenedor! })
}

function reset() {
  form.numeroPedido = ''
  form.proveedor = ''
  form.tipoProducto = 'GOURMET'
  form.tipoContenedor = null
  form.pesoKg = ''
  form.referenciasEsperadas = ''
  form.cajas = ''
  form.unidades = ''
  seleccionados.value = []
  listaAbierta.value = false
}
defineExpose({ reset })
</script>

<template>
  <section class="card cap">
    <header class="cap-head">
      <h2 class="cap-title">Nuevo contenedor</h2>
      <p class="cap-sub">Al guardar arranca el cronómetro de la descarga.</p>
    </header>

    <form class="grid" @submit.prevent="enviar">
      <label class="f f-pedido">
        <span class="lbl">N.º de pedido</span>
        <input
          v-model="form.numeroPedido" class="field mono" placeholder="PEDDM11887"
          autocomplete="off" autocapitalize="characters" :disabled="saving"
        >
      </label>

      <label class="f f-prov">
        <span class="lbl">Proveedor</span>
        <input v-model="form.proveedor" class="field" placeholder="Nombre del proveedor" :disabled="saving">
      </label>

      <div class="f">
        <span class="lbl">Tipo de producto</span>
        <div class="segmented">
          <button
            v-for="t in TIPOS_PRODUCTO" :key="t" type="button" class="seg"
            :class="{ on: form.tipoProducto === t }" :disabled="saving"
            @click="form.tipoProducto = t"
          >
            {{ TIPO_PRODUCTO_LABEL[t] }}
          </button>
        </div>
      </div>

      <div class="f f-contenedor">
        <span class="lbl">Tipo de contenedor</span>
        <div class="segmented" role="radiogroup" aria-label="Tipo de contenedor">
          <button
            v-for="t in TIPOS_CONTENEDOR" :key="t" type="button" class="seg"
            role="radio" :aria-checked="form.tipoContenedor === t"
            :class="{ on: form.tipoContenedor === t }" :disabled="saving"
            @click="form.tipoContenedor = t"
          >
            {{ TIPO_CONTENEDOR_LABEL[t] }}
          </button>
        </div>
      </div>

      <label class="f">
        <span class="lbl">Peso del contenedor (kg)</span>
        <input v-model="form.pesoKg" class="field tnum" type="number" min="0" step="0.01" inputmode="decimal" :disabled="saving">
      </label>

      <label class="f">
        <span class="lbl">Referencias a recibir</span>
        <input v-model="form.referenciasEsperadas" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="saving">
      </label>

      <label class="f">
        <span class="lbl">Cajas</span>
        <input v-model="form.cajas" class="field tnum" type="number" min="0" inputmode="numeric" :disabled="saving">
      </label>

      <label class="f">
        <span class="lbl">Unidades</span>
        <input v-model="form.unidades" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="saving">
      </label>

      <!-- Personas descargando: son usuarios reales, no texto libre, para poder
           repartir el trabajo por persona en los indicadores. -->
      <div class="f f-personas">
        <span class="lbl">Personas descargando</span>
        <button type="button" class="field selector" :disabled="saving" @click="listaAbierta = !listaAbierta">
          <Users :size="14" />
          <span v-if="nombresSeleccionados.length" class="sel-txt">
            {{ nombresSeleccionados.join(', ') }}
          </span>
          <span v-else class="sel-vacio">Selecciona quiénes descargan</span>
          <b v-if="seleccionados.length" class="sel-n tnum">{{ seleccionados.length }}</b>
        </button>
        <div v-if="listaAbierta" class="personas">
          <label v-for="d in descargadores" :key="d.id" class="persona">
            <input type="checkbox" :checked="seleccionados.includes(d.id)" @change="alternar(d.id)">
            <span class="p-nom">{{ d.nombre }}</span>
            <span class="p-rol">{{ d.rol === 'MONTACARGAS' ? 'Montacarguista' : 'Operario' }}</span>
          </label>
          <p v-if="!descargadores.length" class="p-vacio">No hay personal disponible</p>
        </div>
      </div>

      <div class="f f-submit">
        <span v-if="error" class="err">{{ error }}</span>
        <button class="btn btn-primary submit" :disabled="!puedeGuardar">
          <Spinner v-if="saving" :size="15" /><Play v-else :size="15" />
          Iniciar recepción
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.cap { padding: 16px 18px 18px; }
.cap-head { margin-bottom: 14px; }
.cap-title { margin: 0; font-family: var(--display); font-size: 16px; font-weight: 700; color: var(--ink); }
.cap-sub { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }

.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 13px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.f-pedido { grid-column: span 1; }
.f-prov { grid-column: span 2; }
.f-contenedor { grid-column: span 2; }
.f-personas { grid-column: 1 / -1; position: relative; }
.f-submit { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: flex-end; gap: 12px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.err { font-size: 12.5px; color: var(--u-aviso); margin-right: auto; }
.submit { height: 40px; padding: 0 20px; }

/* Gourmet / Muebles: dos opciones, siempre visibles. Un desplegable esconde la
   mitad de la decisión y obliga a un toque de más con guantes puestos. */
.segmented { display: flex; gap: 0; border: 1px solid var(--border-strong); border-radius: var(--r-sm); overflow: hidden; height: 38px; }
.seg { flex: 1; background: var(--surface); border: none; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; transition: background .14s, color .14s; }
.seg + .seg { border-left: 1px solid var(--border); }
.seg:hover:not(.on) { background: var(--surface-2); color: var(--ink-2); }
.seg.on { background: var(--brand); color: var(--on-brand); }

.selector { display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer; }
.sel-txt { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
.sel-vacio { flex: 1; color: var(--faint); }
.sel-n { flex-shrink: 0; color: var(--brand); }
.personas {
  position: absolute; z-index: 12; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 250px; overflow-y: auto; padding: 6px;
  background: var(--surface); border: 1px solid var(--border-strong);
  border-radius: var(--r-sm); box-shadow: var(--shadow-lg);
}
.persona { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: var(--r-xs); cursor: pointer; }
.persona:hover { background: var(--surface-3); }
.p-nom { flex: 1; font-size: 13px; color: var(--ink-2); }
.p-rol { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--faint); }
.p-vacio { margin: 0; padding: 10px; font-size: 12.5px; color: var(--muted); }

@media (max-width: 900px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
  .f-prov { grid-column: span 2; }
  .f-submit { flex-direction: column; align-items: stretch; }
  .submit { width: 100%; height: 46px; }
  .grid :deep(.field) { height: 44px; font-size: 16px; }
}
</style>
