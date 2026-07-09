<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Download, Plus } from '@lucide/vue'
import type { Despacho } from '~/utils/despacho'
import { SAMPLE_DESPACHOS } from '~/utils/sampleDataTienda'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'

definePageMeta({ title: 'Facturas Contado' })

const { me } = useSessionState()
const { show: showToast } = useToast()

const despachos = ref<Despacho[]>([])
const demo = ref(false)
const canCreate = computed(() => demo.value || !!me.value?.can.create)
const canEdit = computed(() => demo.value || !!me.value?.can.edit)

const q = ref('')
const fEstado = ref('')
const fCC = ref('')
const fAlerta = ref(false)
const density = ref<'comodo' | 'compacto'>('comodo')
const loading = ref(true)
const refreshKey = ref(0)
const refreshing = ref(false)

interface HistorialEntry { action: string; details: string | null; userName: string | null; createdAt: string }

// Paginación real del lado del servidor — antes se traía todo con
// pageSize=500 y se filtraba/paginaba en el cliente.
const page = ref(1)
const pageSize = ref(30)
const total = ref(0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const kpiCounts = ref({ total: 0, pendRecogida: 0, enTransito: 0, completados: 0, atencion: 0 })
async function loadConteos() {
  if (demo.value) return
  try {
    const res = await $fetch<{ data: typeof kpiCounts.value }>('/api/tienda/conteos')
    kpiCounts.value = res.data
  } catch { /* deja los conteos previos si falla */ }
}

// El banner de atención necesita TODOS los despachos con novedad/rechazo,
// no solo la página visible — endpoint aparte, acotado.
const atencionItems = ref<Despacho[]>([])
async function loadAtencion() {
  if (demo.value) return
  try {
    const res = await $fetch<{ data: Despacho[] }>('/api/tienda/atencion')
    atencionItems.value = res.data
  } catch { atencionItems.value = [] }
}

const centrosCostos = ref<string[]>([])
async function loadCentrosCostos() {
  if (demo.value) return
  try {
    const res = await $fetch<{ data: string[] }>('/api/tienda/centros-costos')
    centrosCostos.value = res.data
  } catch { /* select queda vacío si falla, no bloquea la lista */ }
}

async function loadAll() {
  try {
    const query: Record<string, string | number> = { page: page.value, pageSize: pageSize.value }
    if (q.value) query.q = q.value
    if (fEstado.value) query.estado = fEstado.value
    if (fCC.value) query.centroCostos = fCC.value
    if (fAlerta.value) query.alerta = '1'
    const res = await $fetch<{ data: Despacho[]; total: number }>('/api/tienda', { query })
    despachos.value = res.data
    total.value = res.total
    demo.value = false
  } catch {
    demo.value = true
    despachos.value = [...SAMPLE_DESPACHOS]
    total.value = despachos.value.length
    // Sin backend real, deriva conteos/atención/centros de los datos de
    // muestra en vez de llamar a los endpoints (que fallarían igual).
    kpiCounts.value = {
      total: despachos.value.length,
      pendRecogida: despachos.value.filter((d) => d.estado === 'CREADO_TIENDA').length,
      enTransito: despachos.value.filter((d) => d.estado === 'RECOGIDO_TIENDA' || d.estado === 'ENTREGADO_CEDI').length,
      completados: despachos.value.filter((d) => d.estado === 'ENVIADO_CLIENTE').length,
      atencion: despachos.value.filter((d) => d.estado === 'CON_NOVEDAD' || d.estado === 'RECHAZADO').length,
    }
    atencionItems.value = despachos.value.filter((d) => d.estado === 'CON_NOVEDAD' || d.estado === 'RECHAZADO')
    centrosCostos.value = [...new Set(despachos.value.map((d) => d.centroCostos).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }
}

onMounted(async () => {
  ensureSession()
  await loadAll()
  await Promise.all([loadConteos(), loadAtencion(), loadCentrosCostos()])
  loading.value = false
})

// Parcha una fila del listado en memoria en vez de recargar del servidor
// tras cada mutación.
function patchListado(id: string, patch: Partial<Despacho>) {
  const idx = despachos.value.findIndex((d) => d.id === id)
  if (idx !== -1) despachos.value[idx] = { ...despachos.value[idx], ...patch, id } as Despacho
  void loadConteos(); void loadAtencion()
}
function agregarAListado(d: Despacho) { despachos.value = [d, ...despachos.value]; total.value++; void loadConteos() }
function quitarDeListado(id: string) { despachos.value = despachos.value.filter((x) => x.id !== id); total.value = Math.max(0, total.value - 1); void loadConteos() }

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  loading.value = true
  await loadAll()
  await Promise.all([loadConteos(), loadAtencion()])
  await new Promise((r) => setTimeout(r, 350))
  loading.value = false; refreshing.value = false; refreshKey.value++
  showToast(demo.value ? 'Modo demo · datos de ejemplo' : 'Datos actualizados ✓')
}

const hasFilters = computed(() => !!(q.value || fEstado.value || fCC.value || fAlerta.value))
function clearFilters() { q.value = ''; fEstado.value = ''; fCC.value = ''; fAlerta.value = false }
function onKpiFilter(key: string) { fEstado.value = key }

// Cualquier cambio de filtro vuelve a la página 1 y recarga desde el
// servidor — el buscador (q) ya llega debounced desde TiendaToolbar.
watch([q, fEstado, fCC, fAlerta], () => { page.value = 1; void loadAll() })
watch(page, () => { void loadAll() })

// panel + modales
const panelItem = ref<Despacho | null>(null)
const historial = ref<HistorialEntry[]>([])
watch(panelItem, async (d) => {
  if (!d) { historial.value = []; return }
  if (demo.value) { historial.value = []; return }
  try {
    const res = await $fetch<{ data: Despacho; historial: HistorialEntry[] }>(`/api/tienda/${d.id}`)
    historial.value = res.historial
  } catch { historial.value = [] }
})
function openDetail(d: Despacho) { panelItem.value = d }

const showForm = ref(false)
const editing = ref<Despacho | null>(null)

function apiErr(e: any, fallback: string) {
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || fallback
}

// ── Feedback async: una sola acción de escritura a la vez ──────────────────
// `busy` guarda la clave de la acción en curso; los botones muestran spinner
// cuando su clave coincide y todos quedan deshabilitados mientras haya una.
const busy = ref<string | null>(null)
async function run(key: string, fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = key
  try { await fn() } finally { busy.value = null }
}

async function refreshPanel() {
  if (!panelItem.value) return
  try {
    const res = await $fetch<{ data: Despacho; historial: HistorialEntry[] }>(`/api/tienda/${panelItem.value.id}`)
    panelItem.value = res.data
    historial.value = res.historial
  } catch { /* ignore */ }
}

function transicion(destino: string) {
  return run(`transicion:${destino}`, async () => {
    const d = panelItem.value
    if (!d) return
    if (demo.value) { d.estado = destino as Despacho['estado']; showToast('Estado actualizado ✓'); return }
    try {
      const res = await $fetch<{ data: Despacho }>(`/api/tienda/${d.id}` as string, { method: 'PUT', body: { estado: destino, updatedAt: d.updatedAt } })
      patchListado(d.id, res.data)
      await refreshPanel(); showToast('Estado actualizado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo actualizar el estado'), true) }
  })
}

// Modal rechazar
const showRechazar = ref(false)
const motivoRechazo = ref('')
function abrirRechazar() { motivoRechazo.value = ''; showRechazar.value = true }
function confirmarRechazar() {
  return run('rechazar', async () => {
    const d = panelItem.value
    if (!d || motivoRechazo.value.trim().length < 5) return
    if (demo.value) { d.estado = 'RECHAZADO'; showRechazar.value = false; showToast('Despacho rechazado'); return }
    try {
      const res = await $fetch<{ data: Despacho }>(`/api/tienda/${d.id}` as string, { method: 'PUT', body: { estado: 'RECHAZADO', motivoRechazo: motivoRechazo.value.trim(), updatedAt: d.updatedAt } })
      showRechazar.value = false
      patchListado(d.id, res.data)
      await refreshPanel(); showToast('Despacho rechazado')
    } catch (e) { showToast(apiErr(e, 'No se pudo rechazar'), true) }
  })
}

// Modal novedad
const showNovedad = ref(false)
const novedadTexto = ref('')
function abrirNovedad() { novedadTexto.value = ''; showNovedad.value = true }
function confirmarNovedad() {
  return run('novedad', async () => {
    const d = panelItem.value
    if (!d || novedadTexto.value.trim().length < 5) return
    if (demo.value) { d.estado = 'CON_NOVEDAD'; d.novedad = novedadTexto.value.trim(); showNovedad.value = false; showToast('Novedad registrada'); return }
    try {
      const res = await $fetch<{ data: Despacho }>(`/api/tienda/${d.id}` as string, { method: 'PUT', body: { estado: 'CON_NOVEDAD', novedad: novedadTexto.value.trim(), updatedAt: d.updatedAt } })
      showNovedad.value = false
      patchListado(d.id, res.data)
      await refreshPanel(); showToast('Novedad registrada')
    } catch (e) { showToast(apiErr(e, 'No se pudo registrar la novedad'), true) }
  })
}

// Modal asignar guardado
const showAsignar = ref(false)
const operarios = ref<{ id: string; name: string }[]>([])
const asignadoAId = ref('')
const notaAsignacion = ref('')
async function abrirAsignar() {
  asignadoAId.value = ''; notaAsignacion.value = ''
  if (!demo.value) {
    try {
      const res = await $fetch<{ data: { id: string; name: string }[] }>('/api/users?role=TRANSPORTE')
      operarios.value = res.data
    } catch { operarios.value = [] }
  }
  showAsignar.value = true
}
function confirmarAsignar() {
  return run('asignar', async () => {
    const d = panelItem.value
    if (!d || !asignadoAId.value) return
    if (demo.value) { showAsignar.value = false; showToast('Guardado asignado ✓'); return }
    try {
      await $fetch(`/api/tienda/${d.id}/guardado`, { method: 'POST', body: { asignadoAId: asignadoAId.value, nota: notaAsignacion.value.trim() || null } })
      showAsignar.value = false
      await refreshPanel(); showToast('Guardado asignado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo asignar'), true) }
  })
}

