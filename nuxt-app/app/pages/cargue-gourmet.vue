<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Download, Plus, PackageCheck } from '@lucide/vue'
import { tieneAlertaGourmet, ESTADOS_NO_DESPACHABLES_MASIVO, type PedidoGourmet } from '~/utils/gourmet'
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
const fTienda = ref('')
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
const tiendas = computed(() => [...new Set(pedidos.value.map((p) => p.nombreTienda).filter(Boolean))].sort((a, b) => a.localeCompare(b)))

const filtered = computed(() => {
  const query = q.value.toLowerCase()
  return pedidos.value.filter((p) => {
    if (query && !p.orden.toLowerCase().includes(query) && !p.nombreTienda.toLowerCase().includes(query) && !p.codigoTienda.toLowerCase().includes(query)) return false
    if (fEstado.value && p.estado !== fEstado.value) return false
    if (fCiudad.value && p.ciudadDestino !== fCiudad.value) return false
    if (fTienda.value && p.nombreTienda !== fTienda.value) return false
    if (fTipoOrden.value && p.tipoOrden !== fTipoOrden.value) return false
    if (fAlerta.value && !tieneAlertaGourmet(p)) return false
    return true
  })
})
const hasFilters = computed(() => !!(q.value || fEstado.value || fCiudad.value || fTienda.value || fTipoOrden.value || fAlerta.value))
function clearFilters() { q.value = ''; fEstado.value = ''; fCiudad.value = ''; fTienda.value = ''; fTipoOrden.value = ''; fAlerta.value = false }
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

// Parcha una fila del listado en memoria en vez de recargar las 500 filas
// del servidor — esto es lo que elimina el round-trip pesado en cada
// mutación (crear/editar/ubicación/cargue/eliminar solo tocan 1 fila).
function patchListado(id: string, patch: Partial<PedidoGourmet>) {
  const idx = pedidos.value.findIndex((p) => p.id === id)
  if (idx !== -1) pedidos.value[idx] = { ...pedidos.value[idx], ...patch, id } as PedidoGourmet
}
function agregarAListado(p: PedidoGourmet) { pedidos.value = [p, ...pedidos.value] }
function quitarDeListado(id: string) { pedidos.value = pedidos.value.filter((p) => p.id !== id) }

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

function onCreated(p: PedidoGourmet) { agregarAListado(p) }
function onVerExistente(id: string) { openDetail({ id } as PedidoGourmet) }

async function guardarEdicion(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  const id = panelItem.value.id
  saving.value = true
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}`, { method: 'PUT', body: payload })
    showEditar.value = false
    patchListado(id, res.data)
    await loadDetalle(id)
    showToast('Pedido actualizado ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo guardar'), true) }
  finally { saving.value = false }
}

// ── Asignar ubicación ────────────────────────────────────────────────────
const showUbicacion = ref(false)
async function guardarUbicacion(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  const id = panelItem.value.id
  saving.value = true
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}/ubicacion`, { method: 'POST', body: payload })
    showUbicacion.value = false
    patchListado(id, res.data)
    await loadDetalle(id)
    showToast('Ubicación asignada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo guardar la ubicación'), true) }
  finally { saving.value = false }
}

