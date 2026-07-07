<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Download, Plus } from '@lucide/vue'
import { tieneAlertaGourmet, type PedidoGourmet } from '~/utils/gourmet'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'

definePageMeta({ title: 'Cargue Gourmet' })

const { me } = useSessionState()
const { show: showToast } = useToast()

const pedidos = ref<PedidoGourmet[]>([])
const canCreate = computed(() => !!me.value?.role && ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'].includes(me.value.role))

const q = ref('')
const fEstado = ref('')
const fCiudad = ref('')
const fTipoOrden = ref('')
const fAlerta = ref(false)
const density = ref<'comodo' | 'compacto'>('comodo')
const loading = ref(true)
const refreshKey = ref(0)
const refreshing = ref(false)
const loadError = ref(false)

async function loadAll() {
  try {
    const res = await $fetch<{ data: PedidoGourmet[] }>('/api/cargue-gourmet?pageSize=500')
    pedidos.value = res.data
    loadError.value = false
  } catch {
    loadError.value = true
  }
}

onMounted(async () => { ensureSession(); await loadAll(); loading.value = false })

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  loading.value = true
  await loadAll()
  await new Promise((r) => setTimeout(r, 350))
  loading.value = false; refreshing.value = false; refreshKey.value++
  showToast('Datos actualizados ✓')
}

const ciudades = computed(() => [...new Set(pedidos.value.map((p) => p.ciudadDestino).filter(Boolean))].sort((a, b) => a.localeCompare(b)))

const filtered = computed(() => {
  const query = q.value.toLowerCase()
  return pedidos.value.filter((p) => {
    if (query && !p.orden.toLowerCase().includes(query) && !p.nombreTienda.toLowerCase().includes(query) && !p.codigoTienda.toLowerCase().includes(query)) return false
    if (fEstado.value && p.estado !== fEstado.value) return false
    if (fCiudad.value && p.ciudadDestino !== fCiudad.value) return false
    if (fTipoOrden.value && p.tipoOrden !== fTipoOrden.value) return false
    if (fAlerta.value && !tieneAlertaGourmet(p)) return false
    return true
  })
})
const hasFilters = computed(() => !!(q.value || fEstado.value || fCiudad.value || fTipoOrden.value || fAlerta.value))
function clearFilters() { q.value = ''; fEstado.value = ''; fCiudad.value = ''; fTipoOrden.value = ''; fAlerta.value = false }
function onKpiFilter(key: string) { fEstado.value = key }

// ── Detalle ──────────────────────────────────────────────────────────────
const panelId = ref<string | null>(null)
const panelItem = ref<PedidoGourmet | null>(null)
const panelLoading = ref(false)
const ultimoResultado = ref<{ codigo: string; resultado: string } | null>(null)

