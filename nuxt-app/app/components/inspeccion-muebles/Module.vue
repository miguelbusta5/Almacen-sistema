<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
// Inspección Muebles — login compartido del área.
//
// Dos vistas: la parrilla de viñetas y el detalle de una orden. Entrar y salir
// de una orden es solo cambiar de vista: no se toca ningún reloj ni se suelta
// ninguna asignación, así que un inspector puede dejarle la PC a otro y volver
// a encontrar su orden en el punto exacto en que la dejó.
//
// El inspector activo se recuerda en sessionStorage de esa PC: es una comodidad
// para no reelegir el nombre en cada acción, no una sesión. La verdad de quién
// hizo qué está en la DB, en el inspector que se guardó con cada tiempo.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ClipboardCheck, FilePlus2, RefreshCw, Loader2, Receipt, Store } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { useSessionState } from '~/composables/useSession'
import {
  API_INSPECCION, cajasDelPlu, mensajeError, MINIMO_PARTES_AVISO,
  type CajaPlu, type Inspector, type Linea, type Orden,
} from '~/utils/muebles'

const { show } = useToast()
const { me } = useSessionState()
// Errores de picking: solo el administrador (el servidor lo vuelve a exigir).
const esAdmin = computed(() => me.value?.role === 'ADMIN')
const lineaError = ref<Linea | null>(null)

const ordenes = ref<Orden[]>([])
const inspectores = ref<Inspector[]>([])
// Para pedir la reposicion de un PLU averiado hay que elegir a quien la trae.
const operarios = ref<Array<{ id: string; nombre: string }>>([])
const abierta = ref<Orden | null>(null)
const cargando = ref(true)
const guardando = ref(false)

const inspectorActivo = ref<string | null>(null)
const CLAVE = 'inspector-muebles'

// Modales
const pidiendoInspector = ref(false)
const lineaEbanisteria = ref<Linea | null>(null)
const pidiendoFaltante = ref(false)
const lineaAveriada = ref<Linea | null>(null)
const agregandoPlu = ref(false)
const creandoContado = ref(false)
const creandoTienda = ref(false)
const creandoSinCrear = ref(false)
// Crear una orden (tienda, sin crear o contado) pregunta ANTES quién la crea,
// en su propia ventana y sin nombre preseleccionado (24-09): con el nombre
// recordado de la PC se creaban a nombre de otro inspector.
type TipoCreacion = 'tienda' | 'sinCrear' | 'contado'
const pidiendoCreador = ref<TipoCreacion | null>(null)
const creadorId = ref<string | null>(null)
const nombreCreador = computed(() => inspectores.value.find((i) => i.id === creadorId.value)?.nombre ?? null)
const TITULO_CREACION: Record<TipoCreacion, string> = {
  tienda: '¿Quién crea la orden de tienda?',
  sinCrear: '¿Quién crea la orden sin crear?',
  contado: '¿Quién crea la factura de contado?',
}
// Orden que ya tiene inspector: se avisa antes de entrar (24-09).
const ordenOcupada = ref<Orden | null>(null)
const nombresOcupada = computed(() => {
  const o = ordenOcupada.value
  if (!o) return ''
  const nombres = [...new Set([o.inspector?.nombre, ...o.inspectores.map((i) => i.nombre)].filter(Boolean))]
  return nombres.join(', ')
})
const pidiendoCiudad = ref(false)
// Al entrar a una orden se pregunta quien la toma, SIN nombre preseleccionado:
// con el nombre recordado de la PC los inspectores trabajaban a nombre de otro.
const pidiendoQuien = ref(false)
// ── PLU partido ──
// Al iniciarlo se avisa que viene en varias cajas, y al darlo por listo se
// pregunta si estaban todas. Un PLU sin medir no avisa nada.
const cajasPlu = ref<CajaPlu[]>([])
const lineaAvisada = ref<Linea | null>(null)
const lineaCajas = ref<Linea | null>(null)
// Ciudades ya usadas: se sugieren para no escribir la misma de dos formas.
const ciudadesUsadas = computed(() => [...new Set(
  ordenes.value.map((o) => o.ciudadEnvio).filter((c): c is string => !!c),
)].sort())
// Qué hacer una vez el inspector elige su nombre (tomar la orden, o la acción
// que intentó sin haberse identificado todavía).
const trasElegir = ref<((id: string) => void) | null>(null)