// ── Ciclo de cargue ──────────────────────────────────────────────────────
// Nota de alcance (Fase 4): estas acciones patchean el LISTADO en memoria
// (evita el refetch de las 500 filas) pero siguen usando loadDetalle(id)
// — un solo GET liviano — para refrescar el panel. Reconstruir a mano los
// arreglos anidados (cargues/escaneos/novedades) desde las respuestas
// parciales de cada endpoint es frágil (fácil dejar el detalle
// inconsistente); un GET puntual por id es mucho más barato que el
// loadAll() de 500 filas que sí eliminamos, así que el balance
// riesgo/beneficio no lo justifica aquí.
function iniciarCargue() {
  return run('iniciarCargue', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/iniciar-cargue`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      patchListado(id, res.data.pedido)
      await loadDetalle(id)
      showToast('Cargue iniciado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo iniciar el cargue'), true); await loadDetalle(id) }
  })
}

// El escaneo es la acción de mayor frecuencia (varias por segundo durante
// un cargue) — aquí sí vale la pena parchear el detalle localmente en vez
// de pedir loadDetalle() completo en cada caja escaneada.
async function escanear(codigo: string, tieneParte2: boolean) {
  if (!panelItem.value || busy.value) return
  busy.value = 'escanear'
  try {
    const res = await $fetch<{
      resultado: string; novedadCreada: boolean; progreso: { escaneados: number; esperados: number }
      data: { escaneo: { id: string; codigoEscaneado: string; resultado: string; createdAt: string }; novedad?: { id: string; tipo: string; estado: string; descripcion: string } }
    }>(`/api/cargue-gourmet/${panelItem.value.id}/escanear`, { method: 'POST', body: { codigo, tieneParte2 } })
    ultimoResultado.value = { codigo, resultado: res.resultado }

    const p = panelItem.value
    const cargues = (p.cargues ?? []).map((c) => {
      if (c.estado !== 'EN_CARGUE') return c
      return {
        ...c,
        cantidadEscaneada: res.progreso.escaneados,
        escaneos: [
          { ...res.data.escaneo, escaneadoPorId: me.value?.id ?? '', escaneadoPorNombre: me.value?.name ?? null },
          ...c.escaneos,
        ],
      }
    })
    const novedades = res.data.novedad
      ? [{ id: res.data.novedad.id, tipo: res.data.novedad.tipo, estado: res.data.novedad.estado, descripcion: res.data.novedad.descripcion, registradaPorId: me.value?.id ?? '', registradaPorNombre: me.value?.name ?? null, resueltaPorId: null, resueltaPorNombre: null, resueltaAt: null, createdAt: res.data.escaneo.createdAt }, ...(p.novedades ?? [])]
      : (p.novedades ?? [])
    panelItem.value = { ...p, cargues, novedades }
  } catch (e) {
    showToast(apiErr(e, 'No se pudo registrar el escaneo'), true)
  } finally {
    busy.value = null
  }
}

// Corrección de cajas (ADMIN/OPERACIONES_GOURMET) — eliminar una caja mal
// registrada y agregar la correcta a mano, sin pasar por el flujo de escaneo.
async function eliminarCaja(cajaId: string) {
  if (!panelItem.value || busy.value) return
  const id = panelItem.value.id
  busy.value = `del-caja:${cajaId}`
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}/cajas/${cajaId}`, { method: 'DELETE' })
    panelItem.value = res.data
    patchListado(id, res.data)
    showToast('Caja eliminada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo eliminar la caja'), true) }
  finally { busy.value = null }
}

async function agregarCajaManual(estibaId: string, codigo: string) {
  if (!panelItem.value || busy.value) return
  const id = panelItem.value.id
  busy.value = 'add-caja'
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}/cajas`, { method: 'POST', body: { estibaId, codigoCaja: codigo } })
    panelItem.value = res.data
    patchListado(id, res.data)
    showToast('Caja agregada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo agregar la caja'), true) }
  finally { busy.value = null }
}

function finalizarCargue() {
  return run('finalizar', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/finalizar`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      patchListado(id, res.data.pedido)
      await loadDetalle(id)
      showToast('Cargue finalizado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo finalizar el cargue'), true); await loadDetalle(id) }
  })
}

const showConfirmRevertir = ref(false)
function revertirCargue() {
  return run('revertir', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/revertir-cargue`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      showConfirmRevertir.value = false
      patchListado(id, res.data.pedido)
      await loadDetalle(id)
      showToast('Cargue revertido ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo revertir'), true) }
  })
}

// ── Cierre manual ────────────────────────────────────────────────────────
const showCierreManual = ref(false)
async function guardarCierreManual(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  const id = panelItem.value.id
  saving.value = true
  try {
    const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/cierre-manual`, { method: 'POST', body: payload })
    showCierreManual.value = false
    patchListado(id, res.data.pedido)
    await loadDetalle(id)
    showToast('Cargue cerrado manualmente ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo cerrar manualmente'), true) }
  finally { saving.value = false }
}

