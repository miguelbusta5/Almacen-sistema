<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
import { usePausaOperativa } from '~/composables/usePausaOperativa'
const { revision: pausaRevision } = usePausaOperativa()
watch(pausaRevision, () => { void Promise.all([loadLista(), loadAbiertos(), loadConteos()]) })
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
import { RefreshCw, Download, Forklift, ScanLine, ExternalLink } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_MONTACARGAS, esAyudante as esRolAyudante, FLUJOS, recibioTraspaso,
  normalizarCodigoProducto, puedeCrearMovimiento, puedeGestionarMontacargas,
  puedeUsarMontacargas, TIPO_MOVIMIENTO_LABEL,
  type FlujoConfig, type Movimiento, type MovimientoConteos, type Operario,
  type TipoMovimiento,
} from '~/utils/montacargas'

const props = defineProps<{
  titulo: string
  kicker: string
  /** Uno o más flujos. Con más de uno se dibuja la barra de pestañas. */
  flujos: FlujoConfig[]
  /** Embebido dentro de otra pantalla que ya tiene su cabecera: dos cabeceras
   *  seguidas se leen como dos módulos distintos. */
  sinHero?: boolean
}>()

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

const role = computed(() => me.value?.role ?? '')
const userId = computed(() => me.value?.id)
const puedeVer = computed(() => puedeUsarMontacargas(role.value))
const canManage = computed(() => puedeGestionarMontacargas(role.value))
const puedeCrear = computed(() => puedeCrearMovimiento(role.value))
const ayudante = computed(() => esRolAyudante(role.value))
// Permiso por persona (users.puede_resolver_novedades), no por rol: lo expone
// /api/me leyendolo de la base para que conceder o quitarlo tenga efecto sin
// tener que volver a iniciar sesion.
const puedeResolverNovedades = computed(() => me.value?.can?.resolverNovedades === true)

// ── Pestaña activa ─────────────────────────────────────────────────
// Los indicadores ya no viven aqui: tienen modulo propio (/dashboard/indicadores),
// que junta el tiempo de todos los modulos del CEDI sin contar dos veces el
// mismo minuto.
const flujoActivo = ref<FlujoConfig>(props.flujos[0]!)
const tipo = computed(() => flujoActivo.value.tipo)

// ── Pendientes por tipo (a dónde llevar al operario) ───────────────
// Un ayudante que recibía un movimiento de depósito abría el módulo en la
// pestaña de Recepción y no veía nada, porque el traspaso no le decía dónde
// mirar. Con esto se selecciona la pestaña que tiene trabajo y se avisa cuando
// lo pendiente está en el otro módulo (Resurtido vive aparte).
const pendientes = ref<Record<TipoMovimiento, number>>({ RECEPCION: 0, MOVIMIENTO: 0, RESURTIDO: 0 })
async function loadPendientes() {
  try {
    const res = await $fetch<{ data: Record<TipoMovimiento, number> }>(`${API_MONTACARGAS}/mis-pendientes`)
    pendientes.value = res.data
  } catch { /* la bandeja sigue funcionando sin esto */ }
}

// Flujos de OTROS módulos con trabajo pendiente: el enlace que falta para no
// dejar PLUs olvidados en la otra pantalla.
const pendientesFuera = computed(() =>
  (Object.keys(pendientes.value) as TipoMovimiento[])
    .filter((t) => pendientes.value[t] > 0 && !props.flujos.some((f) => f.tipo === t))
    .map((t) => ({ tipo: t, n: pendientes.value[t], flujo: FLUJOS[t] })),
)

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

// Cada carga lleva un numero y solo pinta la ULTIMA. Sin esto se mezclaban las
// pestañas: al entrar se pide Recepcion (con la funcion fria) y, si el operario
// cambiaba enseguida a Movimientos, la respuesta de Recepcion llegaba despues y
// dejaba sus registros bajo la pestaña Movimientos.
let seqLista = 0
let seqAbiertos = 0
let seqConteos = 0

