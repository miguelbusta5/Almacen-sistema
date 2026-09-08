<script setup lang="ts">
// Orquestador de Control Montacargas y Resurtido. Sustituye la "PLANILLA
// MONTACARGAS" de Google Sheets.
//
// Ciclo: digitar el PLU arranca el reloj → completar cantidades → asignar la
// ubicación final lo cierra. Por el medio el PLU puede pasar a un ayudante
// (cierra el tramo del primero y abre el del segundo) o quedar en novedad
// (detiene el reloj hasta que alguien verifique).
//
// El mismo componente sirve a los dos módulos y a los dos roles: Control
// Montacargas le pasa dos flujos (pestañas), Resurtido uno solo; y el ayudante
// ve su bandeja en vez del formulario de captura.
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { RefreshCw, Download, Forklift, ScanLine } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_MONTACARGAS, admiteVariosAbiertos, esAyudante as esRolAyudante,
  normalizarCodigoProducto, puedeCrearMovimiento, puedeGestionarMontacargas,
  puedeUsarMontacargas,
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
const puedeCrear = computed(() => puedeCrearMovimiento(role.value))
const ayudante = computed(() => esRolAyudante(role.value))

// ── Pestaña activa ─────────────────────────────────────────────────
const flujoActivo = ref<FlujoConfig>(props.flujos[0]!)
const tipo = computed(() => flujoActivo.value.tipo)
const hayPestanas = computed(() => props.flujos.length > 1)

// ── Reloj compartido ───────────────────────────────────────────────
// Un solo setInterval para todos los cronómetros de la pantalla, no uno por
// tarjeta: en resurtido pueden ser muchos a la vez.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => { tick = setInterval(() => { ahora.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

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

// ── Registros abiertos (bandeja) ───────────────────────────
// Plural: en resurtido pueden correr varios relojes a la vez. Endpoint propio y
// no derivado de la lista: la bandeja tiene que sobrevivir a filtros,
// paginación y a recargar la página.
const abiertos = ref<Movimiento[]>([])
async function loadAbiertos() {
  try {
    const res = await $fetch<{ data: Movimiento[] }>(`${API_MONTACARGAS}/abiertos`, {
      query: { tipo: tipo.value },
    })
    abiertos.value = res.data
  } catch { /* no bloquea la vista */ }
}

// En recepción y movimientos se trabaja una estiba a la vez: con una abierta se
// esconde el formulario para que no haya forma de arrancar dos relojes.
const puedeAbrirOtro = computed(
  () => puedeCrear.value && (admiteVariosAbiertos(tipo.value) || abiertos.value.length === 0),
)

// ── KPIs ───────────────────────────────────────────────────
const conteos = ref<MovimientoConteos>({
  registrosHoy: 0, cajasHoy: 0, unidadesHoy: 0, sueltasHoy: 0, enCurso: 0, conNovedad: 0, promedioMin: null,
})
async function loadConteos() {
  try {
    const res = await $fetch<{ data: MovimientoConteos }>(`${API_MONTACARGAS}/conteos`, {
      query: { tipo: tipo.value },
    })
    conteos.value = res.data
  } catch { /* deja los conteos previos si falla */ }
}

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
  await Promise.all([loadLista(), loadAbiertos(), loadConteos()])
  loading.value = false
}

onMounted(async () => {
  await ensureSession()
  if (!puedeVer.value) { loading.value = false; return }
  await Promise.all([cargarTodo(), loadOperarios()])
})

// Cambiar de pestaña es cambiar de flujo entero: se reinician filtros y página
// para no arrastrar un filtro que no aplica al otro tipo.
watch(flujoActivo, () => {
  page.value = 1
  fQ.value = ''; fFecha.value = ''; fEstado.value = ''; fUsuario.value = ''
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
    // Nunca refrescar con trabajo a medias: las tarjetas abiertas tienen inputs
    // con foco y un re-render le robaría al operario lo que está escribiendo.
    if (formDirty.value || saving.value || guardando.value || editando.value) return
    if (abiertos.value.length > 0) return
    void loadLista()
    void loadAbiertos()
    void loadConteos()
  },
})

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  await Promise.all([loadLista(), loadAbiertos(), loadConteos()])
  refreshing.value = false
}

