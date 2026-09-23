<script setup lang="ts">
import { usePausaOperativa } from '~/composables/usePausaOperativa'
const { revision: pausaRevision } = usePausaOperativa()
watch(pausaRevision, () => { void Promise.all([loadLista(), loadAbierta(), loadConteos()]) })
// Recepción de Contenedores: la planilla de descarga del CEDI.
//
// Ciclo: se registra el pedido y ARRANCA EL RELOJ → el operario baja el
// contenedor → vuelve a la planilla con las estibas usadas y las referencias
// nuevas, y eso lo CIERRA. Los reportes de novedad (faltantes, sobrantes,
// averías, maltratada) se levantan después y no cuentan tiempo.
//
// Una planilla abierta por persona: el operario está en un contenedor, no en
// dos. Por eso, con una abierta, se esconde el formulario de captura.
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { RefreshCw, Container } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_RECEPCION, puedeGestionarRecepcion, puedeUsarRecepcion,
  type Recepcion, type RecepcionConteos, type TipoNovedadRecepcion,
} from '~/utils/recepcion'

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

const role = computed(() => me.value?.role ?? '')
const userId = computed(() => me.value?.id)
const puedeVer = computed(() => puedeUsarRecepcion(role.value))
const canManage = computed(() => puedeGestionarRecepcion(role.value))
// Los indicadores de tiempo ya no viven aqui: tienen modulo propio
// (/dashboard/indicadores), junto con el resto de tomas de tiempo del CEDI.

// ── Reloj compartido ───────────────────────────────────────────────
// Un solo intervalo para todo el módulo: un cronómetro por tarjeta multiplicaría
// los timers sin ganar nada.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  ensureSession()
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

