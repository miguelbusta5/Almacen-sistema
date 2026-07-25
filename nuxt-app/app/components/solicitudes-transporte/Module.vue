<script setup lang="ts">
// Orquestador de Solicitudes Transporte. Único dueño del estado y de las llamadas
// de red (salvo FormModal y PluEditor, que hacen las suyas).
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Plus, FileText } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import {
  puedeBorrar, puedeEditarSolicitud, puedeGestionar, puedeReenviar, puedeVerSolicitudes,
  type Catalogos, type GestionForm, type HistorialItem, type Solicitud,
} from '~/utils/solicitudesTransporte'

const route = useRoute()
const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const role = computed(() => me.value?.role ?? '')
const userId = computed(() => me.value?.id)
const puedeVer = computed(() => puedeVerSolicitudes(role.value))
const isGestor = computed(() => puedeGestionar(role.value))
const canDelete = computed(() => puedeBorrar(role.value))

// ── Listado ────────────────────────────────────────────────
const PAGE_SIZE = 25
const items = ref<Solicitud[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const refreshing = ref(false)
const kpis = ref<Record<string, number>>({})
const kpisSemaforo = ref<Record<string, number>>({})
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const fQ = ref('')
const fEstado = ref('')
const fSemaforo = ref('')
const fPrioridad = ref('')
const fArea = ref('')
const hasFilters = computed(() => !!(fQ.value || fEstado.value || fSemaforo.value || fPrioridad.value || fArea.value))

async function loadLista() {
  try {
    const query: Record<string, string | number> = { page: page.value, pageSize: PAGE_SIZE }
    if (fQ.value) query.q = fQ.value
    if (fEstado.value) query.estado = fEstado.value
    if (fSemaforo.value) query.semaforo = fSemaforo.value
    if (fPrioridad.value) query.prioridad = fPrioridad.value
    if (fArea.value) query.area = fArea.value
    const res = await $fetch<{
      data: Solicitud[]; total: number; kpis: Record<string, number>; kpisSemaforo: Record<string, number>
    }>('/api/solicitudes-transporte', { query })
    items.value = res.data
    total.value = res.total
    kpis.value = res.kpis ?? {}
    kpisSemaforo.value = res.kpisSemaforo ?? {}
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar las solicitudes'), true)
  }
}

const catalogos = ref<Catalogos | null>(null)
async function loadCatalogos() {
  try {
    const res = await $fetch<{ data: Catalogos }>('/api/solicitudes-transporte/catalogos')
    catalogos.value = res.data
  } catch { /* los selects caen a su valor actual */ }
}

// ── Detalle ────────────────────────────────────────────────
const selected = ref<Solicitud | null>(null)
const historial = ref<HistorialItem[]>([])
const detalleError = ref('')
const busy = ref(false)

async function abrir(item: Solicitud) {
  selected.value = item
  detalleError.value = ''
  historial.value = []
  // El panel de gestión se siembra ANTES del await, desde la fila de la lista: si el
  // GET del detalle falla, `selected` ya es el nuevo registro y `gestion` no puede
  // quedarse con los valores del anterior — guardar entonces escribiría la
  // transportadora y el estado de otra solicitud sobre esta.
  gestion.value = gestionDesde(item)
  try {
    const res = await $fetch<{ data: Solicitud; historial: HistorialItem[] }>(
      `/api/solicitudes-transporte/${item.id}`,
    )
    // Descarta la respuesta si el usuario ya cambió de registro o volvió al listado.
    if (selected.value?.id !== item.id) return
    selected.value = res.data
    historial.value = res.historial ?? []
    gestion.value = gestionDesde(res.data)
  } catch (e) {
    if (selected.value?.id !== item.id) return
    detalleError.value = apiErr(e, 'No se pudo cargar el detalle')
  }
}

function cerrarDetalle() {
  selected.value = null
  historial.value = []
  detalleError.value = ''
}

// ── Gestión ────────────────────────────────────────────────
function gestionDesde(s: Solicitud): GestionForm {
  return {
    documentoNetSuite: s.documentoNetSuite ?? '',
    stellaEstado: s.stellaEstado ?? 'PENDIENTE',
    transportadora: s.transportadora ?? '',
    numeroGuia: s.numeroGuia ?? '',
    fechaProgramacion: s.fechaProgramacion ?? '',
    observacionTransporte: s.observacionTransporte ?? '',
  }
}
const gestion = ref<GestionForm>({
  documentoNetSuite: '', stellaEstado: 'PENDIENTE', transportadora: '',
  numeroGuia: '', fechaProgramacion: '', observacionTransporte: '',
})

async function guardarGestion() {
  if (!selected.value) return
  const id = selected.value.id
  busy.value = true
  detalleError.value = ''
  const g = gestion.value
  // Solo las 6 claves de gestión, y "" → null: un string vacío en fechaProgramacion
  // rompe el regex del servidor y devuelve un 400 ilegible.
  const body = {
    documentoNetSuite: g.documentoNetSuite.trim() || null,
    stellaEstado: g.stellaEstado,
    transportadora: g.transportadora || null,
    numeroGuia: g.numeroGuia.trim() || null,
    fechaProgramacion: g.fechaProgramacion || null,
    observacionTransporte: g.observacionTransporte.trim() || null,
  }
  try {
    const res = await $fetch<{ data: Solicitud }>(`/api/solicitudes-transporte/${id}`, {
      method: 'PATCH', body,
    })
    // Si el usuario volvió al listado mientras guardaba, no reabrir el detalle solo.
    if (selected.value?.id !== id) { showToast('Gestión guardada ✓'); await loadLista(); return }
    selected.value = res.data
    showToast('Gestión guardada ✓')
    await Promise.all([loadLista(), recargarHistorial()])
  } catch (e) {
    detalleError.value = apiErr(e, 'No se pudo guardar la gestión')
    showToast(detalleError.value, true)
  } finally {
    busy.value = false
  }
}

async function recargarHistorial() {
  if (!selected.value) return
  try {
    const res = await $fetch<{ historial: HistorialItem[] }>(`/api/solicitudes-transporte/${selected.value.id}`)
    historial.value = res.historial ?? []
  } catch { /* el detalle sigue siendo válido sin refrescar el historial */ }
}

// ── Rechazar / reenviar / borrar ───────────────────────────
const showRechazar = ref(false)
const rechazarError = ref('')

async function confirmarRechazo(motivo: string) {
  if (!selected.value) return
  const id = selected.value.id
  busy.value = true
  rechazarError.value = ''
  try {
    const res = await $fetch<{ data: Solicitud }>(
      `/api/solicitudes-transporte/${id}/rechazar`,
      { method: 'POST', body: { motivoRechazo: motivo } },
    )
    showRechazar.value = false
    if (selected.value?.id !== id) { showToast('Solicitud rechazada'); await loadLista(); return }
    // La respuesta ya trae `plines` (el include del servidor los incluye), así que
    // el detalle no se queda sin PLUs como pasaba en la versión React.
    selected.value = res.data
    showToast('Solicitud rechazada')
    await Promise.all([loadLista(), recargarHistorial()])
  } catch (e) {
    rechazarError.value = apiErr(e, 'No se pudo rechazar')
  } finally {
    busy.value = false
  }
}

async function reenviar() {
  if (!selected.value) return
  const id = selected.value.id
  busy.value = true
  detalleError.value = ''
  try {
    const res = await $fetch<{ data: Solicitud }>(
      `/api/solicitudes-transporte/${id}/reenviar`, { method: 'POST' },
    )
    if (selected.value?.id !== id) { showToast('Solicitud reenviada ✓'); await loadLista(); return }
    selected.value = res.data
    showToast('Solicitud reenviada ✓')
    await Promise.all([loadLista(), recargarHistorial()])
  } catch (e) {
    detalleError.value = apiErr(e, 'No se pudo reenviar')
    showToast(detalleError.value, true)
  } finally {
    busy.value = false
  }
}

const borrando = ref<Solicitud | null>(null)
const deleting = ref(false)
async function confirmarBorrado() {
  if (!borrando.value) return
  deleting.value = true
  try {
    // El motivo va en la query: el body de un DELETE no siempre sobrevive.
    const motivo = encodeURIComponent('Archivada desde interfaz')
    // `as string` como en integracion.vue: con URL literal, $fetch estrecha el tipo
    // del método a GET y rechaza DELETE.
    const url = `/api/solicitudes-transporte/${borrando.value.id}?motivo=${motivo}` as string
    await $fetch(url, { method: 'DELETE' })
    borrando.value = null
    cerrarDetalle()
    showToast('Solicitud archivada')
    await loadLista()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo archivar'), true)
  } finally {
    deleting.value = false
  }
}

// ── Formulario ─────────────────────────────────────────────
const showForm = ref(false)
const editando = ref<Solicitud | null>(null)

function nueva() { editando.value = null; showForm.value = true }
function corregir(item: Solicitud) { editando.value = item; showForm.value = true }

async function onGuardada(data: Solicitud) {
  showForm.value = false
  editando.value = null
  showToast('Solicitud guardada ✓')
  if (selected.value?.id === data.id) {
    selected.value = data
    await recargarHistorial()
  }
  await loadLista()
}

// ── Ciclo de vida ──────────────────────────────────────────
onMounted(async () => {
  await ensureSession()
  if (!puedeVer.value) { loading.value = false; return }
  loading.value = true
  await Promise.all([loadLista(), loadCatalogos()])
  loading.value = false

  // Las notificaciones enlazan a ?id=<id>. La página React ignoraba el parámetro y
  // el usuario aterrizaba en la lista sin saber qué mirar.
  const id = route.query.id ? String(route.query.id) : ''
  if (id) {
    const enLista = items.value.find((s) => s.id === id)
    if (enLista) await abrir(enLista)
    else {
      try {
        const res = await $fetch<{ data: Solicitud; historial: HistorialItem[] }>(`/api/solicitudes-transporte/${id}`)
        selected.value = res.data
        historial.value = res.historial ?? []
        gestion.value = gestionDesde(res.data)
      } catch (e) {
        showToast(apiErr(e, 'No se pudo abrir la solicitud del enlace'), true)
      }
    }
  }
})

watch(page, () => { void loadLista() })
watch([fQ, fEstado, fSemaforo, fPrioridad, fArea], () => {
  // Si había paginación, basta con volver a la 1: el watcher de `page` recarga.
  // Hacer las dos cosas disparaba dos peticiones idénticas.
  if (page.value !== 1) { page.value = 1; return }
  void loadLista()
})

// useAutoRefresh congela enabled/pause al montar, así que las guardas van dentro.
useAutoRefresh({
  onRefresh: () => {
    if (!puedeVer.value) return
    if (showForm.value || showRechazar.value || busy.value || deleting.value || borrando.value) return
    void loadLista()
  },
})

async function refrescar() {
  if (refreshing.value) return
  refreshing.value = true
  await loadLista()
  refreshing.value = false
}

function limpiarFiltros() {
  fQ.value = ''; fEstado.value = ''; fSemaforo.value = ''; fPrioridad.value = ''; fArea.value = ''
}
function onKpiFilter(patch: { estado?: string; semaforo?: string }) {
  if (patch.estado !== undefined) fEstado.value = patch.estado
  if (patch.semaforo !== undefined) fSemaforo.value = patch.semaforo
}

const rechazadas = computed(() => items.value.filter((s) => s.estado === 'RECHAZADA'))
const pendientesGestion = computed(() => (kpis.value.PENDIENTE ?? 0) + (kpis.value.REENVIADA ?? 0))
const heroDesc = computed(() => {
  if (loading.value) return 'Cargando…'
  const n = `${total.value} solicitud${total.value !== 1 ? 'es' : ''}`
  return isGestor.value ? `${n} · ${pendientesGestion.value} pendientes de gestión` : `${n} tuyas`
})
</script>

<template>
  <div class="mod">
    <section class="hero fade-in">
      <div>
        <div class="hero-kicker">
          <span class="hero-ic"><FileText :size="13" /></span> Control transporte
        </div>
        <h1 class="hero-title">Solicitudes de Transporte</h1>
        <p class="hero-desc">{{ heroDesc }}</p>
      </div>
      <!-- Sin acceso no se ofrecen acciones: si no, un rol ajeno al módulo ve "Sin
           acceso" y a la vez un botón que le deja rellenar el formulario entero para
           enterarse del 403 solo al enviarlo. -->
      <div v-if="puedeVer" class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refrescar">
          <RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}
        </button>
        <button class="btn btn-primary btn-sm" @click="nueva"><Plus :size="14" /> Nueva solicitud</button>
      </div>
    </section>

    <!-- Skeleton ANTES del gate: mientras /api/me no responde `role` es '' y
         puedeVer sería false, así que parpadearía "Sin acceso" a usuarios válidos. -->
    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="No tienes acceso al módulo de Solicitudes de Transporte."
    />

    <template v-else>
      <Transition name="view" mode="out-in">
        <SolicitudesTransporteDetalle
          v-if="selected" key="detalle" :item="selected" :historial="historial"
          :is-gestor="isGestor" :can-edit="puedeEditarSolicitud(role, userId, selected)"
          :can-delete="canDelete" :can-reenviar="puedeReenviar(role, userId, selected)"
          :error="detalleError" :busy="busy"
          @back="cerrarDetalle" @editar="corregir(selected)" @borrar="borrando = selected" @reenviar="reenviar"
        >
          <template #gestion>
            <SolicitudesTransporteGestionPanel
              v-model="gestion" :transportadoras="catalogos?.transportadoras ?? []"
              :saving="busy" :puede-rechazar="!['EFECTUADA', 'CANCELADA'].includes(selected.estado)"
              @guardar="guardarGestion" @rechazar="showRechazar = true"
            />
          </template>
        </SolicitudesTransporteDetalle>

        <div v-else key="lista">
          <SolicitudesTransporteRechazadasBanner
            v-if="!isGestor && rechazadas.length" :items="rechazadas"
            @corregir="corregir" @abrir="abrir" @ver-todas="fEstado = 'RECHAZADA'"
          />

          <SolicitudesTransporteKpiRail
            class="bloque" :kpis="kpis" :kpis-semaforo="kpisSemaforo" :is-gestor="isGestor"
            :activo="{ estado: fEstado, semaforo: fSemaforo }" @filter="onKpiFilter"
          />

          <SolicitudesTransporteFiltros
            v-model:q="fQ" v-model:estado="fEstado" v-model:semaforo="fSemaforo"
            v-model:prioridad="fPrioridad" v-model:area="fArea"
            :areas="catalogos?.areas ?? []" :is-gestor="isGestor" @clear="limpiarFiltros"
          />

          <ListSkeleton v-if="loading" />
          <template v-else>
            <SolicitudesTransporteTabla :items="items" :has-filters="hasFilters" @open="abrir" />
            <PageNav v-if="pages > 1" v-model:page="page" :pages="pages" class="pagenav" />
          </template>
        </div>
      </Transition>
    </template>

    <SolicitudesTransporteFormModal
      v-if="showForm && puedeVer" :catalogos="catalogos" :initial="editando"
      @close="showForm = false; editando = null" @saved="onGuardada"
    />
    <SolicitudesTransporteRechazarModal
      v-if="showRechazar && selected" :saving="busy" :error="rechazarError"
      :pedido="selected.numeroPedido || selected.ciudadEntrega"
      @close="showRechazar = false; rechazarError = ''" @confirm="confirmarRechazo"
    />
    <ConfirmModal
      v-if="borrando"
      title="Archivar solicitud"
      message="La solicitud se ocultará del módulo y conservará su historial. ¿Continuar?"
      confirm-label="Archivar" :confirming="deleting"
      @close="borrando = null" @confirm="confirmarBorrado"
    />
  </div>
</template>

<style scoped>
.mod { --modulo: var(--info); }
.hero { position: relative; z-index: 5; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; color: var(--modulo); background: color-mix(in srgb, var(--modulo) 13%, transparent); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 6px 0 0; }
.hero-title::after { content: ''; display: block; width: 42px; height: 3px; border-radius: 2px; background: var(--modulo); margin-top: 7px; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 7px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.bloque { margin-bottom: 18px; }
.pagenav { margin-top: 16px; }

.view-enter-active, .view-leave-active { transition: opacity .28s cubic-bezier(.16,1,.3,1), transform .28s cubic-bezier(.16,1,.3,1); }
.view-enter-from { opacity: 0; transform: translateY(10px); }
.view-leave-to { opacity: 0; transform: translateY(-6px); }
.fade-in { animation: auroraFade .3s cubic-bezier(.16,1,.3,1) both; }

@media (max-width: 760px) { .hero { margin-bottom: 16px; } .hero-title { font-size: 23px; } }
</style>
