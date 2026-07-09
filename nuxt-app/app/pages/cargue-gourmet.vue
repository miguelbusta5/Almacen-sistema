<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Download, Plus, PackageCheck } from '@lucide/vue'
import { ESTADOS_NO_DESPACHABLES_MASIVO, type PedidoGourmet, type EscaneoEnCola } from '~/utils/gourmet'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'

definePageMeta({ title: 'Cargue Gourmet' })

const { me } = useSessionState()
const { show: showToast } = useToast()

const pedidos = ref<PedidoGourmet[]>([])
const canCreate = computed(() => !!me.value?.role && ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'].includes(me.value.role))

const q = ref('')
const fEstado = ref('')
const fCiudad = ref('')
const fTienda = ref('')
const fTipoOrden = ref('')
const fAlerta = ref(false)
const density = ref<'comodo' | 'compacto'>('comodo')
const loading = ref(true)
const refreshKey = ref(0)
const refreshing = ref(false)
const loadError = ref(false)

// Paginación real del lado del servidor — antes se traía todo con
// pageSize=500 y se filtraba/paginaba en el cliente. El backend ya
// soportaba filtros y paginación (ver index.get.ts); solo faltaba que el
// frontend los usara.
const page = ref(1)
const pageSize = ref(30)
const total = ref(0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

// Los KPIs del encabezado necesitan el total real (no solo lo que trae la
// página actual) — vienen de un endpoint de conteos aparte, igual que el
// resumen del dashboard de Inicio.
const kpiCounts = ref({ total: 0, sinUbicacion: 0, enCargue: 0, completados: 0, novedad: 0 })
async function loadConteos() {
  try {
    const res = await $fetch<{ data: typeof kpiCounts.value }>('/api/cargue-gourmet/conteos')
    kpiCounts.value = res.data
  } catch { /* deja los conteos previos si falla */ }
}

// Catálogo de ciudades/tiendas para los selects de filtro — antes se
// derivaban de las 500 filas cargadas, lo que con paginación real solo
// mostraría las ciudades/tiendas de la página actual.
const ciudadesCatalogo = ref<string[]>([])
const tiendasCatalogo = ref<string[]>([])
async function loadCatalogoTiendas() {
  try {
    const res = await $fetch<{ data: { tienda: string; ciudad: string }[] }>('/api/cargue-gourmet/maestro-tiendas', { query: { includeInactive: 1 } })
    ciudadesCatalogo.value = [...new Set(res.data.map((t) => t.ciudad).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    tiendasCatalogo.value = [...new Set(res.data.map((t) => t.tienda).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  } catch { /* selects quedan vacíos si falla, no bloquea la lista */ }
}

async function load() {
  try {
    const query: Record<string, string | number> = { page: page.value, pageSize: pageSize.value }
    if (q.value) query.q = q.value
    if (fEstado.value) query.estado = fEstado.value
    if (fCiudad.value) query.ciudad = fCiudad.value
    if (fTienda.value) query.tienda = fTienda.value
    if (fTipoOrden.value) query.tipoOrden = fTipoOrden.value
    if (fAlerta.value) query.alerta = '1'
    const res = await $fetch<{ data: PedidoGourmet[]; total: number }>('/api/cargue-gourmet', { query })
    pedidos.value = res.data
    total.value = res.total
    loadError.value = false
  } catch {
    loadError.value = true
  }
}

onMounted(async () => {
  ensureSession()
  await Promise.all([load(), loadConteos(), loadCatalogoTiendas()])
  loading.value = false
})

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  loading.value = true
  await Promise.all([load(), loadConteos()])
  await new Promise((r) => setTimeout(r, 350))
  loading.value = false; refreshing.value = false; refreshKey.value++
  showToast('Datos actualizados ✓')
}

const hasFilters = computed(() => !!(q.value || fEstado.value || fCiudad.value || fTienda.value || fTipoOrden.value || fAlerta.value))
function clearFilters() { q.value = ''; fEstado.value = ''; fCiudad.value = ''; fTienda.value = ''; fTipoOrden.value = ''; fAlerta.value = false }
function onKpiFilter(key: string) { fEstado.value = key }

// Cualquier cambio de filtro vuelve a la página 1 y recarga desde el
// servidor — el buscador (q) ya llega debounced desde GourmetToolbar.
watch([q, fEstado, fCiudad, fTienda, fTipoOrden, fAlerta], () => { page.value = 1; void load() })
watch(page, () => { void load() })

// ── Detalle ──────────────────────────────────────────────────────────────
const panelId = ref<string | null>(null)
const panelItem = ref<PedidoGourmet | null>(null)
const panelLoading = ref(false)
const ultimoResultado = ref<{ codigo: string; resultado: string } | null>(null)

// Contador de secuencia del panel abierto — cada apertura/cierre lo
// incrementa. Toda respuesta tardía (de un loadDetalle o de una mutación)
// que llegue después de que el usuario ya navegó a otro pedido (o volvió
// a la lista) queda con un `mySeq` desactualizado y se descarta en vez de
// escribirse sobre el pedido equivocado.
let panelSeq = 0

async function loadDetalle(id: string) {
  const mySeq = panelSeq
  panelLoading.value = true
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}`)
    if (panelSeq === mySeq) panelItem.value = res.data
  } catch { /* se mantiene el detalle previo si falla el refresh */ }
  finally { if (panelSeq === mySeq) panelLoading.value = false }
}
async function openDetail(p: PedidoGourmet) { panelSeq++; panelId.value = p.id; panelItem.value = null; ultimoResultado.value = null; colaEscaneos.value = []; await loadDetalle(p.id) }
function backToList() { panelSeq++; panelId.value = null; panelItem.value = null; colaEscaneos.value = [] }

// Parcha una fila del listado en memoria en vez de recargar las 500 filas
// del servidor — esto es lo que elimina el round-trip pesado en cada
// mutación (crear/editar/ubicación/cargue/eliminar solo tocan 1 fila).
function patchListado(id: string, patch: Partial<PedidoGourmet>) {
  const idx = pedidos.value.findIndex((p) => p.id === id)
  if (idx !== -1) pedidos.value[idx] = { ...pedidos.value[idx], ...patch, id } as PedidoGourmet
}
function agregarAListado(p: PedidoGourmet) { pedidos.value = [p, ...pedidos.value]; total.value++; void loadConteos() }
function quitarDeListado(id: string) { pedidos.value = pedidos.value.filter((p) => p.id !== id); total.value = Math.max(0, total.value - 1); void loadConteos() }

function apiErr(e: any, fallback: string) { return e?.data?.statusMessage || e?.statusMessage || fallback }

const busy = ref<string | null>(null)
async function run(key: string, fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = key
  try { await fn() } finally { busy.value = null }
}

// ── Crear / Editar ───────────────────────────────────────────────────────
const showCrear = ref(false)
const showEditar = ref(false)
const saving = ref(false)

function onCreated(p: PedidoGourmet) { agregarAListado(p) }
function onVerExistente(id: string) { openDetail({ id } as PedidoGourmet) }

async function guardarEdicion(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  const id = panelItem.value.id
  saving.value = true
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}`, { method: 'PUT', body: payload })
    showEditar.value = false
    patchListado(id, res.data)
    await loadDetalle(id)
    showToast('Pedido actualizado ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo guardar'), true) }
  finally { saving.value = false }
}

// ── Asignar ubicación ────────────────────────────────────────────────────
const showUbicacion = ref(false)
async function guardarUbicacion(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  const id = panelItem.value.id
  saving.value = true
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}/ubicacion`, { method: 'POST', body: payload })
    showUbicacion.value = false
    patchListado(id, res.data)
    await loadDetalle(id)
    showToast('Ubicación asignada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo guardar la ubicación'), true) }
  finally { saving.value = false }
}

// ── Ciclo de cargue ──────────────────────────────────────────────────────
// Nota de alcance (Fase 4): estas acciones patchean el LISTADO en memoria
// (evita el refetch de las 500 filas) pero siguen usando loadDetalle(id)
// — un solo GET liviano — para refrescar el panel. Reconstruir a mano los
// arreglos anidados (cargues/escaneos/novedades) desde las respuestas
// parciales de cada endpoint es frágil (fácil dejar el detalle
// inconsistente); un GET puntual por id es mucho más barato que el
// loadAll() de 500 filas que sí eliminamos, así que el balance
// riesgo/beneficio no lo justifica aquí.
function iniciarCargue() {
  return run('iniciarCargue', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/iniciar-cargue`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      patchListado(id, res.data.pedido)
      await loadDetalle(id)
      showToast('Cargue iniciado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo iniciar el cargue'), true); await loadDetalle(id) }
  })
}