function limpiarFiltros() { fQ.value = ''; fFecha.value = ''; fEstado.value = ''; fUsuario.value = '' }
function onKpiFilter(key: string) { fEstado.value = key }

// ── Abrir registro (arranca el reloj) ──────────────────────
const capturaRef = ref<{ reset: () => void } | null>(null)
const saving = ref(false)

async function abrir(payload: { codigo: string; ubicacionInicial?: string }) {
  saving.value = true
  try {
    await $fetch(API_MONTACARGAS, { method: 'POST', body: { ...payload, tipo: tipo.value } })
    capturaRef.value?.reset()
    await Promise.all([loadAbiertos(), loadLista(), loadConteos()])
  } catch (e: any) {
    // 409: ya había un registro abierto de este tipo. El servidor lo devuelve
    // para que la UI lo muestre en vez de dejar al operario atascado.
    const yaAbierto = e?.data?.data?.movimiento as Movimiento | undefined
    if (yaAbierto) {
      await loadAbiertos()
      showToast('Ya tenías un registro en curso: ciérralo o descártalo', true)
    } else {
      showToast(apiErr(e, 'No se pudo abrir el registro'), true)
    }
  } finally {
    saving.value = false
  }
}

// ── Acciones sobre un registro abierto ─────────────────────
const guardando = ref('')
const exito = ref<Movimiento | null>(null)
let exitoTimer: ReturnType<typeof setTimeout> | null = null

async function accion<T>(id: string, fn: () => Promise<T>, fallback: string): Promise<T | null> {
  guardando.value = id
  try {
    return await fn()
  } catch (e) {
    showToast(apiErr(e, fallback), true)
    return null
  } finally {
    guardando.value = ''
  }
}

async function guardarCantidades(m: Movimiento, payload: Record<string, unknown>) {
  const ok = await accion(m.id, () =>
    $fetch(`${API_MONTACARGAS}/${m.id}/cantidades`, { method: 'PATCH', body: payload }),
    'No se pudieron guardar las cantidades')
  if (ok) await loadAbiertos()
}

async function ubicar(m: Movimiento, ubicacionFinal: string) {
  const res = await accion(m.id, () =>
    $fetch<{ data: Movimiento }>(`${API_MONTACARGAS}/${m.id}/ubicacion`, {
      method: 'POST', body: { ubicacionFinal },
    }), 'No se pudo cerrar el registro')
  if (!res) return

  // Confirmación de proceso exitoso: overlay + sonido/vibración, para que el
  // operario lo perciba sin mirar la pantalla y encadene el siguiente.
  exito.value = res.data
  sonarVeredicto('VALIDO')
  if (exitoTimer) clearTimeout(exitoTimer)
  exitoTimer = setTimeout(() => { exito.value = null }, 1800)

  await Promise.all([loadAbiertos(), loadLista(), loadConteos()])
  await nextTick()
  capturaRef.value?.reset()
}

async function descartar(m: Movimiento) {
  const ok = await accion(m.id, () =>
    $fetch(`${API_MONTACARGAS}/${m.id}/descartar`, { method: 'POST', body: {} }),
    'No se pudo descartar')
  if (ok) {
    showToast('Registro descartado')
    await Promise.all([loadAbiertos(), loadLista(), loadConteos()])
  }
}

// ── Traspaso y novedades ───────────────────────────────────
const traspasando = ref<Movimiento | null>(null)
const marcandoNovedad = ref<Movimiento | null>(null)
const resolviendo = ref<Movimiento | null>(null)

async function onTraspasado(nombre: string) {
  traspasando.value = null
  showToast(`PLU pasado a ${nombre} ✓`)
  await Promise.all([loadAbiertos(), loadLista(), loadConteos()])
}
async function onNovedadCreada() {
  marcandoNovedad.value = null
  showToast('Novedad marcada: el reloj se detuvo', true)
  await Promise.all([loadAbiertos(), loadLista(), loadConteos()])
}
async function onNovedadResuelta() {
  resolviendo.value = null
  showToast('Novedad resuelta ✓')
  await Promise.all([loadAbiertos(), loadLista(), loadConteos()])
}