const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
  try { inspectorActivo.value = sessionStorage.getItem(CLAVE) } catch { /* PC sin storage */ }
  cargar()
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const nombreActivo = computed(
  () => inspectores.value.find((i) => i.id === inspectorActivo.value)?.nombre ?? null,
)

async function cargar() {
  // Un refresco automatico no pone el esqueleto: la pantalla no parpadea.
  if (!enRefrescoSilencioso()) cargando.value = true
  try {
    const [lista, cat, ops] = await Promise.all([
      $fetch<{ data: Orden[] }>(API_INSPECCION),
      $fetch<{ data: Inspector[] }>(`${API_INSPECCION}/inspectores`),
      $fetch<{ data: Array<{ id: string; nombre: string }> }>(`${API_INSPECCION}/operarios`),
    ])
    ordenes.value = lista.data
    inspectores.value = cat.data
    operarios.value = ops.data
    // Si hay una orden abierta, se refresca con la versión del servidor.
    if (abierta.value) {
      const actualizada = lista.data.find((o) => o.id === abierta.value!.id)
      abierta.value = actualizada ?? null
    }
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar las órdenes'), true)
  } finally {
    cargando.value = false
  }
}

async function abrirOrden(o: Orden) {
  try {
    const res = await $fetch<{ data: Orden }>(`${API_INSPECCION}/${o.id}`)
    // Si ya la tiene un inspector, primero el aviso: «¿desea continuar?».
    if (res.data.inspector || res.data.inspectores.length) {
      ordenOcupada.value = res.data
      return
    }
    abierta.value = res.data
    // Primero quien toma la orden; la ciudad (si falta) se pide despues.
    pidiendoQuien.value = true
  } catch (e) {
    show(mensajeError(e, 'No se pudo abrir la orden'), true)
  }
}

/**
 * Quien toma la orden al entrar. Queda como el nombre de esta PC y entra a la
 * orden (si nadie la tenia, queda como dueño). Cancelar vuelve a la parrilla:
 * sin nombre no se trabaja una orden.
 */
async function confirmarQuien(id: string) {
  pidiendoQuien.value = false
  recordar(id)
  const nombre = inspectores.value.find((i) => i.id === id)?.nombre ?? ''
  await accion(`${API_INSPECCION}/${abierta.value!.id}/unirse`, { inspectorId: id }, `${nombre} en la orden`)
  // Sin ciudad no se puede inspeccionar: se pide de una, no al fallar.
  if (abierta.value && !abierta.value.ciudadEnvio) pidiendoCiudad.value = true
}
/** Aviso de orden ocupada: Continuar sigue a «¿quién toma la orden?». */
function continuarOcupada() {
  abierta.value = ordenOcupada.value
  ordenOcupada.value = null
  pidiendoQuien.value = true
}

/** Botón de crear: primero quién la crea, después el formulario. */
function crear(tipo: TipoCreacion) {
  creadorId.value = null
  pidiendoCreador.value = tipo
}
function confirmarCreador(id: string) {
  const tipo = pidiendoCreador.value
  pidiendoCreador.value = null
  creadorId.value = id
  recordar(id)
  if (tipo === 'tienda') creandoTienda.value = true
  else if (tipo === 'sinCrear') creandoSinCrear.value = true
  else if (tipo === 'contado') creandoContado.value = true
}