// El escaneo es la acción de mayor frecuencia (varias por segundo durante
// un cargue). Antes cada escaneo bloqueaba con `busy` y cualquier caja
// capturada mientras la anterior viajaba al servidor se DESCARTABA en
// silencio (ritmo máximo = 1 caja por round-trip). Ahora cada captura
// entra a una cola local al instante y un worker único las envía en orden
// (serial hacia el servidor — el lock FOR UPDATE ya serializa en DB de
// todas formas): el operario escanea al ritmo de la cámara sin perder
// ninguna, y el veredicto de cada caja llega 1-2s después con sus
// colores/sonidos de siempre. Flujo acordado explícitamente con el usuario.
const colaEscaneos = ref<EscaneoEnCola[]>([])
let colaKey = 0
let colaWorkerActivo = false
const escaneandoCola = computed(() => colaEscaneos.value.some((s) => s.estado === 'pendiente' || s.estado === 'enviando'))

function escanear(codigo: string, tieneParte2: boolean) {
  if (!panelItem.value) return
  const codigoTrim = codigo.trim()
  if (!codigoTrim) return
  // Duplicado local instantáneo: el mismo código aún en vuelo se ignora
  // (complementa el cooldown de la cámara). Con "tiene varias partes"
  // (MUEBLES) el código repetido es deliberado, así que no se filtra.
  if (!tieneParte2 && colaEscaneos.value.some((s) => (s.estado === 'pendiente' || s.estado === 'enviando') && s.codigo.toUpperCase() === codigoTrim.toUpperCase())) return
  colaEscaneos.value.push({ key: ++colaKey, codigo: codigoTrim, tieneParte2, estado: 'pendiente' })
  void procesarColaEscaneos()
}

