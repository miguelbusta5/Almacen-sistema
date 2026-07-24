<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { Package, User, MapPin, FileText, Info } from '@lucide/vue'
import { todayISO, type Guardado } from '~/utils/guardado'

const props = defineProps<{ guardado?: Guardado | null; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', g: Partial<Guardado>): void }>()

const isEdit = computed(() => !!props.guardado)
const f = reactive({
  fecha: props.guardado?.fecha ?? todayISO(),
  documento: props.guardado?.documento ?? '',
  ubicacion: props.guardado?.ubicacion ?? '',
  tipo: props.guardado?.tipo ?? 'COMUN',
  estado: props.guardado?.estado ?? 'PENDIENTE DESPACHO',
  fechaDespacho: props.guardado?.fechaDespacho ?? '',
  ciudad: props.guardado?.ciudad ?? '',
  codigoTienda: props.guardado?.codigoTienda ?? '',
  nombreTienda: props.guardado?.nombreTienda ?? '',
  clienteNombre: props.guardado?.clienteNombre ?? '',
  clienteDocumento: props.guardado?.clienteDocumento ?? '',
  nota: props.guardado?.nota ?? '',
})
const touched = ref(false)
// Los campos de cliente solo son obligatorios al crear — los guardados
// registrados antes de este feature no los tienen, y no deben bloquear
// ediciones de rutina (ubicación, estado, nota) mientras no se rellenen.
const missingBasic = computed(() => !f.fecha || !f.documento.trim() || !f.ubicacion.trim())
const missingCliente = computed(() => !f.clienteNombre.trim() || !f.clienteDocumento.trim())
const missing = computed(() => missingBasic.value || (!isEdit.value && missingCliente.value))

// ── Buscador de tienda (catálogo Cargue Gourmet, MaestroTiendaGourmet) ──────
// Mismo patrón que CrearPedidoModal.tsx (Cargue Gourmet): buscar por
// código/tienda/ciudad, debounced, y bloquear ciudad+nombre al seleccionar.
// Si el usuario borra o edita el texto tras seleccionar, se libera la
// tienda y el campo ciudad vuelve a ser editable manualmente (tiendas fuera
// de catálogo, ej. Institucional).
interface TiendaOption { codigo: string; tienda: string; ciudad: string }
const tiendaQuery = ref(f.codigoTienda ? `${f.codigoTienda} — ${f.nombreTienda}` : '')
const tiendaSeleccionada = ref<TiendaOption | null>(
  f.codigoTienda ? { codigo: f.codigoTienda, tienda: f.nombreTienda, ciudad: f.ciudad } : null
)
const suggestions = ref<TiendaOption[]>([])
const showSuggestions = ref(false)
const searchError = ref('')
let debounceHandle: ReturnType<typeof setTimeout> | null = null
const SEARCH_DEBOUNCE_MS = 250

function onTiendaQueryChange(value: string) {
  if (debounceHandle) clearTimeout(debounceHandle)
  tiendaQuery.value = value
  tiendaSeleccionada.value = null
  f.codigoTienda = ''
  f.nombreTienda = ''
  searchError.value = ''
  if (!value.trim()) { suggestions.value = []; showSuggestions.value = false; return }
  debounceHandle = setTimeout(async () => {
    try {
      const res = await $fetch<{ data: TiendaOption[] }>('/api/cargue-gourmet/maestro-tiendas', { query: { q: value.trim() } })
      suggestions.value = res.data
      showSuggestions.value = true
    } catch {
      searchError.value = 'No se pudo buscar tiendas'
      suggestions.value = []
    }
  }, SEARCH_DEBOUNCE_MS)
}

function selectTienda(t: TiendaOption) {
  tiendaSeleccionada.value = t
  tiendaQuery.value = `${t.codigo} — ${t.tienda}`
  f.codigoTienda = t.codigo
  f.nombreTienda = t.tienda
  f.ciudad = t.ciudad
  showSuggestions.value = false
}

function limpiarTienda() {
  tiendaQuery.value = ''
  tiendaSeleccionada.value = null
  f.codigoTienda = ''
  f.nombreTienda = ''
  suggestions.value = []
  showSuggestions.value = false
}

function submit() {
  if (props.saving) return
  touched.value = true
  if (missing.value) return
  emit('saved', { ...f } as Partial<Guardado>)
}
</script>

<template>
  <ModalShell
    :title="isEdit ? 'Editar guardado' : 'Nuevo guardado'"
    :sub="isEdit ? `${guardado!.documento} · ${guardado!.ubicacion}` : 'Registra mercancía en custodia de bodega'"
    wide @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><Package :size="13" /></span> Información del guardado</div>
        <div class="g2">
          <label class="fw">
            <span class="fl">Fecha de ingreso <b>*</b></span>
            <input v-model="f.fecha" type="date" class="field" :class="{ err: touched && !f.fecha }">
          </label>
          <label class="fw">
            <span class="fl">Tipo</span>
            <select v-model="f.tipo" class="field"><option value="COMUN">Común</option><option value="ECOMMERCE">Ecommerce</option></select>
          </label>
        </div>
        <label class="fw">
          <span class="fl">N° Documento <b>*</b></span>
          <input v-model="f.documento" class="field" :class="{ err: touched && !f.documento.trim() }" placeholder="Factura / remisión">
          <span v-if="touched && !f.documento.trim()" class="fe">El documento es obligatorio</span>
        </label>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><User :size="13" /></span> Cliente</div>
        <div class="g2">
          <label class="fw">
            <span class="fl">Nombre del cliente <b v-if="!isEdit">*</b></span>
            <input v-model="f.clienteNombre" class="field" :class="{ err: touched && !isEdit && !f.clienteNombre.trim() }" placeholder="Nombre completo">
            <span v-if="touched && !isEdit && !f.clienteNombre.trim()" class="fe">El nombre del cliente es obligatorio</span>
          </label>
          <label class="fw">
            <span class="fl">Documento de identidad <b v-if="!isEdit">*</b></span>
            <input v-model="f.clienteDocumento" class="field" :class="{ err: touched && !isEdit && !f.clienteDocumento.trim() }" placeholder="Cédula / NIT">
            <span v-if="touched && !isEdit && !f.clienteDocumento.trim()" class="fe">El documento del cliente es obligatorio</span>
          </label>
        </div>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><MapPin :size="13" /></span> Ubicación y destino</div>
        <label class="fw">
          <span class="fl">Ubicación en bodega <b>*</b></span>
          <input v-model="f.ubicacion" class="field" :class="{ err: touched && !f.ubicacion.trim() }" placeholder="Pasillo, estante, nivel…">
        </label>

        <label class="fw" style="position: relative;">
          <span class="fl">Tienda (catálogo Cargue Gourmet)</span>
          <input
            :value="tiendaQuery" class="field"
            placeholder="Buscar por código, tienda o ciudad…"
            @input="onTiendaQueryChange(($event.target as HTMLInputElement).value)"
            @focus="showSuggestions = suggestions.length > 0"
          >
          <div v-if="showSuggestions && tiendaQuery && !tiendaSeleccionada" class="tienda-suggestions">
            <div v-if="!suggestions.length" class="tienda-empty">Sin resultados</div>
            <button
              v-for="t in suggestions" :key="t.codigo" type="button" class="tienda-option"
              @click="selectTienda(t)"
            >
              <strong>{{ t.codigo }}</strong> — {{ t.tienda }} <span class="tienda-ciudad">({{ t.ciudad }})</span>
            </button>
          </div>
          <span v-if="searchError" class="fe">{{ searchError }}</span>
          <div v-if="tiendaSeleccionada" class="tienda-resuelta">
            {{ tiendaSeleccionada.tienda }} — {{ tiendaSeleccionada.ciudad }}
            <button type="button" class="tienda-clear" @click="limpiarTienda">Quitar</button>
          </div>
        </label>

        <div class="g2">
          <label class="fw">
            <span class="fl">Ciudad destino</span>
            <input v-model="f.ciudad" class="field" placeholder="Ciudad (autocompleta al elegir tienda)">
          </label>
          <label class="fw">
            <span class="fl">Estado</span>
            <select v-model="f.estado" class="field"><option value="PENDIENTE DESPACHO">Pendiente despacho</option><option value="DESPACHADO">Despachado</option></select>
          </label>
        </div>
        <label v-if="f.estado === 'DESPACHADO'" class="fw">
          <span class="fl">Fecha despacho</span>
          <input v-model="f.fechaDespacho" type="date" class="field">
        </label>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><FileText :size="13" /></span> Nota</div>
        <textarea v-model="f.nota" rows="2" class="field" placeholder="Incluye la fecha de entrega, ej. 15/06/2026" />
        <div class="hint"><Info :size="12" /> Si la nota incluye una fecha DD/MM/AAAA, se usará como entrega comprometida.</div>
      </section>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving || (touched && missing)">
          <Spinner v-if="saving" />
          {{ saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Registrar guardado') }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.fsec { display: flex; flex-direction: column; gap: 11px; padding: 14px 14px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
.fsec-title { display: flex; align-items: center; gap: 9px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
.fsec-ic { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; background: var(--brand-tint); color: var(--brand-deep); }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.fw { display: flex; flex-direction: column; gap: 5px; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.fl b { color: var(--u-critico); font-weight: 700; }
.fe { font-size: 11px; font-weight: 600; color: var(--u-critico); }
.field.err { border-color: var(--u-critico); box-shadow: 0 0 0 3px var(--u-critico-tint); }
.hint { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
.tienda-suggestions { position: absolute; top: 100%; left: 0; right: 0; z-index: 20; margin-top: 4px; max-height: 220px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: 0 8px 24px rgba(0,0,0,.18); }
.tienda-option { display: block; width: 100%; text-align: left; padding: 8px 10px; font-size: 12.5px; background: none; border: none; cursor: pointer; color: var(--ink); }
.tienda-option:hover { background: var(--surface-2); }
.tienda-ciudad { color: var(--muted); }
.tienda-empty { padding: 8px 10px; font-size: 12px; color: var(--muted); }
.tienda-resuelta { margin-top: 6px; font-size: 12px; color: var(--muted2, var(--muted)); display: flex; align-items: center; gap: 8px; }
.tienda-clear { font-size: 11px; font-weight: 600; color: var(--brand-deep); background: none; border: none; cursor: pointer; padding: 0; }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
@media (max-width: 560px) { .g2 { grid-template-columns: 1fr; } }
</style>