// ── Datos ──────────────────────────────────────────────────────────
const items = ref<Recepcion[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 25
const loading = ref(true)
const refreshing = ref(false)
const saving = ref(false)
const guardando = ref<string | null>(null)

const q = ref('')
const fecha = ref('')
const estado = ref('')

const abierta = ref<Recepcion | null>(null)
const descargadores = ref<{ id: string; nombre: string; rol: string }[]>([])
const conteos = ref<RecepcionConteos>({
  recepcionesHoy: 0, enCurso: 0, unidadesHoy: 0, cajasHoy: 0, estibasHoy: 0,
  conNovedad: 0, promedioSeg: null,
})

const capturaRef = ref<{ reset: () => void } | null>(null)
const formDirty = ref(false)
const novedadesDe = ref<Recepcion | null>(null)
const editando = ref<Recepcion | null>(null)

async function loadLista() {
  loading.value = true
  try {
    const res = await $fetch<{ data: Recepcion[]; total: number }>(API_RECEPCION, {
      query: { page: page.value, pageSize, q: q.value, fecha: fecha.value, estado: estado.value },
    })
    items.value = res.data
    total.value = res.total
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar el listado'), true)
  } finally {
    loading.value = false
  }
}

async function loadAbierta() {
  try {
    const res = await $fetch<{ data: Recepcion | null }>(`${API_RECEPCION}/abierta`)
    abierta.value = res.data
  } catch { /* no bloquea la vista */ }
}

async function loadConteos() {
  try {
    const res = await $fetch<{ data: RecepcionConteos }>(`${API_RECEPCION}/conteos`)
    conteos.value = res.data
  } catch { /* los KPIs no bloquean */ }
}

async function loadDescargadores() {
  try {
    const res = await $fetch<{ data: { id: string; nombre: string; rol: string }[] }>(
      `${API_RECEPCION}/descargadores`,
    )
    descargadores.value = res.data
  } catch { /* la lista vacía ya avisa */ }
}

watch([q, fecha, estado], () => { page.value = 1; void loadLista() })
watch(page, () => { void loadLista() })
watch(() => me.value?.id, (id) => {
  if (!id || !puedeVer.value) return
  void Promise.all([loadLista(), loadAbierta(), loadConteos(), loadDescargadores()])
}, { immediate: true })

// La guarda va dentro de onRefresh: useAutoRefresh captura los booleanos al
// montar y la sesión llega después.
useAutoRefresh({
  onRefresh: () => {
    if (!puedeVer.value) return
    // Nunca refrescar con trabajo a medias: se le robaría al operario lo que
    // está escribiendo en la planilla.
    if (formDirty.value || saving.value || guardando.value || novedadesDe.value || editando.value) return
    return Promise.all([loadLista(), loadAbierta(), loadConteos()])
  },
})

async function refreshAll() {
  refreshing.value = true
  await Promise.all([loadLista(), loadAbierta(), loadConteos()])
  refreshing.value = false
}

// ── Acciones ───────────────────────────────────────────────────────
async function accion<T>(id: string | null, fn: () => Promise<T>, msg: string): Promise<T | null> {
  guardando.value = id ?? '_'
  try {
    return await fn()
  } catch (e) {
    showToast(apiErr(e, msg), true)
    return null
  } finally {
    guardando.value = null
  }
}

async function abrir(payload: Record<string, unknown>) {
  saving.value = true
  try {
    const res = await $fetch<{ data: Recepcion }>(API_RECEPCION, { method: 'POST', body: payload })
    abierta.value = res.data
    capturaRef.value?.reset()
    formDirty.value = false
    showToast(`Contenedor ${res.data.numeroPedido} iniciado`)
    await Promise.all([loadLista(), loadConteos()])
  } catch (e) {
    // El 409 trae la planilla que ya estaba abierta: en vez de un error seco,
    // se lleva al operario a la que tiene entre manos.
    const data = (e as { data?: { data?: { recepcion?: Recepcion } } })?.data?.data
    if (data?.recepcion) {
      abierta.value = data.recepcion
      showToast(apiErr(e, 'Ya tienes un contenedor abierto'), true)
    } else {
      showToast(apiErr(e, 'No se pudo iniciar la recepción'), true)
    }
  } finally {
    saving.value = false
  }
}

async function cerrar(payload: Record<string, number>) {
  const r = abierta.value
  if (!r) return
  const res = await accion(r.id, () =>
    $fetch<{ data: Recepcion }>(`${API_RECEPCION}/${r.id}/cerrar`, { method: 'POST', body: payload }),
    'No se pudo cerrar la recepción')
  if (!res) return

  abierta.value = null
  formDirty.value = false
  sonarVeredicto('VALIDO')
  showToast('Recepción finalizada. Ya puedes añadir los reportes.')
  await Promise.all([loadLista(), loadConteos()])
  // Se abre el panel de reportes en caliente: es el momento en que el operario
  // tiene delante los faltantes y las cajas rotas.
  await nextTick()
  novedadesDe.value = res.data
}

async function agregarNovedad(payload: {
  tipo: TipoNovedadRecepcion; plu: string; cantidad: number
  fotoUrl: string | null; observacion: string | null
}) {
  const r = novedadesDe.value
  if (!r) return
  const res = await accion(r.id, () =>
    $fetch<{ data: Recepcion }>(`${API_RECEPCION}/${r.id}/novedad`, { method: 'POST', body: payload }),
    'No se pudo añadir el reporte')
  if (!res) return
  novedadesDe.value = res.data
  await Promise.all([loadLista(), loadConteos()])
}

async function quitarNovedad(novedadId: string) {
  const r = novedadesDe.value
  if (!r) return
  const res = await accion(r.id, () =>
    $fetch<{ data: Recepcion }>(`${API_RECEPCION}/${r.id}/novedad/${novedadId}`, { method: 'DELETE' }),
    'No se pudo quitar la línea')
  if (!res) return
  novedadesDe.value = res.data
  await Promise.all([loadLista(), loadConteos()])
}

async function borrar(item: Recepcion) {
  if (!confirm(`¿Borrar la recepción del contenedor ${item.numeroPedido}?`)) return
  const ok = await accion(item.id, () =>
    $fetch<{ success: boolean }>(`${API_RECEPCION}/${item.id}`, { method: 'DELETE' }), 'No se pudo borrar')
  if (ok) {
    showToast('Recepción borrada')
    await Promise.all([loadLista(), loadAbierta(), loadConteos()])
  }
}

async function corregido(r: Recepcion) {
  editando.value = null
  showToast(`Recepción ${r.numeroPedido} corregida`)
  await Promise.all([loadLista(), loadConteos()])
}

function filtrarPor(key: string) {
  estado.value = key
}

// Bajo 1100px la tabla de 18 columnas no cabe ni con scroll cómodo.
const ancho = ref(1400)
function medir() { ancho.value = window.innerWidth }
onMounted(() => { medir(); window.addEventListener('resize', medir) })
onBeforeUnmount(() => window.removeEventListener('resize', medir))
const esCompacto = computed(() => ancho.value < 1100)

const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
</script>

<template>
  <div class="mod">
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><Container :size="13" /></span>
          CEDI · Descarga
        </span>
        <h1 class="hero-title">Recepción de Contenedores</h1>
        <p class="hero-desc">
          {{ loading ? 'Cargando…' : `${total} recepci${total !== 1 ? 'ones' : 'ón'} · planilla con tiempos y novedades` }}
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refreshAll">
          <RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}
        </button>
      </div>
    </section>

    <!-- El skeleton va ANTES del gate: mientras /api/me no responde, `role` es
         '' y la página parpadearía "Sin acceso" a usuarios autorizados. -->
    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="Este módulo está disponible para operarios y supervisión de almacenamiento."
    />

    <template v-else>
        <RecepcionKpiRail class="bloque" :counts="conteos" @filter="filtrarPor" />
        <!-- Supervisión: tiempo de cada contenedor y cuántos caben por día. -->
        <RecepcionProyeccion v-if="canManage" class="bloque" />

        <!-- Con una planilla abierta se esconde la captura: el operario está en
             un contenedor, no en dos. -->
        <RecepcionPlanillaAbierta
          v-if="abierta"
          class="bloque" :recepcion="abierta" :ahora="ahora"
          :guardando="guardando === abierta.id"
          @cerrar="cerrar" @dirty="formDirty = $event"
        />
        <RecepcionCaptura
          v-else
          ref="capturaRef" class="bloque"
          :descargadores="descargadores" :saving="saving"
          @submit="abrir" @dirty="formDirty = $event"
        />

        <div class="filtros card bloque">
          <input v-model="q" class="field" type="search" placeholder="Buscar pedido o proveedor…">
          <input v-model="fecha" class="field" type="date">
          <select v-model="estado" class="field">
            <option value="">Todos los estados</option>
            <option value="en-curso">En curso</option>
            <option value="cerrado">Cerradas</option>
            <option value="novedad">Con novedad</option>
          </select>
        </div>

        <ListSkeleton v-if="loading" />
        <RecepcionTabla
          v-else
          :items="items" :can-manage="canManage" :user-id="userId" :es-compacto="esCompacto"
          @novedades="novedadesDe = $event" @borrar="borrar" @editar="editando = $event"
        />

        <div v-if="totalPaginas > 1" class="pag">
          <button class="btn btn-sm" :disabled="page <= 1" @click="page -= 1">Anterior</button>
          <span class="pag-txt">Página {{ page }} de {{ totalPaginas }}</span>
          <button class="btn btn-sm" :disabled="page >= totalPaginas" @click="page += 1">Siguiente</button>
        </div>
    </template>

    <RecepcionEditarModal
      v-if="editando" :item="editando"
      @close="editando = null" @saved="corregido"
    />

    <RecepcionNovedadModal
      v-if="novedadesDe"
      :recepcion="novedadesDe" :guardando="guardando === novedadesDe.id"
      @cerrar="novedadesDe = null" @agregar="agregarNovedad" @quitar="quitarNovedad"
    />
  </div>
</template>

<style scoped>
.mod { position: relative; }
.hero { position: relative; z-index: 5; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }
.hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: gira 1s linear infinite; }
@keyframes gira { to { transform: rotate(360deg) } }

.bloque { margin-bottom: 18px; }
.filtros { display: flex; gap: 10px; padding: 12px 14px; flex-wrap: wrap; }
.filtros .field { flex: 1 1 190px; }

.pag { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
.pag-txt { font-size: 12.5px; color: var(--muted); }

@media (max-width: 720px) {
  .hero-title { font-size: 24px; }
}
</style>