/** Crea la orden a nombre de quien se eligió en la ventana de creación. */
async function crearOrden(url: string, body: Record<string, unknown>, exito: (o: Orden) => string, fallo: string) {
  const id = creadorId.value
  if (!id || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: Orden }>(url, { method: 'POST', body: { ...body, inspectorId: id } })
    abierta.value = res.data
    show(exito(res.data))
  } catch (e) {
    show(mensajeError(e, fallo), true)
  } finally {
    guardando.value = false
  }
}

function cancelarQuien() {
  pidiendoQuien.value = false
  salir()
}

/** Salir es solo volver a la parrilla. Nada más — a propósito. */
function salir() {
  abierta.value = null
  cargar()
}

function recordar(id: string) {
  inspectorActivo.value = id
  try { sessionStorage.setItem(CLAVE, id) } catch { /* sin storage: se reelige */ }
}

/** Corre la acción; si aún no hay nombre elegido, lo pide primero. */
function conInspector(accion: (id: string) => void) {
  if (inspectorActivo.value) return accion(inspectorActivo.value)
  trasElegir.value = accion
  pidiendoInspector.value = true
}

function elegirInspector(id: string) {
  recordar(id)
  pidiendoInspector.value = false
  const accion = trasElegir.value
  trasElegir.value = null
  accion?.(id)
}

function pedirAsignacion() {
  trasElegir.value = (id) => asignar(id)
  pidiendoInspector.value = true
}

async function asignar(inspectorId: string) {
  if (!abierta.value) return
  await accion(`${API_INSPECCION}/${abierta.value.id}/asignar`, { inspectorId }, 'Orden asignada')
}

function iniciar(l: Linea) {
  conInspector(async (id) => {
    await accion(`${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/iniciar`, { inspectorId: id }, `PLU ${l.plu} en inspección`)
    await avisarPartes(l)
  })
}

/** "Viene en N cajas": tapa la pantalla al empezar el PLU. */
async function avisarPartes(l: Linea) {
  if ((l.partes ?? 0) < MINIMO_PARTES_AVISO) return
  const cajas = await cajasDelPlu(l.plu)
  if (cajas.length < MINIMO_PARTES_AVISO) return
  cajasPlu.value = cajas
  lineaAvisada.value = l
}

/**
 * Dar por listo un PLU. Si viene en varias cajas, primero se pregunta si
 * estaban todas: lo que falte se reporta a picking sin frenar la orden.
 */
function completar(l: Linea) {
  conInspector(() => {
    if ((l.partes ?? 0) >= MINIMO_PARTES_AVISO) {
      lineaCajas.value = l
      return
    }
    void completarLinea(l)
  })
}

function completarLinea(l: Linea) {
  return accion(`${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/completar`, {}, `PLU ${l.plu} listo`)
}

function cajasCompletas() {
  const l = lineaCajas.value
  lineaCajas.value = null
  if (l) void completarLinea(l)
}

/** Faltaron cajas: el PLU queda revisado y lo que falta se va a picking. */
async function cajasFaltantes(datos: { cajas: number; nota: string }) {
  const l = lineaCajas.value
  lineaCajas.value = null
  if (!l || !inspectorActivo.value) return
  const total = l.partes ?? 0
  const detalle = `Faltaron ${datos.cajas} de ${total} cajas del PLU${datos.nota ? `: ${datos.nota}` : ''}`
  try {
    await $fetch(`${API_INSPECCION}/pendientes`, {
      method: 'POST',
      body: {
        plu: l.plu,
        unidades: Math.max(1, l.unidades || 1),
        ordenId: abierta.value?.id ?? null,
        inspectorId: inspectorActivo.value,
        observacion: detalle,
      },
    })
    show(`Faltante de ${l.plu} reportado: ${datos.cajas} ${datos.cajas === 1 ? 'caja' : 'cajas'}`)
  } catch (e) {
    show(mensajeError(e, 'No se pudo reportar el faltante'), true)
  }
  await completarLinea(l)
}

function recibirEbanisteria(l: Linea) {
  conInspector((id) => accion(
    `${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/ebanisteria-recibir`,
    { inspectorId: id }, `PLU ${l.plu} de vuelta de ebanistería`,
  ))
}