// Revertir
const showConfirmRevertir = ref(false)
function revertir() {
  return run('revertir', async () => {
    const d = panelItem.value
    if (!d) return
    if (demo.value) { showConfirmRevertir.value = false; showToast('Estado revertido ✓'); return }
    try {
      const res = await $fetch<{ data: Despacho }>(`/api/tienda/${d.id}/revertir-estado`, { method: 'POST', body: { updatedAt: d.updatedAt } })
      showConfirmRevertir.value = false
      patchListado(d.id, res.data)
      await refreshPanel(); showToast('Estado revertido ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo revertir'), true) }
  })
}

const showConfirmDel = ref(false)
function delDespacho() {
  return run('del', async () => {
    const d = panelItem.value
    if (!d) return
    if (demo.value) { despachos.value = despachos.value.filter(x => x.id !== d.id); panelItem.value = null; showConfirmDel.value = false; showToast('Eliminado'); return }
    try {
      await $fetch(`/api/tienda/${d.id}` as string, { method: 'DELETE' })
      showConfirmDel.value = false
      panelItem.value = null; quitarDeListado(d.id); showToast('Eliminado')
    } catch (e) { showToast(apiErr(e, 'No se pudo eliminar'), true) }
  })
}

function openEdit() { editing.value = panelItem.value; showForm.value = true }