async function procesarColaEscaneos() {
  if (colaWorkerActivo) return
  colaWorkerActivo = true
  try {
    while (true) {
      const item = colaEscaneos.value.find((s) => s.estado === 'pendiente')
      if (!item || !panelItem.value) break
      const mySeq = panelSeq
      item.estado = 'enviando'
      try {
        const res = await $fetch<{
          resultado: string; novedadCreada: boolean; progreso: { escaneados: number; esperados: number }
          data: { escaneo: { id: string; codigoEscaneado: string; resultado: string; createdAt: string }; novedad?: { id: string; tipo: string; estado: string; descripcion: string } }
        }>(`/api/cargue-gourmet/${panelItem.value.id}/escanear`, { method: 'POST', body: { codigo: item.codigo, tieneParte2: item.tieneParte2 } })
        item.estado = 'ok'
        item.resultado = res.resultado
        // Si el usuario navegó a otro pedido mientras esta caja viajaba, el
        // escaneo YA quedó registrado en el servidor — solo se omite el
        // parche local (la cola se limpió al navegar) y se corta el worker.
        if (panelSeq !== mySeq) break
        ultimoResultado.value = { codigo: item.codigo, resultado: res.resultado }

        const p = panelItem.value
        const cargues = (p.cargues ?? []).map((c) => {
          if (c.estado !== 'EN_CARGUE') return c
          return {
            ...c,
            cantidadEscaneada: res.progreso.escaneados,
            escaneos: [
              { ...res.data.escaneo, escaneadoPorId: me.value?.id ?? '', escaneadoPorNombre: me.value?.name ?? null },
              ...c.escaneos,
            ],
          }
        })
        const novedades = res.data.novedad
          ? [{ id: res.data.novedad.id, tipo: res.data.novedad.tipo, estado: res.data.novedad.estado, descripcion: res.data.novedad.descripcion, registradaPorId: me.value?.id ?? '', registradaPorNombre: me.value?.name ?? null, resueltaPorId: null, resueltaPorNombre: null, resueltaAt: null, createdAt: res.data.escaneo.createdAt }, ...(p.novedades ?? [])]
          : (p.novedades ?? [])
        panelItem.value = { ...p, cargues, novedades }
      } catch (e) {
        // El item queda en la cola marcado con error y botón de reintento —
        // nunca se pierde en silencio.
        item.estado = 'error'
        item.error = apiErr(e, 'Error de red — reintenta')
        if (panelSeq !== mySeq) break
      }
    }
  } finally {
    colaWorkerActivo = false
  }
}