function confirmarEbanisteria(motivo: string) {
  const l = lineaEbanisteria.value
  if (!l) return
  lineaEbanisteria.value = null
  conInspector((id) => accion(
    `${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/ebanisteria`,
    { inspectorId: id, motivo }, `PLU ${l.plu} enviado a ebanistería`,
  ))
}

async function confirmarFaltante(datos: { plu: string; unidades: number; observacion: string }) {
  pidiendoFaltante.value = false
  conInspector(async (id) => {
    try {
      await $fetch(`${API_INSPECCION}/pendientes`, {
        method: 'POST',
        body: { ...datos, ordenId: abierta.value?.id ?? null, inspectorId: id, observacion: datos.observacion || null },
      })
      show(`Faltante de ${datos.plu} reportado`)
    } catch (e) {
      show(mensajeError(e, 'No se pudo reportar el faltante'), true)
    }
  })
}

/** Error de picking de un PLU (solo admin). */
function confirmarError(datos: { tipo: string; nota: string }) {
  const l = lineaError.value
  if (!l) return
  lineaError.value = null
  accion(`${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/error-picking`, { tipo: datos.tipo, nota: datos.nota || null }, `Error de picking marcado en ${l.plu}`)
}
function quitarError() {
  const l = lineaError.value
  if (!l) return
  lineaError.value = null
  accion(`${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/error-picking`, { quitar: true }, `Error quitado de ${l.plu}`)
}
/** Termina la orden con sus errores: pasa a Entrega a Transporte. */
function terminarConErrores() {
  accion(`${API_INSPECCION}/${abierta.value!.id}/terminar`, {}, 'Orden terminada')
}

/** La ciudad a la que va la orden; con eso agrupa el patinador la entrega. */
function confirmarCiudad(ciudad: string) {
  pidiendoCiudad.value = false
  conInspector((id) => accion(
    `${API_INSPECCION}/${abierta.value!.id}/ciudad`, { inspectorId: id, ciudad }, `Orden hacia ${ciudad}`,
  ))
}

/** Marcar el PLU como averiado y pedir el repuesto a un operario de picking. */
function confirmarAveria(datos: { motivo: string; operarioId: string; unidades: number }) {
  const l = lineaAveriada.value
  if (!l) return
  lineaAveriada.value = null
  conInspector((id) => accion(
    `${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/averia`,
    { inspectorId: id, ...datos }, `PLU ${l.plu} marcado averiado; reposición pedida`,
  ))
}

/** Un PLU que llegó de tienda y no pasó por picking. */
function confirmarAgregarPlu(datos: { plu: string; unidades: number }) {
  agregandoPlu.value = false
  conInspector((id) => accion(
    `${API_INSPECCION}/${abierta.value!.id}/linea`,
    { inspectorId: id, ...datos }, `PLU ${datos.plu} agregado a la orden`,
  ))
}

/** Detiene o reanuda la orden entera: el almuerzo no es tiempo de inspección. */
function almuerzo(accionPausa: 'iniciar' | 'terminar') {
  conInspector((id) => accion(
    `${API_INSPECCION}/${abierta.value!.id}/almuerzo`,
    { inspectorId: id, accion: accionPausa },
    accionPausa === 'iniciar' ? 'Orden en almuerzo' : 'Almuerzo terminado',
  ))
}

/** Entrar a una orden que ya trabaja otro: una TSDM la revisan varios. */
function unirse() {
  conInspector((id) => accion(
    `${API_INSPECCION}/${abierta.value!.id}/unirse`, { inspectorId: id }, 'Estás en la orden',
  ))
}

/** Factura de contado: la orden nace ya en inspección, sin pasar por picking. */
function confirmarContado(datos: { factura: string; cliente: string }) {
  creandoContado.value = false
  void crearOrden(
    `${API_INSPECCION}/contado`, { factura: datos.factura, cliente: datos.cliente || null },
    () => `Factura ${datos.factura} lista para inspeccionar`, 'No se pudo crear la factura',
  )
}