async function loadDetalle(id: string) {
  panelLoading.value = true
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}`)
    panelItem.value = res.data
  } catch { /* se mantiene el detalle previo si falla el refresh */ }
  finally { panelLoading.value = false }
}
async function openDetail(p: PedidoGourmet) { panelId.value = p.id; ultimoResultado.value = null; await loadDetalle(p.id) }
function backToList() { panelId.value = null; panelItem.value = null }

function apiErr(e: any, fallback: string) { return e?.data?.statusMessage || e?.statusMessage || fallback }

const busy = ref<string | null>(null)
async function run(key: string, fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = key
  try { await fn() } finally { busy.value = null }
}

// ── Crear / Editar ───────────────────────────────────────────────────────
const showCrear = ref(false)
const showEditar = ref(false)
const saving = ref(false)

function onCreated() { loadAll() }
function onVerExistente(id: string) { openDetail({ id } as PedidoGourmet) }

async function guardarEdicion(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  saving.value = true
  try {
    await $fetch(`/api/cargue-gourmet/${panelItem.value.id}`, { method: 'PUT', body: payload })
    showEditar.value = false
    await loadAll(); await loadDetalle(panelItem.value.id)
    showToast('Pedido actualizado ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo guardar'), true) }
  finally { saving.value = false }
}

// ── Asignar ubicación ────────────────────────────────────────────────────
const showUbicacion = ref(false)
async function guardarUbicacion(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  saving.value = true
  try {
    await $fetch(`/api/cargue-gourmet/${panelItem.value.id}/ubicacion`, { method: 'POST', body: payload })
    showUbicacion.value = false
    await loadAll(); await loadDetalle(panelItem.value.id)
    showToast('Ubicación asignada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo guardar la ubicación'), true) }
  finally { saving.value = false }
}

// ── Ciclo de cargue ──────────────────────────────────────────────────────
function iniciarCargue() {
  return run('iniciarCargue', async () => {
    if (!panelItem.value) return
    try {
      await $fetch(`/api/cargue-gourmet/${panelItem.value.id}/iniciar-cargue`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      await loadAll(); await loadDetalle(panelItem.value.id)
      showToast('Cargue iniciado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo iniciar el cargue'), true); if (panelItem.value) await loadDetalle(panelItem.value.id) }
  })
}

async function escanear(codigo: string, tieneParte2: boolean) {
  if (!panelItem.value || busy.value) return
  busy.value = 'escanear'
  try {
    const res = await $fetch<{ resultado: string; novedadCreada: boolean }>(`/api/cargue-gourmet/${panelItem.value.id}/escanear`, { method: 'POST', body: { codigo, tieneParte2 } })
    ultimoResultado.value = { codigo, resultado: res.resultado }
    await loadDetalle(panelItem.value.id)
  } catch (e) {
    showToast(apiErr(e, 'No se pudo registrar el escaneo'), true)
  } finally {
    busy.value = null
  }
}

function finalizarCargue() {
  return run('finalizar', async () => {
    if (!panelItem.value) return
    try {
      await $fetch(`/api/cargue-gourmet/${panelItem.value.id}/finalizar`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      await loadAll(); await loadDetalle(panelItem.value.id)
      showToast('Cargue finalizado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo finalizar el cargue'), true); if (panelItem.value) await loadDetalle(panelItem.value.id) }
  })
}

const showConfirmRevertir = ref(false)
function revertirCargue() {
  return run('revertir', async () => {
    if (!panelItem.value) return
    try {
      await $fetch(`/api/cargue-gourmet/${panelItem.value.id}/revertir-cargue`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      showConfirmRevertir.value = false
      await loadAll(); await loadDetalle(panelItem.value.id)
      showToast('Cargue revertido ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo revertir'), true) }
  })
}

// ── Cierre manual ────────────────────────────────────────────────────────
const showCierreManual = ref(false)
async function guardarCierreManual(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  saving.value = true
  try {
    await $fetch(`/api/cargue-gourmet/${panelItem.value.id}/cierre-manual`, { method: 'POST', body: payload })
    showCierreManual.value = false
    await loadAll(); await loadDetalle(panelItem.value.id)
    showToast('Cargue cerrado manualmente ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo cerrar manualmente'), true) }
  finally { saving.value = false }
}

// ── Eliminar ─────────────────────────────────────────────────────────────
const showConfirmDel = ref(false)
function delPedido() {
  return run('del', async () => {
    if (!panelItem.value) return
    try {
      await $fetch(`/api/cargue-gourmet/${panelItem.value.id}`, { method: 'DELETE' })
      showConfirmDel.value = false
      backToList(); await loadAll()
      showToast('Pedido eliminado')
    } catch (e) { showToast(apiErr(e, 'No se pudo eliminar'), true) }
  })
}

async function exportarExcel() {
  const qs = new URLSearchParams()
  if (q.value) qs.set('q', q.value)
  if (fCiudad.value) qs.set('ciudad', fCiudad.value)
  if (fEstado.value) qs.set('estado', fEstado.value)
  if (fTipoOrden.value) qs.set('tipoOrden', fTipoOrden.value)
  const url = `/api/cargue-gourmet/export${qs.toString() ? `?${qs}` : ''}`
  const a = document.createElement('a')
  a.href = url
  a.download = `cargue-gourmet-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
}
</script>