function reintentarEscaneo(key: number) {
  const item = colaEscaneos.value.find((s) => s.key === key)
  if (item?.estado === 'error') {
    item.estado = 'pendiente'
    item.error = undefined
    void procesarColaEscaneos()
  }
}

// Corrección de cajas (ADMIN/OPERACIONES_GOURMET) — eliminar una caja mal
// registrada y agregar la correcta a mano, sin pasar por el flujo de escaneo.
async function eliminarCaja(cajaId: string) {
  if (!panelItem.value || busy.value) return
  const id = panelItem.value.id
  const mySeq = panelSeq
  busy.value = `del-caja:${cajaId}`
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}/cajas/${cajaId}`, { method: 'DELETE' })
    if (panelSeq === mySeq) panelItem.value = res.data
    patchListado(id, res.data)
    showToast('Caja eliminada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo eliminar la caja'), true) }
  finally { busy.value = null }
}

async function agregarCajaManual(estibaId: string, codigo: string) {
  if (!panelItem.value || busy.value) return
  const id = panelItem.value.id
  const mySeq = panelSeq
  busy.value = 'add-caja'
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}/cajas`, { method: 'POST', body: { estibaId, codigoCaja: codigo } })
    if (panelSeq === mySeq) panelItem.value = res.data
    patchListado(id, res.data)
    showToast('Caja agregada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo agregar la caja'), true) }
  finally { busy.value = null }
}

async function resolverNovedad(novedadId: string) {
  if (!panelItem.value || busy.value) return
  const id = panelItem.value.id
  const mySeq = panelSeq
  busy.value = `resolver-novedad:${novedadId}`
  try {
    const res = await $fetch<{ data: PedidoGourmet }>(`/api/cargue-gourmet/${id}/novedades/${novedadId}/resolver`, { method: 'POST' })
    if (panelSeq === mySeq) panelItem.value = res.data
    patchListado(id, res.data)
    showToast('Novedad resuelta ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo resolver la novedad'), true) }
  finally { busy.value = null }
}

function finalizarCargue() {
  return run('finalizar', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/finalizar`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      patchListado(id, res.data.pedido)
      await loadDetalle(id)
      showToast('Cargue finalizado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo finalizar el cargue'), true); await loadDetalle(id) }
  })
}

const showConfirmRevertir = ref(false)
function revertirCargue() {
  return run('revertir', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/revertir-cargue`, { method: 'POST', body: { updatedAt: panelItem.value.updatedAt } })
      showConfirmRevertir.value = false
      patchListado(id, res.data.pedido)
      await loadDetalle(id)
      showToast('Cargue revertido ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo revertir'), true) }
  })
}

// ── Cierre manual ────────────────────────────────────────────────────────
const showCierreManual = ref(false)
async function guardarCierreManual(payload: Record<string, unknown>) {
  if (!panelItem.value) return
  const id = panelItem.value.id
  saving.value = true
  try {
    const res = await $fetch<{ data: { pedido: PedidoGourmet } }>(`/api/cargue-gourmet/${id}/cierre-manual`, { method: 'POST', body: payload })
    showCierreManual.value = false
    patchListado(id, res.data.pedido)
    await loadDetalle(id)
    showToast('Cargue cerrado manualmente ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo cerrar manualmente'), true) }
  finally { saving.value = false }
}