/** Orden de tienda: su OVDM/TSDM llega de una tienda y se inspecciona directo. */
function confirmarTienda(datos: { orden: string; tiendaCodigo: string; cliente: string }) {
  creandoTienda.value = false
  void crearOrden(
    `${API_INSPECCION}/tienda`, { orden: datos.orden, tiendaCodigo: datos.tiendaCodigo, cliente: datos.cliente || null },
    (o) => `Orden ${o.codigo} de ${o.tiendaOrigenNombre ?? 'tienda'} lista para inspeccionar`, 'No se pudo crear la orden de tienda',
  )
}

/** Orden sin crear: la pickearon pero el operario no la registró. */
function confirmarSinCrear(datos: { orden: string; operarioId: string; cliente: string }) {
  creandoSinCrear.value = false
  void crearOrden(
    `${API_INSPECCION}/sin-crear`, { orden: datos.orden, operarioId: datos.operarioId, cliente: datos.cliente || null },
    (o) => `Orden ${o.codigo} (${o.operario?.nombre ?? 'sin operario'}) lista para inspeccionar`, 'No se pudo crear la orden',
  )
}

/** Toda acción devuelve la orden completa: la pantalla se repinta con eso. */
async function accion(url: string, body: Record<string, unknown>, exito: string) {
  if (guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: Orden }>(url, { method: 'POST', body })
    abierta.value = res.data
    if (res.data.estado === 'INSPECCIONADA') {
      show(`Orden ${res.data.codigo} inspeccionada por completo`)
      salir()
    } else {
      show(exito)
    }
  } catch (e) {
    show(mensajeError(e), true)
  } finally {
    guardando.value = false
  }
}

