<script setup lang="ts">
// Orquestador del módulo Estibas (montacargas). Sustituye la "PLANILLA
// MONTACARGAS" de Google Sheets: el ciclo es crear estiba → asignar ubicación →
// confirmación → siguiente, con el reloj sellado por el servidor.
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { RefreshCw, Download, Forklift } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_ESTIBAS, puedeGestionarEstibas, puedeUsarEstibas,
  type Estiba, type EstibaConteos, type Operario,
} from '~/utils/estibas'

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const role = computed(() => me.value?.role ?? '')
const userId = computed(() => me.value?.id)
const puedeVer = computed(() => puedeUsarEstibas(role.value))
const canManage = computed(() => puedeGestionarEstibas(role.value))

// ── Listado ────────────────────────────────────────────────
const PAGE_SIZE = 40
const items = ref<Estiba[]>([])
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
    const res = await $fetch<{ data: Estiba[]; total: number }>(API_ESTIBAS, { query })
    items.value = res.data
    total.value = res.total
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar las estibas'), true)
  }
}

// ── Estiba en curso ────────────────────────────────────────
// Endpoint propio, no derivado de la lista: el paso de ubicar tiene que
// sobrevivir a los filtros, la paginación y a recargar la página.
const abierta = ref<Estiba | null>(null)
async function loadAbierta() {
  try {
    const res = await $fetch<{ data: Estiba | null }>(`${API_ESTIBAS}/abierta`)
    abierta.value = res.data
  } catch { /* no bloquea la vista */ }
}

// ── KPIs ───────────────────────────────────────────────────
const conteos = ref<EstibaConteos>({ estibasHoy: 0, cajasHoy: 0, unidadesHoy: 0, enCurso: 0, promedioMin: null })
async function loadConteos() {
  try {
    const res = await $fetch<{ data: EstibaConteos }>(`${API_ESTIBAS}/conteos`)
    conteos.value = res.data
  } catch { /* deja los conteos previos si falla */ }
}

// ── Operarios (filtro, solo gestores) ──────────────────────
const operarios = ref<Operario[]>([])
async function loadOperarios() {
  if (!canManage.value) return
  try {
    const res = await $fetch<{ data: Operario[] }>(`${API_ESTIBAS}/operarios`)
    operarios.value = res.data
  } catch { /* silencioso: es un filtro auxiliar */ }
}

// ── Ciclo de vida ──────────────────────────────────────────
onMounted(async () => {
  await ensureSession()
  if (!puedeVer.value) { loading.value = false; return }
  loading.value = true
  await Promise.all([loadLista(), loadAbierta(), loadConteos(), loadOperarios()])
  loading.value = false
})

watch(page, () => { void loadLista() })
watch([fQ, fFecha, fEstado, fUsuario], () => {
  page.value = 1
  void loadLista()
})

const formDirty = ref(false)
// La guarda va dentro de onRefresh y no en `enabled`: useAutoRefresh captura los
// booleanos al montar, y la sesión llega después.
useAutoRefresh({
  onRefresh: () => {
    if (!puedeVer.value) return
    // Nunca refrescar con una estiba abierta: el panel de ubicación tiene el
    // foco en su input y un re-render le robaría lo que el operario escribe.
    if (abierta.value || formDirty.value || saving.value || cerrando.value || editando.value) return
    void loadLista()
    void loadAbierta()
    void loadConteos()
  },
})

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  await Promise.all([loadLista(), loadAbierta(), loadConteos()])
  refreshing.value = false
}

function limpiarFiltros() { fQ.value = ''; fFecha.value = ''; fEstado.value = ''; fUsuario.value = '' }
function onKpiFilter(key: string) { fEstado.value = key }

// ── Paso 1: crear ──────────────────────────────────────────
const capturaRef = ref<{ reset: () => void } | null>(null)
const saving = ref(false)
// El pedido vive aquí y no en Captura porque ese componente se desmonta mientras
// hay una estiba en curso. Un contenedor son decenas de estibas del mismo pedido.
const pedido = ref('')

async function crear(payload: { pedido: string; codigo: string; cajas: number; unidadesPorCaja: number }) {
  saving.value = true
  try {
    const res = await $fetch<{ data: Estiba }>(API_ESTIBAS, { method: 'POST', body: payload })
    abierta.value = res.data
    await Promise.all([loadLista(), loadConteos()])
  } catch (e: any) {
    // 409: ya había una estiba abierta. El servidor la devuelve para que la UI
    // salte al paso de ubicar en vez de dejar al operario atascado creando.
    const yaAbierta = e?.data?.data?.estiba as Estiba | undefined
    if (yaAbierta) {
      abierta.value = yaAbierta
      showToast('Ya tenías una estiba en curso: asígnale la ubicación', true)
    } else {
      showToast(apiErr(e, 'No se pudo crear la estiba'), true)
    }
  } finally {
    saving.value = false
  }
}

// ── Paso 2: ubicar (cierra la estiba) ──────────────────────
const cerrando = ref(false)
const exito = ref<Estiba | null>(null)
let exitoTimer: ReturnType<typeof setTimeout> | null = null