// ── Eliminar ─────────────────────────────────────────────────────────────
const showConfirmDel = ref(false)
function delPedido() {
  return run('del', async () => {
    if (!panelItem.value) return
    const id = panelItem.value.id
    try {
      await $fetch(`/api/cargue-gourmet/${id}`, { method: 'DELETE' })
      showConfirmDel.value = false
      quitarDeListado(id)
      backToList()
      showToast('Pedido eliminado')
    } catch (e) { showToast(apiErr(e, 'No se pudo eliminar'), true) }
  })
}

// ── Cargue masivo (solo ADMIN) ──────────────────────────────────────────
// Bypass deliberado del flujo normal de escaneo — cierra varios pedidos de
// una vez sin verificación física. El backend ya restringe esto a ADMIN
// (ver despacho-masivo.post.ts); aquí solo se ofrece la selección.
const showCargueMasivo = ref(false)
const masivoPedidos = ref<PedidoGourmet[]>([])
const masivoLoading = ref(false)
// Este modal necesita TODOS los pedidos despachables, no solo la página
// actual — se pide bajo demanda (solo al abrir el modal), en vez de
// mantener siempre cargada la lista completa en la pantalla principal.
async function abrirCargueMasivo() {
  masivoLoading.value = true
  try {
    const res = await $fetch<{ data: PedidoGourmet[] }>('/api/cargue-gourmet', {
      query: { pageSize: 200, estadoNot: ESTADOS_NO_DESPACHABLES_MASIVO.join(',') },
    })
    masivoPedidos.value = res.data
    showCargueMasivo.value = true
  } catch {
    showToast('No se pudo cargar la lista de pedidos', true)
  } finally {
    masivoLoading.value = false
  }
}
async function confirmarCargueMasivo(ids: string[]) {
  return run('cargue-masivo', async () => {
    try {
      const res = await $fetch<{ data: { actualizados: string[]; omitidos: { id: string; motivo: string }[] } }>(
        '/api/cargue-gourmet/despacho-masivo', { method: 'POST', body: { ids } },
      )
      showCargueMasivo.value = false
      await Promise.all([load(), loadConteos()])
      const { actualizados, omitidos } = res.data
      if (omitidos.length > 0) {
        showToast(`${actualizados.length} completado(s) · ${omitidos.length} omitido(s) — ${omitidos[0]!.motivo}`, actualizados.length === 0)
      } else {
        showToast(`${actualizados.length} pedido(s) completado(s) ✓`)
      }
    } catch (e) { showToast(apiErr(e, 'No se pudo completar el cargue masivo'), true) }
  })
}

