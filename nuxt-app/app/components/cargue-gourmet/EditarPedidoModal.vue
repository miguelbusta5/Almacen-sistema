<script setup lang="ts">
import { ref } from 'vue'
import { ClipboardList, Boxes } from '@lucide/vue'
import type { PedidoGourmet } from '~/utils/gourmet'

interface TiendaOption { codigo: string; tienda: string; ciudad: string }

const props = defineProps<{ p: PedidoGourmet; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', payload: Record<string, unknown>): void }>()

const orden = ref(props.p.orden)
const codigoTiendaQuery = ref(props.p.codigoTienda)
const tiendaSeleccionada = ref<TiendaOption | null>({ codigo: props.p.codigoTienda, tienda: props.p.nombreTienda, ciudad: props.p.ciudadDestino })
const cajasEsperadas = ref(String(props.p.cajasEsperadas))
const estibasEsperadas = ref(String(props.p.estibasEsperadas))
const error = ref('')

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
function selectTienda(t: TiendaOption) { codigoTiendaQuery.value = t.codigo; tiendaSeleccionada.value = t; showSuggestions.value = false }

function submit() {
  error.value = ''
  if (!orden.value.trim()) { error.value = 'La orden es obligatoria'; return }
  if (!tiendaSeleccionada.value) { error.value = 'Selecciona una tienda válida de la lista'; return }
  const cajas = parseInt(cajasEsperadas.value, 10)
  if (!Number.isInteger(cajas) || cajas <= 0) { error.value = 'Cajas esperadas debe ser un entero mayor a 0'; return }
  const estibas = parseInt(estibasEsperadas.value, 10)
  if (!Number.isInteger(estibas) || estibas <= 0) { error.value = 'Estibas esperadas debe ser un entero mayor a 0'; return }

  emit('saved', {
    orden: orden.value.trim(),
    codigoTienda: tiendaSeleccionada.value.codigo,
    cajasEsperadas: cajas,
    estibasEsperadas: estibas,
    updatedAt: props.p.updatedAt,
  })
}
</script>

<template>
  <ModalShell title="Editar pedido Gourmet" :sub="`${p.tipoOrden} ${p.orden}`" wide @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><ClipboardList :size="13" /></span> Datos del pedido</div>
        <label class="fw"><span class="fl">Orden <b>*</b></span><input v-model="orden" class="field" maxlength="100"></label>

        <div class="fw autocomplete">
          <span class="fl">Código tienda <b>*</b></span>
          <input :value="codigoTiendaQuery" class="field" autocomplete="off" @input="onCodigoTiendaInput(($event.target as HTMLInputElement).value)" @focus="showSuggestions = true">
          <div v-if="showSuggestions && codigoTiendaQuery && !tiendaSeleccionada" class="suggestions">
            <div v-if="searchLoading" class="sugg-item faint">Buscando…</div>
            <div v-else-if="suggestions.length === 0" class="sugg-item faint">Sin coincidencias</div>
            <button v-for="t in suggestions" :key="t.codigo" type="button" class="sugg-item" @click="selectTienda(t)">
              <strong>{{ t.codigo }}</strong> — {{ t.tienda }} <span class="faint">({{ t.ciudad }})</span>
            </button>
          </div>
          <div v-if="tiendaSeleccionada" class="tienda-resuelta">{{ tiendaSeleccionada.tienda }} — {{ tiendaSeleccionada.ciudad }}</div>
        </div>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><Boxes :size="13" /></span> Cantidades</div>
        <div class="g2">
          <label class="fw"><span class="fl">Cajas esperadas <b>*</b></span><input v-model="cajasEsperadas" type="number" min="1" class="field"></label>
          <label class="fw"><span class="fl">Estibas esperadas <b>*</b></span><input v-model="estibasEsperadas" type="number" min="1" class="field"></label>
        </div>
      </section>

      <p v-if="error" class="err-msg">{{ error }}</p>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          <Spinner v-if="saving" />{{ saving ? 'Guardando…' : 'Guardar cambios' }}
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
.err-msg { font-size: 12px; color: var(--u-critico); margin: 0; }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
@media (max-width: 560px) { .g2 { grid-template-columns: 1fr; } }
</style>
