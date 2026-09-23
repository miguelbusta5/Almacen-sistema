<script setup lang="ts">
// Corrección de una recepción ya guardada: cabecera y cantidades. Las horas,
// el cierre y las personas no se tocan aquí.
//
// Su uso principal: poner el tipo de contenedor a las recepciones anteriores
// al 23-09, que se guardaron sin él. Por eso el tipo va primero y, si falta,
// se marca.
import { computed, reactive, ref } from 'vue'
import {
  API_RECEPCION, normalizarPedido, normalizarProveedor, TIPO_CONTENEDOR_LABEL, TIPO_PRODUCTO_LABEL,
  TIPOS_CONTENEDOR, TIPOS_PRODUCTO, validarCorreccionRecepcion,
  type Recepcion, type TipoContenedorRecepcion, type TipoProductoRecepcion,
} from '~/utils/recepcion'

const props = defineProps<{ item: Recepcion }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', r: Recepcion): void }>()

const form = reactive({
  numeroPedido: props.item.numeroPedido,
  proveedor: props.item.proveedor,
  tipoProducto: props.item.tipoProducto as TipoProductoRecepcion,
  tipoContenedor: props.item.tipoContenedor as TipoContenedorRecepcion | null,
  pesoKg: String(props.item.pesoKg),
  referenciasEsperadas: String(props.item.referenciasEsperadas),
  cajas: String(props.item.cajas),
  unidades: String(props.item.unidades),
  motivo: '',
})
const saving = ref(false)
const error = ref('')

/** Solo viaja lo que cambió: es lo que queda en la auditoría. */
const cambios = computed(() => {
  const c: Record<string, unknown> = {}
  if (normalizarPedido(form.numeroPedido) !== props.item.numeroPedido) c.numeroPedido = form.numeroPedido
  if (normalizarProveedor(form.proveedor) !== props.item.proveedor) c.proveedor = form.proveedor
  if (form.tipoProducto !== props.item.tipoProducto) c.tipoProducto = form.tipoProducto
  if (form.tipoContenedor && form.tipoContenedor !== props.item.tipoContenedor) c.tipoContenedor = form.tipoContenedor
  const num = (k: 'pesoKg' | 'referenciasEsperadas' | 'cajas' | 'unidades') => {
    const v = Number(form[k])
    if (form[k] !== '' && v !== props.item[k]) c[k] = v
  }
  num('pesoKg'); num('referenciasEsperadas'); num('cajas'); num('unidades')
  return c
})
const hayCambios = computed(() => Object.keys(cambios.value).length > 0)
const problema = computed(() => (hayCambios.value
  ? validarCorreccionRecepcion({ ...cambios.value, motivo: form.motivo })
  : null))
const puedeGuardar = computed(() => !saving.value && hayCambios.value && !problema.value)

async function submit() {
  if (!puedeGuardar.value) return
  saving.value = true
  error.value = ''
  try {
    const res = await $fetch<{ data: Recepcion }>(`${API_RECEPCION}/${props.item.id}`, {
      method: 'PATCH',
      body: { ...cambios.value, motivo: form.motivo.trim() },
    })
    emit('saved', res.data)
  } catch (e) {
    error.value = apiErr(e, 'No se pudo guardar la corrección')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell
    title="Corregir recepción" :sub="`Pedido ${item.numeroPedido} · ${item.proveedor}`" wide
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <div class="f">
        <span class="lbl">
          Tipo de contenedor
          <b v-if="!item.tipoContenedor" class="falta">sin registrar</b>
        </span>
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

      <div class="row">
        <label class="f">
          <span class="lbl">N.º de pedido</span>
          <input v-model="form.numeroPedido" class="field mono" autocapitalize="characters" :disabled="saving">
        </label>
        <label class="f f-ancho">
          <span class="lbl">Proveedor</span>
          <input v-model="form.proveedor" class="field" :disabled="saving">
        </label>
        <div class="f f-tipo">
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
      </div>

      <div class="row">
        <label class="f">
          <span class="lbl">Peso (kg)</span>
          <input v-model="form.pesoKg" class="field tnum" type="number" min="0" step="0.01" inputmode="decimal" :disabled="saving">
        </label>
        <label class="f">
          <span class="lbl">Referencias</span>
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
      </div>

      <label class="f">
        <span class="lbl">Motivo de la corrección (obligatorio)</span>
        <textarea
          v-model="form.motivo" class="field" rows="2" maxlength="500" :disabled="saving"
          placeholder="Por qué se corrige (mínimo 5 caracteres). Queda en la auditoría."
        />
      </label>

      <p v-if="item.motivoCorreccion" class="hint">Última corrección: «{{ item.motivoCorreccion }}»</p>
      <p v-if="hayCambios && problema" class="warn">{{ problema }}</p>
      <p v-else-if="!hayCambios" class="hint">Cambia al menos un dato para poder guardar.</p>
      <p v-if="error" class="err">{{ error }}</p>

      <div class="acciones">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puedeGuardar">
          <Spinner v-if="saving" :size="14" />{{ saving ? 'Guardando…' : 'Guardar corrección' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
/* En fila se reparten el ancho; sueltos en la columna no deben estirarse en alto. */
.row > .f { flex: 1 1 110px; }
.row > .f-ancho { flex: 2 1 220px; }
.row > .f-tipo { flex: 1 1 190px; }
.lbl { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.falta { font-size: 10px; letter-spacing: .04em; color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 14%, transparent); padding: 2px 7px; border-radius: 999px; }
.segmented { display: flex; border: 1px solid var(--border-strong); border-radius: var(--r-sm); overflow: hidden; height: 38px; }
.seg { flex: 1; background: var(--surface); border: none; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; transition: background .14s, color .14s; }
.seg + .seg { border-left: 1px solid var(--border); }
.seg:hover:not(.on) { background: var(--surface-2); color: var(--ink-2); }
.seg.on { background: var(--brand); color: var(--on-brand); }
.hint { font-size: 11.5px; color: var(--faint); margin: -4px 0 0; }
.warn { font-size: 12px; color: var(--u-aviso); margin: -4px 0 0; }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acciones { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
</style>
