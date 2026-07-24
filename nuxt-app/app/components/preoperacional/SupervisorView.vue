<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Download, RefreshCw } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { PREOP_ESTADO_LABEL, PREOP_ESTADO_TONE, type HistorialRow } from '~/utils/preoperacional'

const props = defineProps<{ role: string }>()
const { show: showToast } = useToast()

function apiErr(e: any, fallback: string) {
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || fallback
}

const page = ref(1)
const total = ref(0)
const pages = ref(1)
const rows = ref<HistorialRow[]>([])
const conductores = ref<{ id: string; nombre: string }[]>([])
const loading = ref(true)
const exporting = ref(false)
const refreshing = ref(false)

const fDesde = ref('')
const fHasta = ref('')
const fConductor = ref('')
const fEstado = ref('')
const hasFilters = computed(() => !!(fDesde.value || fHasta.value || fConductor.value || fEstado.value))
function clearFilters() { fDesde.value = ''; fHasta.value = ''; fConductor.value = ''; fEstado.value = '' }

function buildParams(extra?: Record<string, string>) {
  const p = new URLSearchParams()
  if (fDesde.value) p.set('fechaDesde', fDesde.value)
  if (fHasta.value) p.set('fechaHasta', fHasta.value)
  if (fConductor.value) p.set('conductorId', fConductor.value)
  if (fEstado.value) p.set('estado', fEstado.value)
  if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v))
  return p
}

async function loadList() {
  try {
    const qs = buildParams({ page: String(page.value), pageSize: '50' })
    const res = await $fetch<{ data: HistorialRow[]; total: number; pages: number; conductores: { id: string; nombre: string }[] }>(`/api/preoperacional/historial?${qs}`)
    rows.value = res.data
    total.value = res.total
    pages.value = res.pages
    conductores.value = res.conductores ?? []
  } catch (e) {
    showToast(apiErr(e, 'Error cargando historial'), true)
  }
}

onMounted(async () => { loading.value = true; await loadList(); loading.value = false })
watch([fDesde, fHasta, fConductor, fEstado], () => { page.value = 1; void loadList() })
watch(page, () => { void loadList() })

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  await loadList()
  refreshing.value = false
}

async function exportar() {
  exporting.value = true
  try {
    const qs = buildParams()
    const res = await fetch(`/api/preoperacional/export?${qs}`)
    if (!res.ok) throw new Error('Error al exportar')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `preoperacionales-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    showToast(apiErr(e, 'Error al exportar'), true)
  } finally {
    exporting.value = false
  }
}

const selected = ref<HistorialRow | null>(null)
function openDetail(r: HistorialRow) { selected.value = r }

const showConfirmDel = ref(false)
const deleting = ref(false)
async function delInspeccion() {
  if (!selected.value) return
  deleting.value = true
  try {
    await $fetch(`/api/preoperacional/${selected.value.id}` as string, { method: 'DELETE' })
    showConfirmDel.value = false
    selected.value = null
    showToast('Inspección eliminada')
    await loadList()
  } catch (e) {
    showToast(apiErr(e, 'Error al eliminar'), true)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="fade-in">
    <section class="hero">
      <div class="hero-left">
        <div class="hero-kicker">Control de flota</div>
        <h1 class="hero-title">Preoperacional</h1>
        <p class="hero-desc">{{ total }} inspección{{ total !== 1 ? 'es' : '' }} registrada{{ total !== 1 ? 's' : '' }}</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refresh"><RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}</button>
        <button class="btn btn-primary btn-sm" :disabled="exporting" @click="exportar"><Download :size="14" /> {{ exporting ? 'Exportando…' : 'Exportar Excel' }}</button>
      </div>
    </section>

    <PreoperacionalInspeccionDetail
      v-if="selected" :row="selected" :role="props.role"
      @back="selected = null" @delete="showConfirmDel = true"
    />

    <template v-else>
      <div class="filters">
        <input v-model="fDesde" type="date" class="field" title="Desde">
        <input v-model="fHasta" type="date" class="field" title="Hasta">
        <select v-model="fConductor" class="field">
          <option value="">Todos los conductores</option>
          <option v-for="c in conductores" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <select v-model="fEstado" class="field">
          <option value="">Todos los estados</option>
          <option value="APROBADA">Aprobada</option>
          <option value="APROBADA_CON_OBSERVACIONES">Con observaciones</option>
          <option value="BLOQUEADA">Bloqueada</option>
        </select>
        <button v-if="hasFilters" class="btn-link" @click="clearFilters">Limpiar</button>
      </div>

      <ListSkeleton v-if="loading" />
      <EmptyState
        v-else-if="rows.length === 0" title="Sin inspecciones"
        description="No hay inspecciones que coincidan con los filtros seleccionados."
      />
      <div v-else class="card table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th><th>Conductor</th><th>Vehículo</th><th>Km</th><th>Estado</th><th>No conformes</th><th>Críticos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="row" @click="openDetail(r)">
              <td>{{ r.fecha }}</td>
              <td>{{ r.conductor?.nombre ?? '—' }}</td>
              <td>{{ r.vehiculo?.placa ?? '—' }}</td>
              <td>{{ r.kilometraje != null ? `${r.kilometraje} km` : '—' }}</td>
              <td><Badge :label="PREOP_ESTADO_LABEL[r.estado]" :tone="PREOP_ESTADO_TONE[r.estado]" /></td>
              <td>{{ r.noConformes }}</td>
              <td>{{ r.criticos }}</td>
            </tr>
          </tbody>
        </table>
        <PageNav v-if="pages > 1" v-model:page="page" :pages="pages" style="padding: 14px" />
      </div>
    </template>

    <ConfirmModal
      v-if="showConfirmDel && selected" title="Eliminar inspección"
      :message="`¿Eliminar la inspección de ${selected.conductor?.nombre} del ${selected.fecha}? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar" confirming-label="Eliminando…" :confirming="deleting"
      @close="showConfirmDel = false" @confirm="delInspeccion"
    />
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand-deep); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 4px 0 0; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 5px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
.btn-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 8px 10px; }
.btn-link:hover { color: var(--ink-2); }

.table-card { overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.table td { padding: 12px 16px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); }
.row { cursor: pointer; transition: background .12s; }
.row:hover { background: var(--surface-2); }
.row:last-child td { border-bottom: none; }
</style>