// ── Escaneo en la bandeja del ayudante ─────────────────────
// El ayudante puede tener varios PLUs cargados: escanea el que trae en la mano
// y la tarjeta correspondiente se resalta y toma el foco. Es lo que hace la
// confirmación de una sola pulsación.
const escaneo = ref('')
const destacadoId = ref('')
function onEscanear() {
  const codigo = normalizarCodigoProducto(escaneo.value)
  if (!codigo) return
  const encontrado = abiertos.value.find((m) => m.plu === codigo || m.ean === codigo)
  if (!encontrado) {
    showToast('Ese PLU no está en tu bandeja', true)
    sonarVeredicto('CAJA_AJENA')
    return
  }
  destacadoId.value = encontrado.id
  sonarVeredicto('VALIDO')
  escaneo.value = ''
}

// ── Edición y borrado (gestión) ────────────────────────────
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
    await Promise.all([loadLista(), loadAbiertos(), loadConteos()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo borrar'), true)
  } finally {
    deleting.value = false
  }
}

async function onEditado() {
  editando.value = null
  showToast('Registro actualizado ✓')
  await Promise.all([loadLista(), loadAbiertos(), loadConteos()])
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
      description="Este módulo está disponible para montacarguistas, ayudantes y supervisión de almacenamiento."
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

      <!-- Bandeja del ayudante: escanea el PLU que trae en la mano y su tarjeta
           se resalta y toma el foco. -->
      <div v-if="ayudante" class="escaneo card bloque">
        <label class="f">
          <span class="lbl">Escanea el PLU que traes</span>
          <div class="scan-wrap">
            <ScanLine :size="15" class="scan-ic" />
            <input
              v-model="escaneo" class="field" placeholder="26403 o 7703596000036"
              inputmode="numeric" autocomplete="off" autocapitalize="characters"
              enterkeyhint="search" autofocus
              @keydown.enter.prevent="onEscanear"
            >
          </div>
        </label>
      </div>

      <!-- Captura: solo para quien inicia registros, y solo si puede abrir otro -->
      <MontacargasCaptura
        v-if="puedeAbrirOtro" ref="capturaRef" class="bloque"
        :flujo="flujoActivo" :saving="saving"
        @submit="abrir" @dirty="formDirty = $event"
      />

      <!-- Registros con el reloj corriendo. En resurtido pueden ser varios. -->
      <MontacargasRegistroAbierto
        v-for="m in abiertos" :key="m.id" class="bloque"
        :movimiento="m" :ahora="ahora" :es-ayudante="ayudante"
        :destacado="destacadoId === m.id" :guardando="guardando === m.id"
        @cantidades="guardarCantidades(m, $event)"
        @ubicar="ubicar(m, $event)"
        @traspasar="traspasando = m"
        @novedad="marcandoNovedad = m"
        @resolver="resolviendo = m"
        @descartar="descartar(m)"
      />

      <EmptyState
        v-if="ayudante && abiertos.length === 0 && !loading"
        title="Sin PLUs asignados"
        description="Cuando un montacarguista te pase un PLU, aparecerá aquí."
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

    <MontacargasTraspasarModal
      v-if="traspasando" :movimiento="traspasando"
      @close="traspasando = null" @traspasado="onTraspasado"
    />
    <MontacargasNovedadModal
      v-if="marcandoNovedad" :movimiento="marcandoNovedad"
      @close="marcandoNovedad = null" @creada="onNovedadCreada"
    />
    <MontacargasResolverNovedadModal
      v-if="resolviendo" :movimiento="resolviendo"
      @close="resolviendo = null" @resuelta="onNovedadResuelta"
    />
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

.escaneo { padding: 14px 16px; border-top: 3px solid var(--brand); }
.escaneo .f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.scan-wrap { position: relative; }
.scan-wrap .field { padding-left: 34px; width: 100%; height: 44px; font-size: 16px; }
.scan-ic { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--brand); pointer-events: none; }

.bloque { margin-bottom: 18px; }
.pagenav { margin-top: 16px; }

@media (max-width: 700px) {
  .hero-title { font-size: 24px; }
  .tab { flex: 1; padding: 11px 8px; }
}
</style>