<template>
  <div>
    <section class="hero fade-in">
      <div class="hero-left">
        <div class="hero-kicker">Gourmet · Transporte</div>
        <h1 class="hero-title">Cargue Gourmet</h1>
        <p class="hero-desc">{{ pedidos.length }} pedido{{ pedidos.length !== 1 ? 's' : '' }} · ubicación y cargue verificado</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refresh"><RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}</button>
        <button class="btn btn-sm" @click="exportarExcel"><Download :size="14" /> Exportar Excel</button>
        <button v-if="canCreate" class="btn btn-primary btn-sm" @click="showCrear = true"><Plus :size="14" /> Nuevo pedido</button>
      </div>
    </section>

    <Transition name="view" mode="out-in">
      <div v-if="!panelId" key="list">
        <CargueGourmetKpiRail :key="refreshKey" :items="pedidos" style="margin-bottom: 18px" @filter="onKpiFilter" />
        <CargueGourmetToolbar
          v-model:q="q" v-model:estado="fEstado" v-model:ciudad="fCiudad" v-model:tipo-orden="fTipoOrden" v-model:alerta="fAlerta" v-model:density="density"
          :ciudades="ciudades" :count="filtered.length" :total="pedidos.length" style="margin-bottom: 14px" @clear="clearFilters"
        />
        <ListSkeleton v-if="loading" />
        <CargueGourmetPedidosList v-else :items="filtered" :has-filters="hasFilters" :density="density" @open="openDetail" @clear="clearFilters" @new="showCrear = true" />
      </div>

      <div v-else-if="panelItem" key="detail">
        <CargueGourmetPedidoDetail
          :p="panelItem" :role="me?.role ?? ''" :busy="busy" :escaneando="busy === 'escanear'" :ultimo-resultado="ultimoResultado"
          @back="backToList" @edit="showEditar = true" @del="showConfirmDel = true" @asignar-ubicacion="showUbicacion = true"
          @iniciar-cargue="iniciarCargue" @finalizar="finalizarCargue" @revertir="showConfirmRevertir = true"
          @cierre-manual="showCierreManual = true" @escanear="escanear"
        />
      </div>
    </Transition>

    <CargueGourmetCrearPedidoModal v-if="showCrear" @close="showCrear = false" @created="onCreated" @ver-existente="onVerExistente" />
    <CargueGourmetEditarPedidoModal v-if="showEditar && panelItem" :p="panelItem" :saving="saving" @close="showEditar = false" @saved="guardarEdicion" />
    <CargueGourmetAsignarUbicacionModal v-if="showUbicacion && panelItem" :p="panelItem" :saving="saving" @close="showUbicacion = false" @saved="guardarUbicacion" />
    <CargueGourmetCierreManualModal v-if="showCierreManual && panelItem" :p="panelItem" :saving="saving" @close="showCierreManual = false" @saved="guardarCierreManual" />

    <ConfirmModal
      v-if="showConfirmDel && panelItem" title="Eliminar pedido"
      :message="`¿Eliminar el pedido ${panelItem.tipoOrden} ${panelItem.orden}? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar" confirming-label="Eliminando…" :confirming="busy === 'del'"
      @close="showConfirmDel = false" @confirm="delPedido"
    />
    <ConfirmModal
      v-if="showConfirmRevertir && panelItem" title="Revertir cargue"
      :message="`¿Revertir el cargue de ${panelItem.tipoOrden} ${panelItem.orden}? Se perderán los escaneos registrados en este cargue.`"
      confirm-label="Revertir" confirming-label="Revirtiendo…" :confirming="busy === 'revertir'"
      @close="showConfirmRevertir = false" @confirm="revertirCargue"
    />
  </div>
</template>

<style scoped>
.hero { position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero::before { content: ''; position: absolute; left: -40px; top: -30px; width: 260px; height: 120px; background: radial-gradient(closest-side, color-mix(in srgb, var(--brand) 16%, transparent), transparent); pointer-events: none; z-index: -1; }
.hero-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand-deep); }
.hero-kicker::before { content: ''; width: 14px; height: 2px; border-radius: 2px; background: var(--brand); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 4px 0 0; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 5px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.view-enter-active, .view-leave-active { transition: opacity .28s cubic-bezier(.16,1,.3,1), transform .28s cubic-bezier(.16,1,.3,1); }
.view-enter-from { opacity: 0; transform: translateY(10px); }
.view-leave-to { opacity: 0; transform: translateY(-6px); }
.fade-enter-active, .fade-leave-active { transition: opacity .22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
