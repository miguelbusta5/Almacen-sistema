<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
// Picking Muebles — pantalla del operario.
//
// El estado lo manda siempre el servidor: cada accion devuelve la orden completa
// y la pantalla se repinta con eso. No se mantiene una copia local que pueda
// desincronizarse, que es justo lo que arruina un modulo con relojes.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Hammer, Plus, ClipboardCheck, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { usePausaOperativa } from '~/composables/usePausaOperativa'
import { esGestionMuebles } from '~/utils/mueblesUi'
import {
  API_PICKING, ESTADO_ORDEN_LABEL, cronometro, mensajeError,
  type Equipo, type Linea, type Orden, type Pendiente, type VolumenOrden,
} from '~/utils/muebles'

const { show } = useToast()
// Al almorzar (o volver) el servidor detiene/reanuda la orden: hay que repintar.
const { revision: pausaRevision } = usePausaOperativa()
const { me } = useSessionState()
const esGestion = computed(() => esGestionMuebles(me.value?.role))

const orden = ref<Orden | null>(null)
const equipo = ref<Equipo | null>(null)
// Sin orden abierta no hay volumen que mostrar. Se deriva de la orden y NO se
// guarda aparte: un ref paralelo se quedaba en cero al unirse a una orden que
// ya traia lineas cerradas del companero.
const VACIO: VolumenOrden = { m3: 0, kg: 0, lineasSinMedida: 0 }
const volumen = computed<VolumenOrden>(() => orden.value?.volumen ?? VACIO)
// Orden ajena con la que se choco al intentar crear: dispara el modal de unirse.
const choque = ref<{ ordenId: string; orden: string; operario: string; equipo: string | null } | null>(null)
const pendientes = ref<Pendiente[]>([])
const cargando = ref(true)
const guardando = ref(false)
const codigoNuevo = ref('')

// Un solo reloj para toda la pantalla, no un setInterval por fila.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
  ensureSession()
  cargar()
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

// El PLU en curso es SOLO el mio: en una orden compartida el companero puede
// tener el suyo abierto y eso no me bloquea.
const lineaEnCurso = computed<Linea | null>(
  () => orden.value?.lineas.find((l) => l.estado === 'EN_PICKING' && l.operario?.id === me.value?.id) ?? null,
)
const hayAlgunoEnCurso = computed(
  () => orden.value?.lineas.some((l) => l.estado === 'EN_PICKING') ?? false,
)
// La pasa a inspeccion el ULTIMO que se unio, que es quien termina el trabajo.
// Gestion tambien, para que no se quede abierta si esa persona sale de turno.
const meTocaCerrar = computed(() => {
  const ps = orden.value?.participantes ?? []
  if (ps.length === 0) return false
  if (esGestion.value) return true
  return ps[ps.length - 1]!.id === me.value?.id
})
const puedePasar = computed(
  () => orden.value != null && orden.value.lineas.length > 0 && !hayAlgunoEnCurso.value && meTocaCerrar.value,
)
const motivoNoPuede = computed(() => {
  if (!orden.value || orden.value.lineas.length === 0) return null
  if (hayAlgunoEnCurso.value) {
    return lineaEnCurso.value
      ? 'Termina el PLU en curso para poder pasar la orden a inspección.'
      : 'Hay un PLU en curso del otro operario.'
  }
  if (!meTocaCerrar.value) {
    const ps = orden.value.participantes
    return `La pasa a inspección ${ps[ps.length - 1]!.nombre}, que es quien termina.`
  }
  return null
})

watch(pausaRevision, () => { void cargar() })

async function cargar() {
  // Un refresco automatico no pone el esqueleto: la pantalla no parpadea.
  if (!enRefrescoSilencioso()) cargando.value = true
  try {
    const [abierta, pend] = await Promise.all([
      $fetch<{ data: { orden: Orden | null; equipo: Equipo | null } }>(`${API_PICKING}/abierta`),
      $fetch<{ data: Pendiente[] }>(`${API_PICKING}/mis-pendientes`).catch(() => ({ data: [] })),
    ])
    orden.value = abierta.data.orden
    equipo.value = abierta.data.equipo
    pendientes.value = pend.data
  } catch (e) {
    show(mensajeError(e, 'No se pudo cargar tu orden'), true)
  } finally {
    cargando.value = false
  }
}

