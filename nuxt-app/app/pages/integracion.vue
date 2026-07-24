<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Plus, RefreshCw, Search, X } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { areaFromRole, type Integracion } from '~/utils/integracion'

definePageMeta({ title: 'Integración Pedidos' })

const { me } = useSessionState()
const { show: showToast } = useToast()

const ALLOWED = ['OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE', 'TRANSPORTE']
const CREATOR_ROLES = ['OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']
const TRANSPORT_ROLES = ['SUPERVISOR_TRANSPORTE', 'TRANSPORTE', 'ADMIN', 'GERENTE']

const role = computed(() => me.value?.role ?? '')
const puedeVer = computed(() => ALLOWED.includes(role.value))
const canCreate = computed(() => CREATOR_ROLES.includes(role.value))
const canTransport = computed(() => TRANSPORT_ROLES.includes(role.value))
const isAdmin = computed(() => role.value === 'ADMIN')
const puedeEditar = computed(() => role.value === 'ADMIN' || role.value === 'GERENTE')
function puedeEditarItem(item: Integracion) { return puedeEditar.value && item.estado !== 'COMPLETADA' }
function canCompleteArea2(item: Integracion) {
  if (item.estado !== 'PENDIENTE_AREA2') return false
  if (role.value === 'ADMIN' || role.value === 'GERENTE') return true
  const a = areaFromRole(role.value)
  if (!a) return false
  return a !== item.areaIniciadora
}

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const integraciones = ref<Integracion[]>([])
const total = ref(0)
const loading = ref(true)
const refreshing = ref(false)

const search = ref('')
const filterEstado = ref('')
const filterArea = ref('')
const filterTipo = ref('')
const hasFilters = computed(() => !!(search.value || filterEstado.value || filterArea.value || filterTipo.value))
function clearFilters() { search.value = ''; filterEstado.value = ''; filterArea.value = ''; filterTipo.value = '' }

async function loadAll() {
  try {
    const query: Record<string, string> = {}
    if (filterEstado.value) query.estado = filterEstado.value
    if (filterArea.value) query.area = filterArea.value
    if (filterTipo.value) query.tipoDocumento = filterTipo.value
    const res = await $fetch<{ data: Integracion[]; total: number }>('/api/integracion', { query })
    integraciones.value = res.data
    total.value = res.total
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar integración de pedidos'), true)
  }
}

onMounted(async () => {
  ensureSession()
  loading.value = true
  await loadAll()
  loading.value = false
})
watch([filterEstado, filterArea, filterTipo], () => { void loadAll() })

async function refreshList() {
  if (refreshing.value) return
  refreshing.value = true
  await loadAll()
  refreshing.value = false
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return integraciones.value
  return integraciones.value.filter((i) =>
    i.numeroDocumento.toLowerCase().includes(q)
    || i.tipoDocumento.toLowerCase().includes(q)
    || (i.creadoPorNombre ?? '').toLowerCase().includes(q),
  )
})

// panel + modales
const selected = ref<Integracion | null>(null)
const showNueva = ref(false)
const completarItem = ref<Integracion | null>(null)
const recibidoItem = ref<Integracion | null>(null)
const editandoItem = ref<Integracion | null>(null)
const deletingId = ref<string | null>(null)

function refresh() {
  void loadAll()
  selected.value = null
  completarItem.value = null
  recibidoItem.value = null
  editandoItem.value = null
}

async function deleteIntegracion(id: string) {
  try {
    await $fetch(`/api/integracion/${id}` as string, { method: 'DELETE' })
    selected.value = null
    deletingId.value = null
    showToast('Integración eliminada')
    refresh()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo eliminar'), true)
    deletingId.value = null
  }
}

function onCreated() { showNueva.value = false; showToast('Integración creada ✓'); refresh() }
function onNeedCompleteArea2(item: Integracion) { showNueva.value = false; completarItem.value = item }
function onCompleted() { completarItem.value = null; showToast('Área 2 completada ✓'); refresh() }
function onRecibidoDone() { recibidoItem.value = null; showToast('Recepción confirmada ✓'); refresh() }
function onEditado() { editandoItem.value = null; showToast('Integración actualizada ✓'); refresh() }
</script>