function onSaved(payload: Record<string, unknown>) {
  return run('save', async () => {
    const wasEdit = !!editing.value
    if (demo.value) {
      showForm.value = false; editing.value = null
      showToast(wasEdit ? 'Factura actualizada ✓' : 'Factura registrada ✓')
      return
    }
    try {
      if (wasEdit) {
        const res = await $fetch<{ data: Despacho }>(`/api/tienda/${editing.value!.id}` as string, { method: 'PUT', body: payload })
        patchListado(editing.value!.id, res.data)
        await refreshPanel()
      } else {
        const res = await $fetch<{ data: Despacho }>('/api/tienda', { method: 'POST', body: payload })
        agregarAListado(res.data)
      }
      showForm.value = false; editing.value = null
      showToast(wasEdit ? 'Factura actualizada ✓' : 'Factura registrada ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo guardar'), true) }
  })
}

function exportarExcel() {
  if (demo.value) { showToast('Exportar Excel no está disponible en modo demo', true); return }
  const qs = new URLSearchParams()
  if (q.value) qs.set('q', q.value)
  if (fEstado.value) qs.set('estado', fEstado.value)
  if (fCC.value) qs.set('centroCostos', fCC.value)
  const url = `/api/tienda/export${qs.toString() ? `?${qs}` : ''}`
  const a = document.createElement('a')
  a.href = url
  a.download = `facturas-contado-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
}
</script>

<template>
  <div>
    <section class="hero fade-in">
      <div class="hero-left">
        <div class="hero-kicker">Tienda → CEDI → Cliente</div>
        <h1 class="hero-title">Facturas Contado</h1>
        <p class="hero-desc">{{ kpiCounts.total }} facturas · {{ kpiCounts.pendRecogida }} pendientes de recogida</p>
      </div>
      <div class="hero-actions">
        <span v-if="demo" class="demo-tag" title="Sin sesión activa: mostrando datos de ejemplo."><span class="demo-dot" /> Modo demo</span>
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refresh"><RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}</button>
        <button class="btn btn-sm" @click="exportarExcel"><Download :size="14" /> Excel</button>
        <button v-if="canCreate" class="btn btn-primary btn-sm" @click="editing = null; showForm = true"><Plus :size="14" /> Nueva factura</button>
      </div>
    </section>

    <Transition name="view" mode="out-in">
      <div v-if="!panelItem" key="list">
        <AtencionBanner :items="atencionItems" class="fade-in" style="margin-bottom: 18px" @open="openDetail" />
        <TiendaKpiRail :key="refreshKey" :counts="kpiCounts" style="margin-bottom: 18px" @filter="onKpiFilter" />
        <TiendaToolbar
          v-model:q="q" v-model:estado="fEstado" v-model:centro="fCC" v-model:alerta="fAlerta" v-model:density="density"
          :centros="centrosCostos" :count="total" :total="kpiCounts.total" style="margin-bottom: 14px" @clear="clearFilters"
        />
        <!-- Sin <Transition>: una transición CSS aquí queda colgada si la pestaña
             está en segundo plano (rAF congelado) y la lista nunca reemplaza al
             skeleton. Las filas ya animan su entrada escalonada por su cuenta. -->
        <ListSkeleton v-if="loading" />
        <TiendaDespachosList v-else :items="despachos" :has-filters="hasFilters" :density="density" @open="openDetail" @clear="clearFilters" @new="showForm = true" />
        <PageNav v-if="!loading && pages > 1" v-model:page="page" :pages="pages" style="margin-top: 14px" />
      </div>

      <TiendaDespachoDetail
        v-else key="detail" :d="panelItem" :historial="historial" :role="me?.role ?? ''" :can-delete="canEdit" :busy="busy"
        @back="panelItem = null" @transicion="transicion" @rechazar="abrirRechazar" @novedad="abrirNovedad"
        @asignar-guardado="abrirAsignar" @revertir="showConfirmRevertir = true" @edit="openEdit" @del="showConfirmDel = true"
      />
    </Transition>

    <TiendaDespachoModal v-if="showForm" :despacho="editing" :saving="busy === 'save'" @close="showForm = false; editing = null" @saved="onSaved" />

    <ConfirmModal
      v-if="showConfirmDel && panelItem" title="Eliminar factura"
      :message="`¿Eliminar la factura ${panelItem.numeroDocumento} de ${panelItem.clienteNombre}? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar" confirming-label="Eliminando…" :confirming="busy === 'del'"
      @close="showConfirmDel = false" @confirm="delDespacho"
    />
    <ConfirmModal
      v-if="showConfirmRevertir && panelItem" title="Revertir estado" danger
      :message="`¿Revertir el estado de la factura ${panelItem.numeroDocumento}?`"
      confirm-label="Revertir" confirming-label="Revirtiendo…" :confirming="busy === 'revertir'"
      @close="showConfirmRevertir = false" @confirm="revertir"
    />

    <ModalShell v-if="showRechazar && panelItem" title="Rechazar despacho" :sub="panelItem.numeroDocumento" @close="showRechazar = false">
      <div class="mform">
        <label class="flabel">Motivo del rechazo (mínimo 5 caracteres)</label>
        <textarea v-model="motivoRechazo" rows="3" class="field" placeholder="Explica por qué se rechaza…" />
        <span v-if="motivoRechazo.trim().length > 0 && motivoRechazo.trim().length < 5" class="fe scale-in">
          Faltan {{ 5 - motivoRechazo.trim().length }} caracter(es)
        </span>
        <div class="mactions">
          <button class="btn" :disabled="busy === 'rechazar'" @click="showRechazar = false">Cancelar</button>
          <button class="btn btn-danger" :disabled="busy === 'rechazar' || motivoRechazo.trim().length < 5" @click="confirmarRechazar">
            <Spinner v-if="busy === 'rechazar'" />
            {{ busy === 'rechazar' ? 'Rechazando…' : 'Rechazar' }}
          </button>
        </div>
      </div>
    </ModalShell>

    <ModalShell v-if="showNovedad && panelItem" title="Registrar novedad" :sub="panelItem.numeroDocumento" @close="showNovedad = false">
      <div class="mform">
        <label class="flabel">Descripción de la novedad (mínimo 5 caracteres)</label>
        <textarea v-model="novedadTexto" rows="3" class="field" placeholder="Describe la novedad…" />
        <span v-if="novedadTexto.trim().length > 0 && novedadTexto.trim().length < 5" class="fe scale-in">
          Faltan {{ 5 - novedadTexto.trim().length }} caracter(es)
        </span>
        <div class="mactions">
          <button class="btn" :disabled="busy === 'novedad'" @click="showNovedad = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="busy === 'novedad' || novedadTexto.trim().length < 5" @click="confirmarNovedad">
            <Spinner v-if="busy === 'novedad'" />
            {{ busy === 'novedad' ? 'Guardando…' : 'Registrar' }}
          </button>
        </div>
      </div>
    </ModalShell>

    <ModalShell v-if="showAsignar && panelItem" title="Asignar a guardado" :sub="panelItem.numeroDocumento" @close="showAsignar = false">
      <div class="mform">
        <label class="flabel">Operario de transporte</label>
        <select v-model="asignadoAId" class="field">
          <option value="">Selecciona un operario…</option>
          <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>
        <label class="flabel">Nota (opcional)</label>
        <input v-model="notaAsignacion" class="field" placeholder="Notas para el operario…">
        <div class="mactions">
          <button class="btn" :disabled="busy === 'asignar'" @click="showAsignar = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="busy === 'asignar' || !asignadoAId" @click="confirmarAsignar">
            <Spinner v-if="busy === 'asignar'" />
            {{ busy === 'asignar' ? 'Asignando…' : 'Asignar' }}
          </button>
        </div>
      </div>
    </ModalShell>
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
.demo-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--u-aviso); background: var(--u-aviso-tint); border: 1px solid color-mix(in srgb, var(--u-aviso) 30%, transparent); padding: 5px 10px; border-radius: var(--r-pill); cursor: help; }
.demo-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--u-aviso); animation: auroraPulse 1.6s infinite; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.view-enter-active, .view-leave-active { transition: opacity .28s cubic-bezier(.16,1,.3,1), transform .28s cubic-bezier(.16,1,.3,1); }
.view-enter-from { opacity: 0; transform: translateY(10px); }
.view-leave-to { opacity: 0; transform: translateY(-6px); }
.fade-enter-active, .fade-leave-active { transition: opacity .22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.mform { display: flex; flex-direction: column; gap: 12px; }
.flabel { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.fe { font-size: 11px; font-weight: 600; color: var(--u-critico); margin-top: -6px; }
.mactions { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-top: 4px; }
.mactions .btn { justify-content: center; }
</style>
