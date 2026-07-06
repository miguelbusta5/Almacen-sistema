<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { Trash2 } from '@lucide/vue'
import { validarCodigoCaja } from '~/utils/gourmet'

interface TiendaOption { codigo: string; tienda: string; ciudad: string }
interface EstibaEscaneada { secuencia: number; cajas: string[] }

const emit = defineEmits<{ (e: 'close'): void; (e: 'created'): void; (e: 'verExistente', id: string): void }>()

const orden = ref('')
const codigoTiendaQuery = ref('')
const tiendaSeleccionada = ref<TiendaOption | null>(null)
const cajasEsperadas = ref('')
const estibasEsperadas = ref('')
const saving = ref(false)
const error = ref('')
const duplicadoId = ref<string | null>(null)

const suggestions = ref<TiendaOption[]>([])
const searchLoading = ref(false)
const showSuggestions = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onCodigoTiendaInput(value: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  codigoTiendaQuery.value = value
  tiendaSeleccionada.value = null

  if (value.trim().toUpperCase() === 'CLIENTE') {
    tiendaSeleccionada.value = { codigo: 'CLIENTE', tienda: 'Cliente final', ciudad: 'CLIENTE' }
    showSuggestions.value = false
    return
  }
  showSuggestions.value = true
  if (!value.trim()) { suggestions.value = []; return }
  debounceTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      const res = await $fetch<{ data: TiendaOption[] }>(`/api/cargue-gourmet/maestro-tiendas?q=${encodeURIComponent(value.trim())}`)
      suggestions.value = res.data ?? []
    } catch { suggestions.value = [] }
    finally { searchLoading.value = false }
  }, 250)
}
function selectTienda(t: TiendaOption) {
  codigoTiendaQuery.value = t.codigo
  tiendaSeleccionada.value = t
  showSuggestions.value = false
}

// Escaneo por estiba: se crea una fila por cada "estibasEsperadas" ingresada.
const estibas = ref<EstibaEscaneada[]>([])
watch(estibasEsperadas, (v) => {
  const n = Number.isInteger(parseInt(v, 10)) && parseInt(v, 10) > 0 ? parseInt(v, 10) : 0
  if (n === estibas.value.length) return
  const next: EstibaEscaneada[] = []
  for (let i = 0; i < n; i++) next.push(estibas.value[i] ?? { secuencia: i + 1, cajas: [] })
  estibas.value = next
})

const tabActivo = ref(0)
const codigoInput = ref('')
const escaneoError = ref('')
const cajasEsperadasNum = computed(() => parseInt(cajasEsperadas.value, 10))
const cajasEsperadasValidas = computed(() => Number.isInteger(cajasEsperadasNum.value) && cajasEsperadasNum.value > 0)
const totalEscaneado = computed(() => estibas.value.reduce((sum, e) => sum + e.cajas.length, 0))
const escaneoCompleto = computed(() => cajasEsperadasValidas.value && totalEscaneado.value === cajasEsperadasNum.value)
const todosLosCodigos = computed(() => estibas.value.flatMap((e) => e.cajas))
const estibaActiva = computed(() => estibas.value[Math.min(tabActivo.value, estibas.value.length - 1)])

// Nota: esto NO es un <form> anidado a propósito — el panel de escaneo vive
// dentro del <form> general del modal, y un <form> dentro de otro es HTML
// inválido (el submit hace bubbling al form exterior). El agregar caja se
// maneja con un botón type="button" + @keydown.enter en el input.
function agregarCaja() {
  const valor = codigoInput.value.trim()
  if (!valor) return
  const r = validarCodigoCaja(valor)
  if (!r.ok) { escaneoError.value = r.error; return }
  if (todosLosCodigos.value.includes(valor)) { escaneoError.value = `"${valor}" ya fue escaneado en otra caja de este pedido.`; return }
  if (cajasEsperadasValidas.value && totalEscaneado.value >= cajasEsperadasNum.value) { escaneoError.value = `Ya se escanearon las ${cajasEsperadasNum.value} cajas esperadas.`; return }

  const idx = Math.min(tabActivo.value, estibas.value.length - 1)
  estibas.value[idx]!.cajas.push(valor)
  escaneoError.value = ''
  codigoInput.value = ''
}
function quitarCaja(estibaIdx: number, cajaIdx: number) {
  estibas.value[estibaIdx]!.cajas.splice(cajaIdx, 1)
}