// ── Eliminar ─────────────────────────────────────────────────────────────
const showConfirmDel = ref(false)
function delPedido() {
  return run('del', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      await $fetch(`/api/cargue-gourmet/${id}`, { method: 'DELETE' })
      showConfirmDel.value = false
      quitarDeListado(id)
      backToList()
      showToast('Pedido eliminado')
    } catch (e) { showToast(apiErr(e, 'No se pudo eliminar'), true) }
  })
}

// ── Cargue masivo (solo ADMIN) ──────────────────────────────────────────
// Bypass deliberado del flujo normal de escaneo — cierra varios pedidos de
// una vez sin verificación física. El backend ya restringe esto a ADMIN
// (ver despacho-masivo.post.ts); aquí solo se ofrece la selección.
const showCargueMasivo = ref(false)
const pedidosPendientesMasivo = computed(() => pedidos.value.filter((p) => !ESTADOS_NO_DESPACHABLES_MASIVO.includes(p.estado)))
async function confirmarCargueMasivo(ids: string[]) {
  return run('cargue-masivo', async () => {
    try {
      const res = await $fetch<{ data: { actualizados: string[]; omitidos: { id: string; motivo: string }[] } }>(
        '/api/cargue-gourmet/despacho-masivo', { method: 'POST', body: { ids } },
      )
      showCargueMasivo.value = false
      await loadAll()
      const { actualizados, omitidos } = res.data
      if (omitidos.length > 0) {
        showToast(`${actualizados.length} completado(s) · ${omitidos.length} omitido(s) — ${omitidos[0]!.motivo}`, actualizados.length === 0)
      } else {
        showToast(`${actualizados.length} pedido(s) completado(s) ✓`)
      }
    } catch (e) { showToast(apiErr(e, 'No se pudo completar el cargue masivo'), true) }
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
        <button v-if="me?.role === 'ADMIN'" class="btn btn-sm" @click="showCargueMasivo = true"><PackageCheck :size="14" /> Cargue masivo</button>
        <button v-if="canCreate" class="btn btn-primary btn-sm" @click="showCrear = true"><Plus :size="14" /> Nuevo pedido</button>
      </div>
    </section>

    <Transition name="view" mode="out-in">
      <div v-if="!panelId" key="list">
        <CargueGourmetKpiRail :key="refreshKey" :items="pedidos" style="margin-bottom: 18px" @filter="onKpiFilter" />
        <CargueGourmetToolbar
          v-model:q="q" v-model:estado="fEstado" v-model:ciudad="fCiudad" v-model:tienda="fTienda" v-model:tipo-orden="fTipoOrden" v-model:alerta="fAlerta" v-model:density="density"
          :ciudades="ciudades" :tiendas="tiendas" :count="filtered.length" :total="pedidos.length" style="margin-bottom: 14px" @clear="clearFilters"
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
          @eliminar-caja="eliminarCaja" @agregar-caja-manual="agregarCajaManual"
        />
      </div>
    </Transition>

    <CargueGourmetCrearPedidoModal v-if="showCrear" @close="showCrear = false" @created="onCreated" @ver-existente="onVerExistente" />
    <CargueGourmetEditarPedidoModal v-if="showEditar && panelItem" :p="panelItem" :saving="saving" @close="showEditar = false" @saved="guardarEdicion" />
    <CargueGourmetAsignarUbicacionModal v-if="showUbicacion && panelItem" :p="panelItem" :saving="saving" @close="showUbicacion = false" @saved="guardarUbicacion" />
    <CargueGourmetCierreManualModal v-if="showCierreManual && panelItem" :p="panelItem" :saving="saving" @close="showCierreManual = false" @saved="guardarCierreManual" />
    <CargueGourmetCargueMasivoModal
      v-if="showCargueMasivo" :items="pedidosPendientesMasivo" :saving="busy === 'cargue-masivo'"
      @close="showCargueMasivo = false" @confirm="confirmarCargueMasivo"
    />

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
