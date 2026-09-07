<script setup lang="ts">
// Orquestador de Control Montacargas y Resurtido. Sustituye la "PLANILLA
// MONTACARGAS" de Google Sheets: el ciclo es registrar → asignar ubicación
// final → confirmación → siguiente, con el reloj sellado por el servidor.
//
// El mismo componente sirve a los dos módulos: Control Montacargas le pasa dos
// flujos (recepción y movimientos, como pestañas) y Resurtido uno solo, que se
// renderiza sin barra de pestañas.
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { RefreshCw, Download, Forklift } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_MONTACARGAS, puedeGestionarMontacargas, puedeUsarMontacargas,
  type FlujoConfig, type Movimiento, type MovimientoConteos, type Operario,
} from '~/utils/montacargas'

const props = defineProps<{
  titulo: string
  kicker: string
  /** Uno o más flujos. Con más de uno se dibuja la barra de pestañas. */
  flujos: FlujoConfig[]
}>()

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const role = computed(() => me.value?.role ?? '')
const userId = computed(() => me.value?.id)
const puedeVer = computed(() => puedeUsarMontacargas(role.value))
const canManage = computed(() => puedeGestionarMontacargas(role.value))

// ── Pestaña activa ─────────────────────────────────────────────────
const flujoActivo = ref<FlujoConfig>(props.flujos[0]!)
const tipo = computed(() => flujoActivo.value.tipo)
const hayPestanas = computed(() => props.flujos.length > 1)

// ── Listado ────────────────────────────────────────────────
const PAGE_SIZE = 40
const items = ref<Movimiento[]>([])
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
    const query: Record<string, string | number> = { tipo: tipo.value, page: page.value, pageSize: PAGE_SIZE }
    if (fQ.value) query.q = fQ.value
    if (fFecha.value) query.fecha = fFecha.value
    if (fEstado.value) query.estado = fEstado.value
    if (fUsuario.value) query.usuarioId = fUsuario.value
    const res = await $fetch<{ data: Movimiento[]; total: number }>(API_MONTACARGAS, { query })
    items.value = res.data
    total.value = res.total
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los registros'), true)
  }
}

// ── Registro en curso ──────────────────────────────────────
// Endpoint propio, no derivado de la lista: el paso de ubicar tiene que
// sobrevivir a los filtros, la paginación y a recargar la página.
const abierto = ref<Movimiento | null>(null)
async function loadAbierto() {
  try {
    const res = await $fetch<{ data: Movimiento | null }>(`${API_MONTACARGAS}/abierto`, {
      query: { tipo: tipo.value },
    })
    abierto.value = res.data
  } catch { /* no bloquea la vista */ }
}

// ── KPIs ───────────────────────────────────────────────────
const conteos = ref<MovimientoConteos>({
  registrosHoy: 0, cajasHoy: 0, unidadesHoy: 0, sueltasHoy: 0, enCurso: 0, promedioMin: null,
})
async function loadConteos() {
  try {
    const res = await $fetch<{ data: MovimientoConteos }>(`${API_MONTACARGAS}/conteos`, {
      query: { tipo: tipo.value },
    })
    conteos.value = res.data
  } catch { /* deja los conteos previos si falla */ }
}

// ── Operarios (filtro, solo gestores) ──────────────────────
const operarios = ref<Operario[]>([])
async function loadOperarios() {
  if (!canManage.value) return
  try {
    const res = await $fetch<{ data: Operario[] }>(`${API_MONTACARGAS}/operarios`)
    operarios.value = res.data
  } catch { /* silencioso: es un filtro auxiliar */ }
}

async function cargarTodo() {
  loading.value = true
  await Promise.all([loadLista(), loadAbierto(), loadConteos()])
  loading.value = false
}

// ── Ciclo de vida ──────────────────────────────────────────
onMounted(async () => {
  await ensureSession()
  if (!puedeVer.value) { loading.value = false; return }
  await Promise.all([cargarTodo(), loadOperarios()])
})