async function exportarExcel() {
  const qs = new URLSearchParams()
  if (q.value) qs.set('q', q.value)
  if (fCiudad.value) qs.set('ciudad', fCiudad.value)
  if (fEstado.value) qs.set('estado', fEstado.value)
  if (fTipoOrden.value) qs.set('tipoOrden', fTipoOrden.value)
  const url = `/api/cargue-gourmet/export${qs.toString() ? `?${qs}` : ''}`
  const a = document.createElement('a')
  a.href = url
  a.download = `cargue-gourmet-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
}
</script>

<template>
  <div>
    <section class="hero fade-in">
      <div class="hero-left">
        <div class="hero-kicker">Gourmet · Transporte</div>
        <h1 class="hero-title">Cargue Gourmet</h1>
        <p class="hero-desc">{{ kpiCounts.total }} pedido{{ kpiCounts.total !== 1 ? 's' : '' }} · ubicación y cargue verificado</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refresh"><RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}</button>
        <button class="btn btn-sm" @click="exportarExcel"><Download :size="14" /> Exportar Excel</button>
        <button v-if="me?.role === 'ADMIN'" class="btn btn-sm" :disabled="masivoLoading" @click="abrirCargueMasivo"><PackageCheck :size="14" /> Cargue masivo</button>
        <button v-if="canCreate" class="btn btn-primary btn-sm" @click="showCrear = true"><Plus :size="14" /> Nuevo pedido</button>
      </div>
    </section>

    <Transition name="view" mode="out-in">
      <div v-if="!panelId" key="list">
        <CargueGourmetKpiRail :key="refreshKey" :counts="kpiCounts" style="margin-bottom: 18px" @filter="onKpiFilter" />
        <CargueGourmetToolbar
          v-model:q="q" v-model:estado="fEstado" v-model:ciudad="fCiudad" v-model:tienda="fTienda" v-model:tipo-orden="fTipoOrden" v-model:alerta="fAlerta" v-model:density="density"
          :ciudades="ciudadesCatalogo" :tiendas="tiendasCatalogo" :count="total" :total="kpiCounts.total" style="margin-bottom: 14px" @clear="clearFilters"
        />
        <ListSkeleton v-if="loading" />
        <CargueGourmetPedidosList v-else :items="pedidos" :has-filters="hasFilters" :density="density" @open="openDetail" @clear="clearFilters" @new="showCrear = true" />
        <PageNav v-if="!loading && pages > 1" v-model:page="page" :pages="pages" style="margin-top: 14px" />
      </div>

      <div v-else-if="panelItem" key="detail">
        <CargueGourmetPedidoDetail
          :p="panelItem" :role="me?.role ?? ''" :busy="busy" :escaneando="escaneandoCola" :ultimo-resultado="ultimoResultado" :cola="colaEscaneos"
          @back="backToList" @edit="showEditar = true" @del="showConfirmDel = true" @asignar-ubicacion="showUbicacion = true"
          @iniciar-cargue="iniciarCargue" @finalizar="finalizarCargue" @revertir="showConfirmRevertir = true"
          @cierre-manual="showCierreManual = true" @escanear="escanear" @reintentar-escaneo="reintentarEscaneo"
          @eliminar-caja="eliminarCaja" @agregar-caja-manual="agregarCajaManual" @resolver-novedad="resolverNovedad"
        />
      </div>
      <div v-else-if="panelLoading" key="detail-loading">
        <ListSkeleton />
      </div>
    </Transition>

    <CargueGourmetCrearPedidoModal v-if="showCrear" @close="showCrear = false" @created="onCreated" @ver-existente="onVerExistente" />
    <CargueGourmetEditarPedidoModal v-if="showEditar && panelItem" :p="panelItem" :saving="saving" @close="showEditar = false" @saved="guardarEdicion" />
    <CargueGourmetAsignarUbicacionModal v-if="showUbicacion && panelItem" :p="panelItem" :saving="saving" @close="showUbicacion = false" @saved="guardarUbicacion" />
    <CargueGourmetCierreManualModal v-if="showCierreManual && panelItem" :p="panelItem" :saving="saving" @close="showCierreManual = false" @saved="guardarCierreManual" />
    <CargueGourmetCargueMasivoModal
      v-if="showCargueMasivo" :items="masivoPedidos" :saving="busy === 'cargue-masivo'"
      @close="showCargueMasivo = false" @confirm="confirmarCargueMasivo"
    />

    <ConfirmModal
      v-if="showConfirmDel && panelItem" title="Eliminar pedido"
      :message="`¿Eliminar el pedido ${panelItem.tipoOrden} ${panelItem.orden}? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar" confirming-label="Eliminando…" :confirming="busy === 'del'"
      @close="showConfirmDel = false" @confirm="delPedido"
    />
    <ConfirmModal
      v-if="showConfirmRevertir && panelItem" title="Revertir cargue"
      :message="`¿Revertir el cargue de ${panelItem.tipoOrden} ${panelItem.orden}? Se perderán los escaneos registrados en este cargue.`"
      confirm-label="Revertir" confirming-label="Revirtiendo…" :confirming="busy === 'revertir'"
      @close="showConfirmRevertir = false" @confirm="revertirCargue"
    />
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
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.view-enter-active, .view-leave-active { transition: opacity .28s cubic-bezier(.16,1,.3,1), transform .28s cubic-bezier(.16,1,.3,1); }
.view-enter-from { opacity: 0; transform: translateY(10px); }
.view-leave-to { opacity: 0; transform: translateY(-6px); }
.fade-enter-active, .fade-leave-active { transition: opacity .22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