async function asignarUbicacion(ubicacion: string) {
  if (!abierta.value) return
  cerrando.value = true
  try {
    const res = await $fetch<{ data: Estiba }>(`${API_ESTIBAS}/${abierta.value.id}/ubicacion`, {
      method: 'POST',
      body: { ubicacion },
    })
    abierta.value = null

    // Confirmación de proceso exitoso: overlay + sonido/vibración, para que el
    // operario lo perciba sin mirar la pantalla y encadene la siguiente.
    exito.value = res.data
    sonarVeredicto('VALIDO')
    if (exitoTimer) clearTimeout(exitoTimer)
    exitoTimer = setTimeout(() => { exito.value = null }, 1800)

    // Captura vuelve a montarse (era el v-else de `abierta`), ya con el pedido
    // intacto y el foco en el código. El reset es la red por si en algún flujo
    // el componente no llegara a desmontarse.
    await nextTick()
    capturaRef.value?.reset()

    await Promise.all([loadLista(), loadConteos()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cerrar la estiba'), true)
  } finally {
    cerrando.value = false
  }
}

// ── Edición y borrado ──────────────────────────────────────
const editando = ref<Estiba | null>(null)
const borrando = ref<Estiba | null>(null)
const deleting = ref(false)

async function confirmarBorrado() {
  if (!borrando.value) return
  deleting.value = true
  try {
    await $fetch(`${API_ESTIBAS}/${borrando.value.id}`, {
      method: 'DELETE',
      query: { motivo: 'Borrado desde interfaz' },
    })
    borrando.value = null
    showToast('Estiba borrada')
    await Promise.all([loadLista(), loadAbierta(), loadConteos()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo borrar'), true)
  } finally {
    deleting.value = false
  }
}

async function onEditado() {
  editando.value = null
  showToast('Estiba actualizada ✓')
  await Promise.all([loadLista(), loadAbierta(), loadConteos()])
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
    const blob = await $fetch<Blob>(`${API_ESTIBAS}/export`, { query, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `estibas-${new Date().toISOString().slice(0, 10)}.xlsx`
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
  <div>
    <section class="hero fade-in">
      <div class="hero-left">
        <div class="hero-kicker">
          <span class="hero-ic"><Forklift :size="13" /></span>
          Montacargas · Flujo CEDI
        </div>
        <h1 class="hero-title">Estibas</h1>
        <p class="hero-desc">
          {{ loading ? 'Cargando…' : `${total} estiba${total !== 1 ? 's' : ''}` }}
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

    <!-- El skeleton va ANTES del gate de acceso: mientras /api/me no responde,
         `role` es '' y puedeVer sería false, así que la página parpadearía
         "Sin acceso" a usuarios autorizados en cada navegación. -->
    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="Este módulo está disponible para montacarguistas y supervisión de almacenamiento."
    />

    <template v-else>
      <!-- Un paso o el otro, nunca los dos: con una estiba abierta lo único que
           se puede hacer es ubicarla. Así no hay forma de armar dos a la vez y
           el tiempo medido sigue significando algo. -->
      <EstibasUbicacionPanel
        v-if="abierta" class="bloque" :estiba="abierta" :saving="cerrando"
        @submit="asignarUbicacion"
      />
      <EstibasCaptura
        v-else ref="capturaRef" v-model:pedido="pedido" class="bloque" :saving="saving"
        @submit="crear" @dirty="formDirty = $event"
      />

      <EstibasKpiRail class="bloque" :counts="conteos" @filter="onKpiFilter" />

      <EstibasFiltros
        v-model:q="fQ" v-model:fecha="fFecha" v-model:estado="fEstado" v-model:usuario-id="fUsuario"
        :operarios="operarios" :can-manage="canManage" @clear="limpiarFiltros"
      />

      <ListSkeleton v-if="loading" />
      <template v-else>
        <EstibasTabla
          :items="items" :can-manage="canManage" :user-id="userId"
          @editar="editando = $event" @borrar="borrando = $event"
        />
        <PageNav v-if="pages > 1" v-model:page="page" :pages="pages" class="pagenav" />
      </template>
    </template>

    <EstibasEditarModal
      v-if="editando" :item="editando" :can-manage="canManage"
      @close="editando = null" @saved="onEditado"
    />
    <ConfirmModal
      v-if="borrando"
      title="Borrar estiba"
      :message="`Se marcará como borrada la estiba del pedido ${borrando.pedido} (PLU ${borrando.plu}). Podrás verla en auditoría.`"
      confirm-label="Borrar" :confirming="deleting"
      @close="borrando = null" @confirm="confirmarBorrado"
    />
    <EstibasExitoOverlay :estiba="exito" />
  </div>
</template>

<style scoped>
.hero { position: relative; z-index: 5; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }
.hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.bloque { margin-bottom: 18px; }
.pagenav { margin-top: 16px; }

@media (max-width: 700px) {
  .hero-title { font-size: 24px; }
}
</style>