async function loadLista() {
  const seq = ++seqLista
  try {
    const query: Record<string, string | number> = { tipo: tipo.value, page: page.value, pageSize: PAGE_SIZE }
    if (fQ.value) query.q = fQ.value
    if (fFecha.value) query.fecha = fFecha.value
    if (fEstado.value) query.estado = fEstado.value
    if (fUsuario.value) query.usuarioId = fUsuario.value
    const res = await $fetch<{ data: Movimiento[]; total: number }>(API_MONTACARGAS, { query })
    if (seq !== seqLista) return
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
// Ojo: la bandeja tambien trae las novedades de otros cuando el actor puede
// verificarlas — si no, quien tiene el permiso las veia en el listado pero nunca
// el boton. Esas no son trabajo suyo, asi que todo lo operativo (abrir otro
// registro, escanear, el vacio del ayudante) mira `mios`, no `abiertos`.
const abiertos = ref<Movimiento[]>([])
const mios = computed(() => abiertos.value.filter((m) => m.responsableId === userId.value))
// Los que le pasaron a esta persona. Un montacarguista tambien recibe, y cuando
// lo hace necesita lo mismo que un ayudante: escanear el PLU que trae en la
// mano para no confundirse entre varios.
const recibidos = computed(() => mios.value.filter((m) => recibioTraspaso(m, userId.value)))
async function loadAbiertos() {
  const seq = ++seqAbiertos
  try {
    const res = await $fetch<{ data: Movimiento[] }>(`${API_MONTACARGAS}/abiertos`, {
      query: { tipo: tipo.value },
    })
    if (seq !== seqAbiertos) return
    abiertos.value = res.data
  } catch { /* no bloquea la vista */ }
}

// Se pueden tener varios PLUs en curso en cualquier flujo: el formulario de
// captura sigue a la vista aunque ya haya registros abiertos.
const puedeAbrirOtro = computed(() => puedeCrear.value)

// ── KPIs ───────────────────────────────────────────────────
const conteos = ref<MovimientoConteos>({
  registrosHoy: 0, cajasHoy: 0, unidadesHoy: 0, sueltasHoy: 0, enCurso: 0, conNovedad: 0, promedioSeg: null,
})
async function loadConteos() {
  const seq = ++seqConteos
  try {
    const res = await $fetch<{ data: MovimientoConteos }>(`${API_MONTACARGAS}/conteos`, {
      query: { tipo: tipo.value },
    })
    if (seq !== seqConteos) return
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
  await loadPendientes()
  // Se abre directamente donde hay trabajo. Solo para quien recibe traspasos:
  // al montacarguista se le respeta la primera pestaña, que es donde captura.
  if (ayudante.value) {
    const conTrabajo = props.flujos.find((f) => pendientes.value[f.tipo] > 0)
    if (conTrabajo) flujoActivo.value = conTrabajo
  }
  await Promise.all([cargarTodo(), loadOperarios()])
})

// Cambiar de pestaña es cambiar de flujo entero: se reinician filtros y página
// para no arrastrar un filtro que no aplica al otro tipo.
watch(flujoActivo, () => {
  // Lo de la pestaña anterior se quita ya: mientras llega lo nuevo quedaba a la
  // vista bajo el nombre de la otra.
  items.value = []
  total.value = 0
  abiertos.value = []
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
    if (mios.value.length > 0) return
    return Promise.all([loadLista(), loadAbiertos(), loadConteos()])
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

async function abrir(payload: { codigo: string; ubicacionInicial?: string; numeroPedido?: string }) {
  saving.value = true
  try {
    await $fetch<{ success: boolean }>(API_MONTACARGAS, { method: 'POST', body: { ...payload, tipo: tipo.value } })
    capturaRef.value?.reset()
    await Promise.all([loadAbiertos(), loadLista(), loadConteos(), loadPendientes()])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo abrir el registro'), true)
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
    $fetch<{ success: boolean }>(`${API_MONTACARGAS}/${m.id}/cantidades`, { method: 'PATCH', body: payload }),
    'No se pudieron guardar las cantidades')
  if (ok) await loadAbiertos()
}

async function ubicar(
  m: Movimiento,
  payload: { ubicacionFinal: string; unidadesAlmacenadas: number; devolverAId?: string },
) {
  const res = await accion(m.id, () =>
    $fetch<{
      data: Movimiento
      sobrante: { id: string; unidades: number; responsableNombre: string | null } | null
      devueltoCompleto?: boolean
    }>(
      `${API_MONTACARGAS}/${m.id}/ubicacion`, { method: 'POST', body: payload },
    ), 'No se pudo cerrar el registro')
  if (!res) return

  // No cupo ninguna: no se cerro nada, el PLU entero volvio de manos.
  if (res.devueltoCompleto) {
    showToast(`Devolviste las ${res.sobrante?.unidades ?? ''} unidades a ${res.sobrante?.responsableNombre ?? 'quien te lo pasó'}`)
    await Promise.all([loadAbiertos(), loadLista(), loadConteos(), loadPendientes()])
    return
  }

  // Si no cupo todo, el resto vuelve a quien le paso el PLU: se avisa aparte
  // del overlay de exito, que solo habla del registro que se cerro.
  if (res.sobrante) {
    showToast(
      `Se cerro con ${res.data.cantidadTotal} unidades. `
      + `${res.sobrante.unidades} volvieron a ${res.sobrante.responsableNombre ?? 'quien te lo paso'}`,
    )
  }

  // Confirmación de proceso exitoso: overlay + sonido/vibración, para que el
  // operario lo perciba sin mirar la pantalla y encadene el siguiente.
  exito.value = res.data
  sonarVeredicto('VALIDO')
  if (exitoTimer) clearTimeout(exitoTimer)
  exitoTimer = setTimeout(() => { exito.value = null }, 1800)

  await Promise.all([loadAbiertos(), loadLista(), loadConteos(), loadPendientes()])
  await nextTick()
  capturaRef.value?.reset()
}

async function descartar(m: Movimiento) {
  const ok = await accion(m.id, () =>
    $fetch<{ success: boolean }>(`${API_MONTACARGAS}/${m.id}/descartar`, { method: 'POST', body: {} }),
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
  await Promise.all([loadAbiertos(), loadLista(), loadConteos(), loadPendientes()])
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
  const encontrado = mios.value.find((m) => m.plu === codigo || m.ean === codigo)
  if (!encontrado) {
    // Decir QUE tiene, no solo que eso no es: si no, el operario se queda sin
    // saber si el PLU es otro o si no le han pasado nada.
    const tiene = mios.value.map((m) => m.plu).join(', ')
    showToast(
      tiene
        ? `El ${codigo} no es tuyo. Tienes: ${tiene}`
        : 'No tienes ningún PLU asignado. Pídele al montacarguista que te lo pase.',
      true,
    )
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
    await $fetch<{ success: boolean }>(`${API_MONTACARGAS}/${borrando.value.id}`, {
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
    <section v-if="!sinHero" class="hero fade-in">
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
      <!-- Una pestaña por flujo. Con uno solo (Movimientos dentro de Resurtido)
           no hay nada que elegir y la barra sobra. -->
      <nav v-if="flujos.length > 1" class="tabs" role="tablist">
        <button
          v-for="f in flujos" :key="f.tipo" class="tab" role="tab"
          :class="{ on: f.tipo === flujoActivo.tipo }"
          :aria-selected="f.tipo === flujoActivo.tipo"
          @click="flujoActivo = f"
        >
          {{ f.tab }}
          <!-- Cuántos PLUs tiene el operario en la mano en esa pestaña: sin esto
               hay que entrar a cada una para descubrir dónde está el trabajo. -->
          <span v-if="pendientes[f.tipo] > 0" class="badge-tab">{{ pendientes[f.tipo] }}</span>
        </button>
      </nav>

      <!-- Trabajo pendiente en el OTRO módulo: Resurtido vive aparte y sin este
           aviso los PLUs se quedan olvidados ahí. -->
      <NuxtLink
        v-for="p in pendientesFuera" :key="p.tipo"
        class="aviso-fuera bloque" :to="`/dashboard/${p.flujo.moduleKey}`"
      >
        <ExternalLink :size="14" />
        Tienes <b>{{ p.n }}</b> PLU{{ p.n !== 1 ? 's' : '' }} pendiente{{ p.n !== 1 ? 's' : '' }}
        en {{ TIPO_MOVIMIENTO_LABEL[p.tipo] }}
      </NuxtLink>

      <!-- Bandeja de quien recibe: escanea el PLU que trae en la mano y su
           tarjeta se resalta y toma el foco.
           Solo cuando hay ALGO que escanear: con la bandeja vacia, la caja
           invitaba a escanear y respondia "ese PLU no esta en tu bandeja" a
           todo, que es exactamente lo que estaba pasando en el CEDI. -->
      <div v-if="mios.length > 0" class="escaneo card bloque">
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
        :movimiento="m" :ahora="ahora" :recibido="recibioTraspaso(m, userId)"
        :destacado="destacadoId === m.id" :guardando="guardando === m.id"
        :puede-resolver-novedades="puedeResolverNovedades"
        :ajeno="m.responsableId !== userId"
        @cantidades="guardarCantidades(m, $event)"
        @ubicar="ubicar(m, $event)"
        @traspasar="traspasando = m"
        @novedad="marcandoNovedad = m"
        @resolver="resolviendo = m"
        @descartar="descartar(m)"
      />

      <EmptyState
        v-if="ayudante && mios.length === 0 && !loading"
        title="Sin PLUs asignados"
        description="Cuando un montacarguista te pase un PLU, aparecerá aquí para que lo escanees."
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
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 15px; font-size: 13px; font-weight: 600; color: var(--muted);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color .15s, border-color .15s;
}
.tab:hover { color: var(--ink-2); }
.tab.on { color: var(--brand); border-bottom-color: var(--brand); }
.badge-tab { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--brand); color: var(--on-brand); font-size: 11px; font-weight: 800; }

.aviso-fuera {
  display: flex; align-items: center; gap: 8px; text-decoration: none;
  padding: 10px 13px; border-radius: var(--r-sm); font-size: 12.5px;
  background: color-mix(in srgb, var(--info) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 32%, transparent);
  color: var(--ink-2);
}
.aviso-fuera:hover { background: color-mix(in srgb, var(--info) 15%, transparent); }
.aviso-fuera b { color: var(--ink); }
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
  .tab { flex: 1; padding: 11px 6px; font-size: 12.5px; }
}
</style>