async function crearOrden() {
  const codigo = codigoNuevo.value.trim()
  if (!codigo || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: Orden }>(API_PICKING, { method: 'POST', body: { codigo } })
    orden.value = res.data
    equipo.value = res.data.equipo
    codigoNuevo.value = ''
    show(`Orden ${res.data.codigo} abierta`)
  } catch (e) {
    // Choque con una orden viva: no es un error del operario, es una pregunta.
    const data = (e as { data?: { data?: { codigo?: string } } })?.data?.data
    if (data?.codigo === 'ORDEN_YA_ABIERTA') {
      choque.value = data as unknown as typeof choque.value
    } else {
      show(mensajeError(e, 'No se pudo abrir la orden'), true)
    }
  } finally {
    guardando.value = false
  }
}

async function unirse() {
  if (!choque.value || guardando.value) return
  guardando.value = true
  const destino = choque.value
  try {
    const res = await $fetch<{ data: Orden }>(`${API_PICKING}/${destino.ordenId}/unirse`, { method: 'POST' })
    orden.value = res.data
    choque.value = null
    codigoNuevo.value = ''
    show(`Te uniste a ${destino.orden}`)
  } catch (e) {
    show(mensajeError(e, 'No te pudiste unir a la orden'), true)
  } finally {
    guardando.value = false
  }
}

async function escanearPlu(plu: string) {
  if (!orden.value || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: { linea: Linea; sinMedidas: boolean } }>(
      `${API_PICKING}/${orden.value.id}/plu`, { method: 'POST', body: { plu } },
    )
    orden.value = { ...orden.value, lineas: [...orden.value.lineas, res.data.linea] }
    if (res.data.sinMedidas) show(`PLU ${plu} sin medidas en el maestro`, true)
  } catch (e) {
    show(mensajeError(e, 'No se pudo iniciar el PLU'), true)
  } finally {
    guardando.value = false
  }
}

async function cerrarLinea(datos: { ubicacion: string; unidades: number; numeroCaja: string }) {
  if (!orden.value || !lineaEnCurso.value || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: { orden: Orden } }>(
      `${API_PICKING}/${orden.value.id}/linea/${lineaEnCurso.value.id}/cerrar`,
      { method: 'POST', body: datos },
    )
    orden.value = res.data.orden
    show('PLU finalizado')
  } catch (e) {
    show(mensajeError(e, 'No se pudo cerrar el PLU'), true)
  } finally {
    guardando.value = false
  }
}

async function pasarAInspeccion() {
  if (!orden.value || guardando.value) return
  guardando.value = true
  try {
    const codigo = orden.value.codigo
    await $fetch(`${API_PICKING}/${orden.value.id}/inspeccion`, { method: 'POST' })
    // Se recarga entero: la orden sale de la pantalla y con ella el volumen.
    await cargar()
    show(`Orden ${codigo} pasada a inspección`)
  } catch (e) {
    show(mensajeError(e, 'No se pudo pasar la orden a inspección'), true)
  } finally {
    guardando.value = false
  }
}

async function resolverPendiente(id: string) {
  try {
    await $fetch(`${API_PICKING}/pendiente/${id}/resolver`, { method: 'POST' })
    pendientes.value = pendientes.value.filter((p) => p.id !== id)
    show('Pendiente resuelto')
  } catch (e) {
    show(mensajeError(e, 'No se pudo resolver el pendiente'), true)
  }
}

