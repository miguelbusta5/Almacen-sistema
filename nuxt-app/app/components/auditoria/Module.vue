<script setup lang="ts">
// Registro de auditoría. Solo ADMIN — el endpoint /api/activity exige ese rol y la
// matriz de módulos ahora dice lo mismo (antes prometía el módulo a GERENTE y el
// servidor le devolvía 403).
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Download, ScrollText } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { canSeeModule } from '~/utils/modulePermissions'
import type { LogItem, LogUser } from '~/utils/auditoria'

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const puedeVer = computed(() => canSeeModule(me.value?.role, 'auditoria'))

const PAGE_SIZE = 25
const items = ref<LogItem[]>([])
const users = ref<LogUser[]>([])
const modulos = ref<string[]>([])
const acciones = ref<string[]>([])
const total = ref(0)
const pages = ref(1)
const page = ref(1)
const loading = ref(true)
const refreshing = ref(false)
const exporting = ref(false)

const fQ = ref('')
const fModulo = ref('')
const fAccion = ref('')
const fUser = ref('')
const fFrom = ref('')
const fTo = ref('')
const hasFilters = computed(() =>
  !!(fQ.value || fModulo.value || fAccion.value || fUser.value || fFrom.value || fTo.value))

function queryActual(): Record<string, string | number> {
  const q: Record<string, string | number> = { page: page.value, pageSize: PAGE_SIZE }
  if (fQ.value) q.q = fQ.value
  if (fModulo.value) q.module = fModulo.value
  if (fAccion.value) q.action = fAccion.value
  if (fUser.value) q.userId = fUser.value
  if (fFrom.value) q.from = fFrom.value
  if (fTo.value) q.to = fTo.value
  return q
}

async function load() {
  try {
    const res = await $fetch<{
      data: LogItem[]; total: number; pages: number
      users: LogUser[]; modulos: string[]; acciones: string[]
    }>('/api/activity', { query: queryActual() })
    items.value = res.data
    total.value = res.total
    pages.value = res.pages
    users.value = res.users ?? []
    modulos.value = res.modulos ?? []
    acciones.value = res.acciones ?? []
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar la auditoría'), true)
  }
}

onMounted(async () => {
  await ensureSession()
  if (!puedeVer.value) { loading.value = false; return }
  loading.value = true
  await load()
  loading.value = false
})

watch(page, () => { void load() })
watch([fQ, fModulo, fAccion, fUser, fFrom, fTo], () => {
  // Si había paginación basta con volver a la 1: el watcher de `page` recarga.
  if (page.value !== 1) { page.value = 1; return }
  void load()
})

async function refrescar() {
  if (refreshing.value) return
  refreshing.value = true
  await load()
  refreshing.value = false
}

function limpiar() {
  fQ.value = ''; fModulo.value = ''; fAccion.value = ''
  fUser.value = ''; fFrom.value = ''; fTo.value = ''
}

async function exportar() {
  if (exporting.value) return
  exporting.value = true
  try {
    // El CSV exporta el resultado de los filtros actuales, sin paginar (el servidor
    // lo corta en 5000 filas).
    const { page: _p, pageSize: _ps, ...filtros } = queryActual()
    const csv = await $fetch<string>('/api/activity', {
      query: { ...filtros, export: 'csv' },
      responseType: 'text',
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
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
  <div class="mod">
    <section class="hero fade-in">
      <div>
        <div class="hero-kicker">
          <span class="hero-ic"><ScrollText :size="13" /></span> Administración
        </div>
        <h1 class="hero-title">Auditoría</h1>
        <p class="hero-desc">
          {{ loading ? 'Cargando…' : `${total} movimiento${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}` }}
        </p>
      </div>
      <div v-if="puedeVer" class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refrescar">
          <RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}
        </button>
        <button class="btn btn-sm" :disabled="exporting" @click="exportar">
          <Spinner v-if="exporting" :size="14" /><Download v-else :size="14" />
          {{ exporting ? 'Generando…' : 'Exportar CSV' }}
        </button>
      </div>
    </section>

    <!-- Skeleton antes del gate: mientras /api/me no responde, `role` es undefined y
         puedeVer sería false, así que parpadearía "Sin acceso" a un ADMIN válido. -->
    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="El registro de auditoría está disponible solo para administradores."
    />

    <template v-else>
      <AuditoriaFiltros
        v-model:q="fQ" v-model:modulo="fModulo" v-model:accion="fAccion"
        v-model:user-id="fUser" v-model:from="fFrom" v-model:to="fTo"
        :modulos="modulos" :acciones="acciones" :users="users" @clear="limpiar"
      />

      <ListSkeleton v-if="loading" />
      <template v-else>
        <AuditoriaTabla :items="items" :has-filters="hasFilters" />
        <PageNav v-if="pages > 1" v-model:page="page" :pages="pages" class="pagenav" />
      </template>
    </template>
  </div>
</template>

<style scoped>
.mod { --modulo: var(--bill); }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; color: var(--modulo); background: color-mix(in srgb, var(--modulo) 13%, transparent); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 6px 0 0; }
.hero-title::after { content: ''; display: block; width: 42px; height: 3px; border-radius: 2px; background: var(--modulo); margin-top: 7px; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 7px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.pagenav { margin-top: 16px; }
.fade-in { animation: auroraFade .3s cubic-bezier(.16,1,.3,1) both; }
@media (max-width: 760px) { .hero { margin-bottom: 16px; } .hero-title { font-size: 23px; } }
</style>
