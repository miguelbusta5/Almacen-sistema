<script setup lang="ts">
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
import { ClipboardCheck, RefreshCw, Loader2, Receipt } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import {
  API_INSPECCION, mensajeError, type Inspector, type Linea, type Orden,
} from '~/utils/muebles'

const { show } = useToast()

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
  cargando.value = true
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
    abierta.value = res.data
  } catch (e) {
    show(mensajeError(e, 'No se pudo abrir la orden'), true)
  }
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
  conInspector((id) => accion(`${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/iniciar`, { inspectorId: id }, `PLU ${l.plu} en inspección`))
}

function completar(l: Linea) {
  conInspector(() => accion(`${API_INSPECCION}/${abierta.value!.id}/linea/${l.id}/completar`, {}, `PLU ${l.plu} listo`))
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
  conInspector(async (id) => {
    if (guardando.value) return
    guardando.value = true
    try {
      const res = await $fetch<{ data: Orden }>(`${API_INSPECCION}/contado`, {
        method: 'POST',
        body: { inspectorId: id, factura: datos.factura, cliente: datos.cliente || null },
      })
      abierta.value = res.data
      show(`Factura ${datos.factura} lista para inspeccionar`)
    } catch (e) {
      show(mensajeError(e, 'No se pudo crear la factura'), true)
    } finally {
      guardando.value = false
    }
  })
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
        <button class="btn btn-sm" @click="creandoContado = true">
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
    <InspeccionMueblesContadoModal
      :abierto="creandoContado" @cerrar="creandoContado = false" @confirmar="confirmarContado"
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