function handleClose() { if (!saving.value) emit('close') }

async function submit() {
  if (saving.value) return
  error.value = ''
  duplicadoId.value = null

  if (!orden.value.trim()) { error.value = 'La orden es obligatoria'; return }
  if (!tiendaSeleccionada.value) { error.value = 'Selecciona una tienda válida de la lista'; return }
  const cajas = parseInt(cajasEsperadas.value, 10)
  if (!Number.isInteger(cajas) || cajas <= 0) { error.value = 'Cajas esperadas debe ser un entero mayor a 0'; return }
  const estibasCount = parseInt(estibasEsperadas.value, 10)
  if (!Number.isInteger(estibasCount) || estibasCount <= 0) { error.value = 'Estibas esperadas debe ser un entero mayor a 0'; return }
  if (totalEscaneado.value !== cajas) { error.value = `Escanea las ${cajas} caja(s) esperadas antes de crear el pedido (llevas ${totalEscaneado.value}).`; return }

  saving.value = true
  try {
    await $fetch('/api/cargue-gourmet', {
      method: 'POST',
      body: {
        orden: orden.value.trim(),
        codigoTienda: tiendaSeleccionada.value.codigo,
        cajasEsperadas: cajas,
        estibasEsperadas: estibasCount,
        estibas: estibas.value.map((e) => ({ secuencia: e.secuencia, cajas: e.cajas })),
      },
    })
    emit('created')
    emit('close')
  } catch (e: any) {
    const data = e?.data?.data
    if (data?.code === 'ORDEN_DUPLICADA' && data.id) duplicadoId.value = data.id
    error.value = e?.data?.statusMessage || e?.statusMessage || 'No se pudo crear el pedido'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell title="Nuevo pedido Gourmet" sub="Se creará sin ubicación asignada" wide @close="handleClose">
    <form class="form" @submit.prevent="submit">
      <label class="fw">
        <span class="fl">Orden <b>*</b></span>
        <input v-model="orden" class="field" placeholder="Ej. TSDM123456" maxlength="100">
      </label>

      <div class="fw autocomplete">
        <span class="fl">Código tienda <b>*</b></span>
        <input
          :value="codigoTiendaQuery" class="field" autocomplete="off"
          placeholder="Buscar por código, tienda o ciudad… o escribe CLIENTE"
          @input="onCodigoTiendaInput(($event.target as HTMLInputElement).value)"
          @focus="showSuggestions = true"
        >
        <div v-if="showSuggestions && codigoTiendaQuery && !tiendaSeleccionada" class="suggestions">
          <div v-if="searchLoading" class="sugg-item faint">Buscando…</div>
          <div v-else-if="suggestions.length === 0" class="sugg-item faint">Sin coincidencias</div>
          <button v-for="t in suggestions" :key="t.codigo" type="button" class="sugg-item" @click="selectTienda(t)">
            <strong>{{ t.codigo }}</strong> — {{ t.tienda }} <span class="faint">({{ t.ciudad }})</span>
          </button>
        </div>
        <div v-if="tiendaSeleccionada" class="tienda-resuelta">{{ tiendaSeleccionada.tienda }} — {{ tiendaSeleccionada.ciudad }}</div>
      </div>

      <div class="g2">
        <label class="fw"><span class="fl">Cajas esperadas <b>*</b></span><input v-model="cajasEsperadas" type="number" min="1" class="field"></label>
        <label class="fw"><span class="fl">Estibas esperadas <b>*</b></span><input v-model="estibasEsperadas" type="number" min="1" class="field"></label>
      </div>

      <div v-if="estibas.length > 0" class="escaneo">
        <div class="escaneo-head">
          <span class="fl">Escaneo de cajas por estiba</span>
          <span class="mono total" :class="{ ok: escaneoCompleto }">{{ totalEscaneado }}{{ cajasEsperadasValidas ? ` / ${cajasEsperadasNum}` : '' }}</span>
        </div>
        <div class="tabs">
          <button v-for="(e, i) in estibas" :key="e.secuencia" type="button" class="tab" :class="{ active: i === tabActivo }" @click="tabActivo = i; escaneoError = ''">
            Estiba {{ e.secuencia }} ({{ e.cajas.length }})
          </button>
        </div>
        <div class="scan-row">
          <input
            v-model="codigoInput" class="field mono" :placeholder="`Escanea caja para Estiba ${estibaActiva?.secuencia}…`"
            @keydown.enter.prevent="agregarCaja"
          >
          <button type="button" class="btn btn-primary btn-sm" :disabled="!codigoInput.trim()" @click="agregarCaja">Agregar</button>
        </div>
        <p v-if="escaneoError" class="err-msg">{{ escaneoError }}</p>
        <div class="cajas-lista">
          <p v-if="!estibaActiva?.cajas.length" class="faint">Sin cajas escaneadas en esta estiba.</p>
          <div v-for="(c, ci) in estibaActiva?.cajas" :key="`${c}-${ci}`" class="caja-chip">
            <span class="mono">{{ c }}</span>
            <button type="button" class="chip-x" @click="quitarCaja(tabActivo, ci)"><Trash2 :size="11" /></button>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-block">
        <p class="err-msg">{{ error }}</p>
        <button v-if="duplicadoId" type="button" class="btn btn-sm" @click="emit('verExistente', duplicadoId); emit('close')">Editar el pedido existente</button>
      </div>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="handleClose">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving || !escaneoCompleto">
          <Spinner v-if="saving" />{{ saving ? 'Creando…' : 'Crear pedido' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.fw { display: flex; flex-direction: column; gap: 5px; position: relative; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.fl b { color: var(--u-critico); font-weight: 700; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.autocomplete { position: relative; }
.suggestions { position: absolute; z-index: 20; top: 100%; left: 0; right: 0; margin-top: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); max-height: 200px; overflow-y: auto; box-shadow: var(--shadow-md); }
.sugg-item { display: block; width: 100%; text-align: left; padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 13px; color: var(--ink-2); }
.sugg-item:hover { background: var(--surface-2); }
.tienda-resuelta { font-size: 12px; color: var(--muted); margin-top: 4px; }
.faint { color: var(--faint); font-size: 12px; }

.escaneo { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
.escaneo-head { display: flex; align-items: center; justify-content: space-between; }
.total { font-size: 12px; font-weight: 700; color: var(--muted); }
.total.ok { color: var(--u-ok); }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tab { padding: 6px 10px; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); font-size: 12px; cursor: pointer; }
.tab.active { background: var(--brand); color: #06251c; border-color: var(--brand); }
.scan-row { display: flex; gap: 8px; }
.scan-row .field { flex: 1; }
.err-msg { font-size: 12px; color: var(--u-critico); margin: 0; }
.cajas-lista { display: flex; flex-direction: column; gap: 4px; }
.caja-chip { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: var(--surface); border-radius: var(--r-xs); font-size: 13px; }
.chip-x { width: 22px; height: 22px; border-radius: 6px; border: none; background: var(--u-critico-tint); color: var(--u-critico); cursor: pointer; display: grid; place-items: center; }

.error-block { display: flex; flex-direction: column; gap: 8px; }
.factions { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; }
.factions .btn { justify-content: center; }
@media (max-width: 560px) { .g2 { grid-template-columns: 1fr; } }
</style>