// Faltantes y reposiciones que le asignan al operario aparecen solos.
useAutoRefresh({ onRefresh: () => (guardando.value ? undefined : cargar()) })
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><Hammer :size="13" /></span>
          CEDI · Muebles
        </span>
        <h1 class="hero-title">Picking Muebles</h1>
        <p class="hero-desc">Órdenes OVDM/TSDM con tiempo por PLU y volumen de la orden.</p>
      </div>
    </section>

    <PickingMueblesVolumenOrden :equipo="equipo" :volumen="volumen" :participantes="orden?.participantes" />

    <!-- Pendientes asignados: van arriba porque son trabajo que alguien esta
         esperando, y abajo se perderian bajo la orden en curso. -->
    <section v-if="pendientes.length" class="pend">
      <h2 class="pend-titulo">Pendientes por recolectar</h2>
      <ul class="pend-lista">
        <li v-for="p in pendientes" :key="p.id" class="pend-item">
          <div>
            <strong>{{ p.plu }}</strong> · {{ p.unidades }} unid.
            <span v-if="p.orden" class="pend-orden">{{ p.orden.codigo }}</span>
            <p v-if="p.observacion" class="pend-obs">{{ p.observacion }}</p>
          </div>
          <button class="btn btn-sm" @click="resolverPendiente(p.id)">Marcar recolectado</button>
        </li>
      </ul>
    </section>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

    <!-- Sin orden abierta: lo unico que se puede hacer es abrir una. -->
    <template v-else-if="!orden">
      <section class="nueva">
        <label class="campo">
          <span class="campo-label">Número de orden</span>
          <input
            v-model="codigoNuevo" class="input scan" type="text" autocomplete="off" autofocus
            placeholder="Ej. TSDM123456" :disabled="guardando || !equipo"
            @keyup.enter="crearOrden"
          >
        </label>
        <button class="btn btn-primary" :disabled="!codigoNuevo.trim() || guardando || !equipo" @click="crearOrden">
          <Loader2 v-if="guardando" :size="15" class="spin" /><Plus v-else :size="15" />
          Abrir orden
        </button>
        <p v-if="!equipo" class="nueva-aviso">
          Necesitas un equipo asignado hoy. Pide al administrador que te asigne el Order Picker o el Genie.
        </p>
      </section>
    </template>

    <template v-else>
      <section class="orden-head">
        <div>
          <span class="orden-tipo">{{ orden.tipoOrden }}</span>
          <h2 class="orden-codigo">{{ orden.codigo }}</h2>
          <p class="orden-meta">
            {{ ESTADO_ORDEN_LABEL[orden.estado] }} ·
            {{ orden.lineas.length }} PLU ·
            abierta hace <strong class="vivo">{{ cronometro(orden.horaInicio, ahora) }}</strong>
          </p>
        </div>
        <button class="btn btn-primary" :disabled="!puedePasar || guardando" @click="pasarAInspeccion">
          <ClipboardCheck :size="15" /> Pasar a inspección
        </button>
      </section>
      <p v-if="motivoNoPuede" class="orden-nota">{{ motivoNoPuede }}</p>

      <PickingMueblesCapturaPlu
        :linea-en-curso="lineaEnCurso" :guardando="guardando"
        @escanear-plu="escanearPlu" @cerrar-linea="cerrarLinea"
      />

      <PickingMueblesTablaLineas
        v-if="orden.lineas.length" :lineas="orden.lineas" :ahora="ahora"
        :mostrar-operario="orden.participantes.length > 1"
      />
      <p v-else class="vacio">Escanea el primer PLU de la orden.</p>
    </template>

    <PickingMueblesUnirseModal :choque="choque" :guardando="guardando" @cerrar="choque = null" @unirse="unirse" />
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 20px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }

.nueva { display: flex; align-items: flex-end; gap: 12px; padding: 18px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); flex-wrap: wrap; }
.nueva-aviso { flex: 1 1 100%; margin: 0; font-size: 12.5px; font-weight: 600; color: var(--u-aviso); }
.campo { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 200px; }
.campo-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.input.scan { font-size: 16px; font-weight: 600; padding: 11px 13px; }

.orden-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 6px; flex-wrap: wrap; }
.orden-tipo { display: inline-block; padding: 2px 9px; border-radius: var(--r-pill); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; color: var(--brand); background: var(--brand-tint); }
.orden-codigo { margin: 6px 0 2px; font-size: 22px; font-weight: 800; color: var(--ink); }
.orden-meta { margin: 0; font-size: 12.5px; color: var(--muted); }
.orden-nota { margin: 0 0 12px; font-size: 12px; font-weight: 600; color: var(--u-aviso); }
.vivo { color: var(--brand); }

.pend { margin-bottom: 18px; padding: 14px 16px; border-radius: var(--r-md); border: 1px solid color-mix(in srgb, var(--u-aviso) 30%, transparent); background: color-mix(in srgb, var(--u-aviso) 7%, var(--surface)); }
.pend-titulo { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--u-aviso); }
.pend-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.pend-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--ink); flex-wrap: wrap; }
.pend-orden { margin-left: 6px; font-size: 11.5px; color: var(--muted); }
.pend-obs { margin: 3px 0 0; font-size: 11.5px; color: var(--muted); }

.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 26px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 720px) { .hero-title { font-size: 24px; } }
</style>
