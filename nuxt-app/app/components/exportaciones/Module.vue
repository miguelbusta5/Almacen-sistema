<script setup lang="ts">
// Orquestador de los 3 módulos de Exportación. Las páginas
// (app/pages/exportaciones{,-mexico,-eeuu}.vue) solo le pasan su PaisConfig.
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Download, Tags } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import {
  hoyBogota, puedeGestionarExportaciones, puedeUsarExportaciones, sumarDias,
  type Exportacion, type ExportConteos, type Operario, type PaisConfig, type UserStat,
} from '~/utils/exportaciones'

const props = defineProps<{ cfg: PaisConfig }>()

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const role = computed(() => me.value?.role ?? '')
const userId = computed(() => me.value?.id)
const puedeVer = computed(() => puedeUsarExportaciones(role.value))
const canManage = computed(() => puedeGestionarExportaciones(role.value))
const isAdmin = computed(() => role.value === 'ADMIN')

// ── Listado ────────────────────────────────────────────────
const PAGE_SIZE = 40
const items = ref<Exportacion[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const refreshing = ref(false)
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const fQ = ref('')
const fFecha = ref('')
const fEstado = ref('')
const fUsuario = ref('')

async function loadLista() {
  try {
    const query: Record<string, string | number> = { page: page.value, pageSize: PAGE_SIZE }
    if (fQ.value) query.q = fQ.value
    if (fFecha.value) query.fecha = fFecha.value
    if (fEstado.value) query.estado = fEstado.value
    if (fUsuario.value) query.usuarioId = fUsuario.value
    const res = await $fetch<{ data: Exportacion[]; total: number }>(props.cfg.apiBase, { query })
    items.value = res.data
    total.value = res.total
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los registros'), true)
  }
}

// ── Registro en curso ──────────────────────────────────────
// Viene de su propio endpoint, no de la lista: así el banner sobrevive a los
// filtros y a la paginación.
const abierto = ref<Exportacion | null>(null)
async function loadAbierto() {
  try {
    const res = await $fetch<{ data: Exportacion | null }>(`${props.cfg.apiBase}/abierto`)
    abierto.value = res.data
  } catch { /* no bloquea la vista */ }
}

// ── KPIs ───────────────────────────────────────────────────
const conteos = ref<ExportConteos>({ cajasHoy: 0, enCurso: 0, unidadesHoy: 0, promedioMin: null })
async function loadConteos() {
  try {
    const res = await $fetch<{ data: ExportConteos }>(`${props.cfg.apiBase}/conteos`)
    conteos.value = res.data
  } catch { /* deja los conteos previos si falla */ }
}

// ── Operarios y productividad (solo gestores) ──────────────
const operarios = ref<Operario[]>([])
async function loadOperarios() {
  if (!canManage.value) return
  try {
    const res = await $fetch<{ data: Operario[] }>(`${props.cfg.apiBase}/operarios`)
    operarios.value = res.data
  } catch { /* silencioso: es un filtro auxiliar */ }
}

const stats = ref<UserStat[]>([])
const statsLoading = ref(false)
const showStats = ref(true)
const statsDesde = ref(sumarDias(hoyBogota(), -6))
const statsHasta = ref(hoyBogota())
const statsOperario = ref('')
async function loadStats() {
  if (!canManage.value) return
  statsLoading.value = true
  try {
    const res = await $fetch<{ data: UserStat[] }>(`${props.cfg.apiBase}/stats`, {
      query: { desde: statsDesde.value, hasta: statsHasta.value },
    })
    stats.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar la productividad'), true)
  } finally {
    statsLoading.value = false
  }
}

// ── Ciclo de vida ──────────────────────────────────────────
onMounted(async () => {
  await ensureSession()
  if (!puedeVer.value) { loading.value = false; return }
  loading.value = true
  await Promise.all([loadLista(), loadAbierto(), loadConteos(), loadOperarios(), loadStats()])
  loading.value = false
})

watch(page, () => { void loadLista() })
watch([fQ, fFecha, fEstado, fUsuario], () => {
  page.value = 1
  selectedIds.value = []
  void loadLista()
})
// Cambiar de página también invalida la selección: no queremos mover ids que el
// usuario ya no tiene a la vista.
watch(page, () => { selectedIds.value = [] })

const formDirty = ref(false)
// useAutoRefresh captura `enabled`/`pause` como booleanos planos al montar, así que
// aquí no sirven: la sesión llega después y las pausas son reactivas. La guarda va
// dentro de onRefresh, que sí se evalúa en cada tick.
useAutoRefresh({
  onRefresh: () => {
    if (!puedeVer.value) return
    if (formDirty.value || saving.value || finalizing.value || editando.value || borrando.value || showMover.value) return
    void loadLista()
    void loadAbierto()
    void loadConteos()
  },
})

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  await Promise.all([loadLista(), loadAbierto(), loadConteos()])
  refreshing.value = false
}