// Cambiar de pestaña es cambiar de flujo entero: se reinician filtros y página
// para no arrastrar un filtro que no aplica al otro tipo.
watch(flujoActivo, () => {
  page.value = 1
  fQ.value = ''
  fFecha.value = ''
  fEstado.value = ''
  fUsuario.value = ''
  void cargarTodo()
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
    // Nunca refrescar con un registro abierto: el panel de ubicación tiene el
    // foco en su input y un re-render le robaría lo que el operario escribe.
    if (abierto.value || formDirty.value || saving.value || cerrando.value || editando.value) return
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

// ── Paso 1: registrar ──────────────────────────────────────
const capturaRef = ref<{ reset: () => void } | null>(null)
const saving = ref(false)

async function crear(payload: {
  codigo: string
  cajas: number
  unidadesPorCaja: number
  hayReguero: boolean
  unidadesSueltas: number
  ubicacionInicial?: string
}) {
  saving.value = true
  try {
    const res = await $fetch<{ data: Movimiento }>(API_MONTACARGAS, {
      method: 'POST',
      body: { ...payload, tipo: tipo.value },
    })
    abierto.value = res.data
    await Promise.all([loadLista(), loadConteos()])
  } catch (e: any) {
    // 409: ya había un registro abierto de este tipo. El servidor lo devuelve
    // para que la UI salte al paso de ubicar en vez de dejar al operario
    // atascado creando.
    const yaAbierto = e?.data?.data?.movimiento as Movimiento | undefined
    if (yaAbierto) {
      abierto.value = yaAbierto
      showToast('Ya tenías un registro en curso: asígnale la ubicación final', true)
    } else {
      showToast(apiErr(e, 'No se pudo crear el registro'), true)
    }
  } finally {
    saving.value = false
  }
}

// ── Paso 2: ubicar (cierra el registro) ────────────────────
const cerrando = ref(false)
const exito = ref<Movimiento | null>(null)
let exitoTimer: ReturnType<typeof setTimeout> | null = null

async function asignarUbicacion(ubicacionFinal: string) {
  if (!abierto.value) return
  cerrando.value = true
  try {
    const res = await $fetch<{ data: Movimiento }>(`${API_MONTACARGAS}/${abierto.value.id}/ubicacion`, {
      method: 'POST',
      body: { ubicacionFinal },
    })
    abierto.value = null

    // Confirmación de proceso exitoso: overlay + sonido/vibración, para que el
    // operario lo perciba sin mirar la pantalla y encadene el siguiente.
    exito.value = res.data
    sonarVeredicto('VALIDO')
    if (exitoTimer) clearTimeout(exitoTimer)
    exitoTimer = setTimeout(() => { exito.value = null }, 1800)

    // Captura vuelve a montarse (era el v-else de `abierto`), con el foco en el
    // código. El reset es la red por si en algún flujo no llegara a desmontarse.
    await nextTick()
    capturaRef.value?.reset()

    await Promise.all([loadLista(), loadConteos()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cerrar el registro'), true)
  } finally {
    cerrando.value = false
  }
}

// ── Edición y borrado ──────────────────────────────────────
const editando = ref<Movimiento | null>(null)
const borrando = ref<Movimiento | null>(null)
const deleting = ref(false)

async function confirmarBorrado() {
  if (!borrando.value) return
  deleting.value = true
  try {
    await $fetch(`${API_MONTACARGAS}/${borrando.value.id}`, {
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

// ── Excel ──────────────────────────────────────────────────
const exporting = ref(false)
async function exportar() {
  if (exporting.value) return
  exporting.value = true
  try {
    const query: Record<string, string> = { tipo: tipo.value }
    if (fQ.value) query.q = fQ.value
    if (fFecha.value) query.fecha = fFecha.value
    if (fEstado.value) query.estado = fEstado.value
    if (fUsuario.value) query.usuarioId = fUsuario.value
    const blob = await $fetch<Blob>(`${API_MONTACARGAS}/export`, { query, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `montacargas-${tipo.value.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
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
          {{ kicker }}
        </div>
        <h1 class="hero-title">{{ titulo }}</h1>
        <p class="hero-desc">
          {{ loading ? 'Cargando…' : `${total} registro${total !== 1 ? 's' : ''} · ${flujoActivo.descripcion}` }}
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
      <!-- Con un solo flujo (Resurtido) no se dibuja la barra: una pestaña
           única es ruido que no decide nada. -->
      <nav v-if="hayPestanas" class="tabs" role="tablist">
        <button
          v-for="f in flujos" :key="f.tipo" class="tab" role="tab"
          :class="{ on: f.tipo === flujoActivo.tipo }"
          :aria-selected="f.tipo === flujoActivo.tipo"
          @click="flujoActivo = f"
        >
          {{ f.tab }}
        </button>
      </nav>

      <!-- Un paso o el otro, nunca los dos: con un registro abierto lo único
           que se puede hacer es ubicarlo. Así no hay forma de arrancar dos a la
           vez y el tiempo medido sigue significando algo. -->
      <MontacargasUbicacionPanel
        v-if="abierto" class="bloque" :movimiento="abierto" :saving="cerrando"
        @submit="asignarUbicacion"
      />
      <MontacargasCaptura
        v-else ref="capturaRef" class="bloque" :flujo="flujoActivo" :saving="saving"
        @submit="crear" @dirty="formDirty = $event"
      />

      <MontacargasKpiRail class="bloque" :counts="conteos" @filter="onKpiFilter" />

      <MontacargasFiltros
        v-model:q="fQ" v-model:fecha="fFecha" v-model:estado="fEstado" v-model:usuario-id="fUsuario"
        :operarios="operarios" :can-manage="canManage" @clear="limpiarFiltros"
      />

      <ListSkeleton v-if="loading" />
      <template v-else>
        <MontacargasTabla
          :items="items" :tipo="flujoActivo.tipo" :can-manage="canManage" :user-id="userId"
          @editar="editando = $event" @borrar="borrando = $event"
        />
        <PageNav v-if="pages > 1" v-model:page="page" :pages="pages" class="pagenav" />
      </template>
    </template>

    <MontacargasEditarModal
      v-if="editando" :item="editando" :can-manage="canManage"
      @close="editando = null" @saved="onEditado"
    />
    <ConfirmModal
      v-if="borrando"
      title="Borrar registro"
      :message="`Se marcará como borrado el registro del PLU ${borrando.plu}. Podrás verlo en auditoría.`"
      confirm-label="Borrar" :confirming="deleting"
      @close="borrando = null" @confirm="confirmarBorrado"
    />
    <MontacargasExitoOverlay :movimiento="exito" />
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

.tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
.tab {
  appearance: none; border: none; background: none; cursor: pointer;
  padding: 9px 15px; font-size: 13px; font-weight: 600; color: var(--muted);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color .15s, border-color .15s;
}
.tab:hover { color: var(--ink-2); }
.tab.on { color: var(--brand); border-bottom-color: var(--brand); }
.tab:focus-visible { outline: none; box-shadow: var(--ring); border-radius: var(--r-xs); }

.bloque { margin-bottom: 18px; }
.pagenav { margin-top: 16px; }

@media (max-width: 700px) {
  .hero-title { font-size: 24px; }
  .tab { flex: 1; padding: 11px 8px; }
}
</style>