// Ordenes que pasan a inspeccion y cambios de otro inspector en la misma orden
// aparecen solos (las PCs se comparten entre varios).
useAutoRefresh({ onRefresh: () => (guardando.value ? undefined : cargar()) })
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><ClipboardCheck :size="13" /></span>
          CEDI · Muebles
        </span>
        <h1 class="hero-title">Inspección Muebles</h1>
        <p class="hero-desc">Órdenes por inspeccionar, tiempo por PLU y envíos a ebanistería.</p>
      </div>

      <div class="hero-yo">
        <button class="btn btn-sm" @click="crear('tienda')">
          <Store :size="14" /> Orden de tienda
        </button>
        <button class="btn btn-sm" @click="crear('sinCrear')">
          <FilePlus2 :size="14" /> Orden sin crear
        </button>
        <button class="btn btn-sm" @click="crear('contado')">
          <Receipt :size="14" /> Factura de contado
        </button>
        <button class="btn btn-sm" @click="pidiendoInspector = true">
          {{ nombreActivo ? `Eres: ${nombreActivo}` : 'Elegir mi nombre' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="cargando" @click="cargar">
          <RefreshCw :size="14" /> Actualizar
        </button>
      </div>
    </section>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

    <InspeccionMueblesOrdenDetalle
      v-else-if="abierta"
      :orden="abierta" :ahora="ahora" :guardando="guardando"
      @salir="salir" @asignar="pedirAsignacion" @iniciar="iniciar" @completar="completar"
      @ebanisteria="lineaEbanisteria = $event" @recibir-ebanisteria="recibirEbanisteria"
      @faltante="pidiendoFaltante = true" @averia="lineaAveriada = $event"
      @agregar-plu="agregandoPlu = true" @almuerzo="almuerzo" @unirse="unirse"
      @ciudad="pidiendoCiudad = true"
      :es-admin="esAdmin" @error-picking="lineaError = $event" @terminar="terminarConErrores"
    />

    <template v-else>
      <InspeccionMueblesVinetas v-if="ordenes.length" :ordenes="ordenes" :ahora="ahora" @abrir="abrirOrden" />
      <p v-else class="vacio">No hay órdenes esperando inspección.</p>
    </template>

    <InspeccionMueblesSelectorInspector
      :abierto="pidiendoInspector" :inspectores="inspectores" :seleccionado="inspectorActivo"
      @cerrar="pidiendoInspector = false; trasElegir = null" @confirmar="elegirInspector"
    />
    <InspeccionMueblesEbanisteriaModal
      :linea="lineaEbanisteria" @cerrar="lineaEbanisteria = null" @confirmar="confirmarEbanisteria"
    />
    <InspeccionMueblesFaltanteModal
      :abierto="pidiendoFaltante" @cerrar="pidiendoFaltante = false" @confirmar="confirmarFaltante"
    />
    <InspeccionMueblesAveriaModal
      :linea="lineaAveriada" :operarios="operarios"
      @cerrar="lineaAveriada = null" @confirmar="confirmarAveria"
    />
    <InspeccionMueblesAgregarPluModal
      :abierto="agregandoPlu" @cerrar="agregandoPlu = false" @confirmar="confirmarAgregarPlu"
    />
    <InspeccionMueblesErrorPickingModal
      :linea="lineaError" :guardando="guardando"
      @cerrar="lineaError = null" @confirmar="confirmarError" @quitar="quitarError"
    />
    <InspeccionMueblesSelectorInspector
      :abierto="pidiendoQuien" :inspectores="inspectores" :seleccionado="null"
      :titulo="`¿Quién toma la orden ${abierta?.codigo ?? ''}?`"
      @cerrar="cancelarQuien" @confirmar="confirmarQuien"
    />
    <MueblesPartesModal
      :abierto="lineaAvisada != null" :plu="lineaAvisada?.plu ?? ''"
      :descripcion="lineaAvisada?.descripcion ?? null" :cajas="cajasPlu"
      @entendido="lineaAvisada = null"
    />
    <InspeccionMueblesCajasCompletasModal
      :linea="lineaCajas" :partes="lineaCajas?.partes ?? 0" :guardando="guardando"
      @cerrar="lineaCajas = null" @completas="cajasCompletas" @faltan="cajasFaltantes"
    />
    <InspeccionMueblesCiudadModal
      :abierto="pidiendoCiudad" :actual="abierta?.ciudadEnvio ?? null" :sugeridas="ciudadesUsadas"
      @cerrar="pidiendoCiudad = false" @confirmar="confirmarCiudad"
    />
    <InspeccionMueblesSelectorInspector
      :abierto="pidiendoCreador != null" :inspectores="inspectores" :seleccionado="null"
      :titulo="pidiendoCreador ? TITULO_CREACION[pidiendoCreador] : ''"
      descripcion="La orden queda creada a tu nombre."
      @cerrar="pidiendoCreador = null" @confirmar="confirmarCreador"
    />
    <InspeccionMueblesTiendaModal
      :abierto="creandoTienda" :inspector="nombreCreador" @cerrar="creandoTienda = false" @confirmar="confirmarTienda"
    />
    <InspeccionMueblesSinCrearModal
      :abierto="creandoSinCrear" :operarios="operarios" :inspector="nombreCreador"
      @cerrar="creandoSinCrear = false" @confirmar="confirmarSinCrear"
    />
    <InspeccionMueblesContadoModal
      :abierto="creandoContado" :inspector="nombreCreador" @cerrar="creandoContado = false" @confirmar="confirmarContado"
    />
    <ConfirmModal
      v-if="ordenOcupada"
      title="Orden en inspección"
      :message="`La orden ${ordenOcupada.codigo} la está inspeccionando ${nombresOcupada}. ¿Desea continuar?`"
      confirm-label="Continuar" :danger="false"
      @close="ordenOcupada = null" @confirm="continuarOcupada"
    />
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 20px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }
.hero-yo { display: flex; gap: 8px; flex-wrap: wrap; }

.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 720px) { .hero-title { font-size: 24px; } }
</style>