function limpiarFiltros() { fQ.value = ''; fFecha.value = ''; fEstado.value = ''; fUsuario.value = '' }
function onKpiFilter(key: string) { fEstado.value = key }

// ── Captura ────────────────────────────────────────────────
const capturaRef = ref<{ reset: () => void } | null>(null)
const saving = ref(false)
const finalizing = ref(false)

async function crear(payload: { numeroCaja: string; plu: string; unidadEmpaque: number }) {
  saving.value = true
  try {
    await $fetch(props.cfg.apiBase, { method: 'POST', body: payload })
    capturaRef.value?.reset()
    showToast(`Caja ${payload.numeroCaja} registrada ✓`)
    await Promise.all([loadLista(), loadAbierto(), loadConteos()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo registrar la caja'), true)
  } finally {
    saving.value = false
  }
}

async function finalizar() {
  if (!abierto.value) return
  finalizing.value = true
  try {
    await $fetch(`${props.cfg.apiBase}/${abierto.value.id}/finalize`, { method: 'POST' })
    showToast('Rotulación finalizada ✓')
    await Promise.all([loadLista(), loadAbierto(), loadConteos()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo finalizar'), true)
  } finally {
    finalizing.value = false
  }
}

// ── Edición y borrado ──────────────────────────────────────
const editando = ref<Exportacion | null>(null)
const borrando = ref<Exportacion | null>(null)
const deleting = ref(false)

async function confirmarBorrado() {
  if (!borrando.value) return
  deleting.value = true
  try {
    await $fetch(`${props.cfg.apiBase}/${borrando.value.id}`, {
      method: 'DELETE',
      query: { motivo: 'Borrado desde interfaz' },
    })
    borrando.value = null
    showToast('Registro borrado')
    await Promise.all([loadLista(), loadAbierto(), loadConteos()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo borrar'), true)
  } finally {
    deleting.value = false
  }
}

async function onEditado() {
  editando.value = null
  showToast('Registro actualizado ✓')
  await Promise.all([loadLista(), loadAbierto(), loadConteos()])
}

// ── Selección múltiple y mover (ADMIN) ─────────────────────
const selectedIds = ref<string[]>([])
const showMover = ref(false)

function toggleSelect(id: string) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}
function toggleSelectAll() {
  selectedIds.value = selectedIds.value.length === items.value.length ? [] : items.value.map((i) => i.id)
}
async function onMovidos(n: number) {
  showMover.value = false
  selectedIds.value = []
  showToast(`${n} registro${n !== 1 ? 's' : ''} movido${n !== 1 ? 's' : ''} ✓`)
  await Promise.all([loadLista(), loadConteos()])
}

// ── Excel ──────────────────────────────────────────────────
const exporting = ref(false)
async function exportar() {
  if (exporting.value) return
  exporting.value = true
  try {
    const query: Record<string, string> = {}
    if (fQ.value) query.q = fQ.value
    if (fFecha.value) query.fecha = fFecha.value
    if (fEstado.value) query.estado = fEstado.value
    if (fUsuario.value) query.usuarioId = fUsuario.value
    const blob = await $fetch<Blob>(`${props.cfg.apiBase}/export`, { query, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `exportaciones-${props.cfg.pais}-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    showToast(apiErr(e, 'No se pudo exportar'), true)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div :style="{ '--pais': cfg.accent }">
    <section class="hero fade-in">
      <div class="hero-left">
        <div class="hero-kicker">
          <span class="hero-ic"><Tags :size="13" /></span>
          Etiquetado · <span class="pais-chip">{{ cfg.paisLabel }}</span>
        </div>
        <h1 class="hero-title">{{ cfg.label }}</h1>
        <p class="hero-desc">
          {{ loading ? 'Cargando…' : `${total} registro${total !== 1 ? 's' : ''}` }}
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refreshAll">
          <RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}
        </button>
        <button v-if="canManage" class="btn btn-sm" :disabled="exporting" @click="exportar">
          <Spinner v-if="exporting" :size="14" /><Download v-else :size="14" />
          {{ exporting ? 'Generando…' : 'Excel' }}
        </button>
      </div>
    </section>

    <!-- El skeleton va ANTES del gate de acceso: mientras /api/me no responde, `role`
         es '' y puedeVer sería false, así que la página parpadearía "Sin acceso" a
         usuarios autorizados en cada navegación entre países. -->
    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="Este módulo está disponible para etiquetado y almacenamiento."
    />

    <template v-else>
      <!-- La captura va primero en el DOM a propósito: es el flujo que ETIQUETADO
           usa todo el día, y en móvil queda a mano sin scroll. -->
      <ExportacionesCaptura
        ref="capturaRef" class="bloque" :accent="cfg.accent" :saving="saving"
        :abierto="abierto" :finalizing="finalizing"
        @submit="crear" @finalize="finalizar" @dirty="formDirty = $event"
      />

      <ExportacionesKpiRail class="bloque" :counts="conteos" :accent="cfg.accent" @filter="onKpiFilter" />

      <ExportacionesProductividad
        v-if="canManage" class="bloque"
        v-model:desde="statsDesde" v-model:hasta="statsHasta"
        v-model:operario="statsOperario" v-model:open="showStats"
        :stats="stats" :loading="statsLoading" :operarios="operarios" :accent="cfg.accent"
        @aplicar="loadStats"
      />

      <div v-if="isAdmin && selectedIds.length" class="selbar">
        <b class="tnum">{{ selectedIds.length }}</b> seleccionado{{ selectedIds.length !== 1 ? 's' : '' }}
        <button class="btn btn-sm mover" @click="showMover = true">Mover a otro país</button>
        <button class="btn-link" @click="selectedIds = []">Cancelar selección</button>
      </div>

      <ExportacionesFiltros
        v-model:q="fQ" v-model:fecha="fFecha" v-model:estado="fEstado" v-model:usuario-id="fUsuario"
        :operarios="operarios" :can-manage="canManage" @clear="limpiarFiltros"
      />

      <ListSkeleton v-if="loading" />
      <template v-else>
        <ExportacionesTabla
          :items="items" :can-manage="canManage" :user-id="userId"
          :selectable="isAdmin" :selected-ids="selectedIds"
          @editar="editando = $event" @borrar="borrando = $event"
          @toggle-select="toggleSelect" @toggle-select-all="toggleSelectAll"
        />
        <PageNav v-if="pages > 1" v-model:page="page" :pages="pages" class="pagenav" />
      </template>
    </template>

    <ExportacionesEditarModal
      v-if="editando" :item="editando" :cfg="cfg" :can-manage="canManage"
      @close="editando = null" @saved="onEditado"
    />
    <ConfirmModal
      v-if="borrando"
      title="Borrar registro"
      :message="`Se marcará como borrada la caja ${borrando.numeroCaja} (PLU ${borrando.plu}). Podrás verla en auditoría.`"
      confirm-label="Borrar" :confirming="deleting"
      @close="borrando = null" @confirm="confirmarBorrado"
    />
    <ExportacionesMoverModal
      v-if="showMover" :ids="selectedIds" :cfg="cfg"
      @close="showMover = false" @moved="onMovidos"
    />
  </div>
</template>

<style scoped>
.hero { position: relative; z-index: 5; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; color: var(--pais); background: color-mix(in srgb, var(--pais) 13%, transparent); }
.pais-chip { color: var(--pais); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 6px 0 0; }
.hero-title::after { content: ''; display: block; width: 42px; height: 3px; border-radius: 2px; background: var(--pais); margin-top: 7px; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 7px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.bloque { margin-bottom: 18px; }

.selbar {
  display: flex; align-items: center; gap: 11px; flex-wrap: wrap; margin-bottom: 14px;
  padding: 10px 14px; border-radius: var(--r-sm); font-size: 13px; color: var(--ink-2);
  background: color-mix(in srgb, var(--pais) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--pais) 30%, transparent);
}
.selbar b { font-size: 15px; color: var(--pais); }
.mover { margin-left: auto; border-color: color-mix(in srgb, var(--pais) 45%, transparent); color: var(--pais); }
.btn-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; }
.btn-link:hover { color: var(--ink-2); }

.pagenav { margin-top: 16px; }

@media (max-width: 760px) {
  .hero { margin-bottom: 16px; }
  .hero-title { font-size: 23px; }
}
</style>