<template>
  <div>
    <section class="hero fade-in">
      <div class="hero-left">
        <div class="hero-kicker">OVDM + TSDM</div>
        <h1 class="hero-title">Integración de Pedidos</h1>
        <p class="hero-desc">{{ loading ? 'Cargando…' : `${total} integración${total !== 1 ? 'es' : ''}` }}</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refreshList"><RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}</button>
        <button v-if="canCreate" class="btn btn-primary btn-sm" @click="showNueva = true"><Plus :size="14" /> Nueva integración</button>
      </div>
    </section>

    <EmptyState v-if="!puedeVer" title="Sin acceso" description="No tienes acceso a este módulo." />

    <template v-else>
      <Transition name="view" mode="out-in">
        <IntegracionDetail
          v-if="selected" key="detail" :item="selected"
          :can-edit="puedeEditarItem(selected)" :can-complete-area2="canCompleteArea2(selected)"
          :can-transport="canTransport" :is-admin="isAdmin" :deleting="deletingId === selected.id"
          @back="selected = null"
          @editar="editandoItem = selected"
          @completar="completarItem = selected; selected = null"
          @recibido="recibidoItem = selected; selected = null"
          @delete-start="deletingId = selected!.id"
          @delete-confirm="deleteIntegracion(selected!.id)"
          @delete-cancel="deletingId = null"
        />

        <div v-else key="list">
          <div class="filters">
            <div class="search-wrap">
              <Search :size="14" class="search-ic" />
              <input v-model="search" class="field" placeholder="Buscar documento…">
              <button v-if="search" class="search-clear" @click="search = ''"><X :size="14" /></button>
            </div>
            <select v-model="filterEstado" class="field sel">
              <option value="">Todos los estados</option>
              <option value="PENDIENTE_AREA2">Pendiente Área 2</option>
              <option value="LISTA_TRANSPORTE">Lista para transporte</option>
              <option value="COMPLETADA">Completada</option>
            </select>
            <select v-model="filterArea" class="field sel">
              <option value="">Todas las áreas</option>
              <option value="MUEBLES">Muebles</option>
              <option value="GOURMET">Gourmet</option>
            </select>
            <select v-model="filterTipo" class="field sel">
              <option value="">OVDM + TSDM</option>
              <option value="OVDM">OVDM</option>
              <option value="TSDM">TSDM</option>
            </select>
            <button v-if="hasFilters" class="btn-link" @click="clearFilters">Limpiar</button>
          </div>

          <ListSkeleton v-if="loading" />
          <IntegracionTable
            v-else :items="filtered" :can-complete-area2="canCompleteArea2" :can-transport="canTransport"
            :can-edit="puedeEditarItem" :is-admin="isAdmin" :deleting-id="deletingId"
            @row-click="selected = $event"
            @editar="editandoItem = $event"
            @completar="completarItem = $event"
            @recibido="recibidoItem = $event"
            @delete-start="deletingId = $event"
            @delete-confirm="deleteIntegracion"
            @delete-cancel="deletingId = null"
          />
        </div>
      </Transition>
    </template>

    <IntegracionNuevaIntegracionModal
      v-if="showNueva" :role="role"
      @close="showNueva = false" @created="onCreated" @need-complete-area2="onNeedCompleteArea2"
    />
    <IntegracionCompletarArea2Modal
      v-if="completarItem" :integracion="completarItem" :role="role"
      @close="completarItem = null" @completed="onCompleted"
    />
    <IntegracionMarcarRecibidoModal
      v-if="recibidoItem" :integracion="recibidoItem"
      @close="recibidoItem = null" @done="onRecibidoDone"
    />
    <IntegracionEditarIntegracionModal
      v-if="editandoItem" :integracion="editandoItem"
      @close="editandoItem = null" @saved="onEditado"
    />
  </div>
</template>

<style scoped>
.hero { position: relative; z-index: 5; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand-deep); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 4px 0 0; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 5px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
.search-wrap { position: relative; flex: 1 1 200px; min-width: 160px; }
.search-wrap .field { padding-left: 32px; padding-right: 32px; width: 100%; }
.search-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; display: grid; place-items: center; border: none; background: none; color: var(--muted); cursor: pointer; border-radius: var(--r-xs); }
.search-clear:hover { background: var(--surface-3); }
.sel { width: auto; }
.btn-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 8px 10px; }
.btn-link:hover { color: var(--ink-2); }

.view-enter-active, .view-leave-active { transition: opacity .28s cubic-bezier(.16,1,.3,1), transform .28s cubic-bezier(.16,1,.3,1); }
.view-enter-from { opacity: 0; transform: translateY(10px); }
.view-leave-to { opacity: 0; transform: translateY(-6px); }
.fade-in { animation: auroraFade .3s cubic-bezier(.16,1,.3,1) both; }
</style>
