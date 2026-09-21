<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
// Entrega a Transporte — pantalla del Patinador Muebles.
//
// Toda orden con sus PLU inspeccionados cae aquí sola. El patinador agrupa por
// ciudad, selecciona las que sube al camión y las marca de una vez: ahí cierra
// la medición de la orden (el lead time va desde que se abrió el picking).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Truck, RefreshCw, Loader2, Check, MapPin, Search, X, ListTree } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ensureSession } from '~/composables/useSession'
import { ESTADO_LINEA_LABEL, fmtKg, fmtM3, fmtMin, mensajeError, type Orden } from '~/utils/muebles'

const API = '/api/entrega-muebles'
const { show } = useToast()

const ordenes = ref<Orden[]>([])
const ciudades = ref<Array<{ ciudad: string; ordenes: number }>>([])
const ciudad = ref('')
const historico = ref(false)
const cargando = ref(true)
const guardando = ref(false)
const elegidas = ref<string[]>([])
// Buscador por orden, cliente, ciudad o PLU (pendientes y entregadas).
const buscar = ref('')
let esperaBusqueda: ReturnType<typeof setTimeout> | null = null
function alBuscar() {
  if (esperaBusqueda) clearTimeout(esperaBusqueda)
  esperaBusqueda = setTimeout(() => { elegidas.value = []; void cargar() }, 350)
}
function limpiarBusqueda() {
  buscar.value = ''
  elegidas.value = []
  void cargar()
}

// Ver que lleva una orden por dentro, sin salir de la bandeja: los PLU vienen
// en la misma consulta, asi que abrirla no cuesta otra llamada.
const detalle = ref<Orden | null>(null)
// Si la lista se refresca, el detalle abierto se queda con la version nueva.
function sincronizarDetalle(lista: Orden[]) {
  if (!detalle.value) return
  detalle.value = lista.find((o) => o.id === detalle.value!.id) ?? null
}

const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  tick = setInterval(() => { ahora.value = Date.now() }, 30000)
  ensureSession()
  cargar()
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const total = computed(() => ciudades.value.reduce((a, c) => a + c.ordenes, 0))
const todasElegidas = computed(() => ordenes.value.length > 0 && elegidas.value.length === ordenes.value.length)

/** Lo que lleva esperando una orden ya lista, en minutos. */
function esperando(o: Orden): string {
  if (!o.horaFinInspeccion) return '—'
  return fmtMin(Math.round((ahora.value - new Date(o.horaFinInspeccion).getTime()) / 60000))
}

async function cargar() {
  // Un refresco automatico no pone el esqueleto: la pantalla no parpadea.
  if (!enRefrescoSilencioso()) cargando.value = true
  try {
    const res = await $fetch<{ data: Orden[]; ciudades: Array<{ ciudad: string; ordenes: number }> }>(API, {
      query: {
        ...(ciudad.value ? { ciudad: ciudad.value } : {}),
        ...(historico.value ? { historico: '1' } : {}),
        ...(buscar.value.trim() ? { buscar: buscar.value.trim() } : {}),
      },
    })
    ordenes.value = res.data
    ciudades.value = res.ciudades
    sincronizarDetalle(res.data)
    // Una orden que ya no está en la lista no puede quedar seleccionada.
    elegidas.value = elegidas.value.filter((id) => res.data.some((o) => o.id === id))
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar las órdenes'), true)
  } finally {
    cargando.value = false
  }
}

function alternar(id: string) {
  elegidas.value = elegidas.value.includes(id)
    ? elegidas.value.filter((x) => x !== id)
    : [...elegidas.value, id]
}

function alternarTodas() {
  elegidas.value = todasElegidas.value ? [] : ordenes.value.map((o) => o.id)
}

function verCiudad(c: string) {
  ciudad.value = ciudad.value === c ? '' : c
  elegidas.value = []
  cargar()
}

async function entregar() {
  if (!elegidas.value.length || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ entregadas: number }>(`${API}/entregar`, {
      method: 'POST',
      body: { ordenIds: elegidas.value },
    })
    show(`${res.entregadas} ${res.entregadas === 1 ? 'orden entregada' : 'órdenes entregadas'} a transporte`)
    elegidas.value = []
    await cargar()
  } catch (e) {
    show(mensajeError(e, 'No se pudieron entregar'), true)
  } finally {
    guardando.value = false
  }
}

// Las ordenes que terminan inspeccion caen solas en la bandeja.
useAutoRefresh({ onRefresh: () => (guardando.value ? undefined : cargar()) })
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><Truck :size="13" /></span>
          CEDI · Muebles
        </span>
        <h1 class="hero-title">Entrega a Transporte</h1>
        <p class="hero-desc">
          Órdenes listas para entregar, agrupadas por ciudad. Al marcarlas se cierra el tiempo del proceso.
        </p>
      </div>

      <div class="hero-acciones">
        <button class="btn btn-ghost btn-sm" @click="historico = !historico; elegidas = []; cargar()">
          {{ historico ? 'Ver pendientes' : 'Ver entregadas' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="cargando" @click="cargar">
          <RefreshCw :size="14" /> Actualizar
        </button>
      </div>
    </section>

    <section v-if="!historico && ciudades.length" class="ciudades" aria-label="Filtrar por ciudad">
      <button class="chip" :class="{ on: ciudad === '' }" @click="verCiudad('')">
        Todas <span class="chip-n">{{ total }}</span>
      </button>
      <button
        v-for="c in ciudades" :key="c.ciudad"
        class="chip" :class="{ on: ciudad === c.ciudad }" @click="verCiudad(c.ciudad)"
      >
        <MapPin :size="13" /> {{ c.ciudad }} <span class="chip-n">{{ c.ordenes }}</span>
      </button>
    </section>

    <label class="buscar">
      <Search :size="15" class="buscar-ic" />
      <input
        v-model="buscar" class="buscar-input" type="search" autocomplete="off"
        :placeholder="historico ? 'Buscar entregadas por orden, cliente, ciudad o PLU' : 'Buscar pendientes por orden, cliente, ciudad o PLU'"
        @input="alBuscar"
      >
      <button v-if="buscar" type="button" class="buscar-x" aria-label="Limpiar búsqueda" @click="limpiarBusqueda">
        <X :size="14" />
      </button>
    </label>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

    <template v-else-if="ordenes.length">
      <div v-if="!historico" class="barra">
        <label class="todas">
          <input type="checkbox" :checked="todasElegidas" @change="alternarTodas">
          Seleccionar todas ({{ ordenes.length }})
        </label>
        <button class="btn btn-primary btn-sm" :disabled="!elegidas.length || guardando" @click="entregar">
          <Check :size="14" /> Entregar a transporte ({{ elegidas.length }})
        </button>
      </div>

      <ul class="ordenes">
        <li
          v-for="o in ordenes" :key="o.id" class="orden"
          :class="{ on: elegidas.includes(o.id) }"
        >
          <label class="o-pick">
            <input
              v-if="!historico" type="checkbox" :checked="elegidas.includes(o.id)"
              @change="alternar(o.id)"
            >
            <span class="o-codigo">{{ o.codigo }}</span>
          </label>

          <button class="btn btn-sm o-ver" type="button" @click="detalle = o">
            <ListTree :size="14" /> Ver PLU ({{ o.resumen.total }})
          </button>

          <div class="o-datos">
            <span class="o-tipo">{{ o.tipoOrden }}</span>
            <span class="o-ciudad"><MapPin :size="12" /> {{ o.ciudadEnvio || 'Sin ciudad' }}</span>
            <span class="o-plus">{{ o.resumen.total }} PLU</span>
            <span class="o-carga">{{ fmtKg(o.volumen.kg) }} · {{ fmtM3(o.volumen.m3) }}</span>
            <span v-if="o.cliente" class="o-cliente">{{ o.cliente }}</span>
          </div>

          <div class="o-tiempo">
            <template v-if="historico">
              <span class="o-quien">Entregado el {{ o.entregadaTransporteAt ? new Date(o.entregadaTransporteAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : 'Sin fecha' }}</span>
              <span class="o-lead">Lead time <strong>{{ fmtMin(o.leadTimeMin) }}</strong></span>
              <span class="o-quien">Entregó {{ o.entregadaPor?.nombre ?? '—' }}</span>
            </template>
            <template v-else>
              <span class="o-espera">Lista hace <strong>{{ esperando(o) }}</strong></span>
              <span class="o-quien">Inspeccionó {{ o.inspector?.nombre ?? '—' }}</span>
            </template>
          </div>
        </li>
      </ul>
    </template>

    <!-- Que lleva la orden por dentro. Solo para mirar: aqui no se toca nada. -->
    <div v-if="detalle" class="overlay" @click.self="detalle = null">
      <section class="panel" role="dialog" aria-modal="true" :aria-label="`PLU de la orden ${detalle.codigo}`">
        <header class="p-head">
          <div>
            <span class="o-tipo">{{ detalle.tipoOrden }}</span>
            <h2 class="p-codigo">{{ detalle.codigo }}</h2>
            <p class="p-meta">
              <MapPin :size="12" /> {{ detalle.ciudadEnvio || 'Sin ciudad' }}
              · {{ detalle.resumen.total }} PLU
              · {{ fmtKg(detalle.volumen.kg) }} · {{ fmtM3(detalle.volumen.m3) }}
              <template v-if="detalle.cliente"> · {{ detalle.cliente }}</template>
            </p>
            <p v-if="detalle.volumen.lineasSinMedida" class="p-aviso">
              {{ detalle.volumen.lineasSinMedida }} PLU sin medidas en el maestro: el peso y el volumen van cortos.
            </p>
          </div>
          <button class="icono" aria-label="Cerrar" @click="detalle = null"><X :size="18" /></button>
        </header>

        <div class="tabla-wrap">
          <table class="tabla">
            <thead>
              <tr>
                <th>PLU</th>
                <th>Ubicación / rótulo</th>
                <th class="num">Und</th>
                <th class="num">Peso / m³</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in detalle.lineas" :key="l.id">
                <td>
                  <strong class="l-plu mono">{{ l.plu }}</strong>
                  <span class="l-desc">{{ l.descripcion || 'Sin descripción en el maestro' }}</span>
                </td>
                <td>
                  <span class="mono">{{ l.ubicacion || '—' }}</span>
                  <span class="l-desc mono">{{ l.numeroCaja || '—' }}</span>
                </td>
                <td class="num tnum">{{ l.unidades }}</td>
                <td class="num">
                  <strong class="tnum">{{ fmtKg(l.pesoTotalKg) }}</strong>
                  <span class="l-desc tnum">{{ fmtM3(l.volumenTotalM3) }}</span>
                </td>
                <td><span class="l-estado">{{ ESTADO_LINEA_LABEL[l.estado] }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="p-pie">
          <span class="p-quien">Inspeccionó {{ detalle.inspector?.nombre ?? '—' }}</span>
          <button class="btn btn-ghost btn-sm" @click="detalle = null">Cerrar</button>
        </footer>
      </section>
    </div>

    <p v-else-if="!cargando && !ordenes.length" class="vacio">
      {{ buscar.trim()
        ? `Nada coincide con «${buscar.trim()}».`
        : historico ? 'Todavía no hay órdenes entregadas.' : 'No hay órdenes listas para entregar.' }}
    </p>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 20px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); max-width: 62ch; }
.hero-acciones { display: flex; gap: 8px; flex-wrap: wrap; }

.ciudades { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: var(--r-pill); border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.chip.on { color: var(--brand); border-color: var(--brand); background: var(--brand-tint); }
.chip-n { font-weight: 800; font-variant-numeric: tabular-nums; }

.buscar { position: relative; display: flex; align-items: center; margin-bottom: 14px; }
.buscar-ic { position: absolute; left: 12px; color: var(--muted); pointer-events: none; }
.buscar-input { width: 100%; padding: 10px 38px 10px 36px; border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--surface); color: var(--ink); font-size: 13.5px; }
.buscar-input:focus { outline: none; border-color: var(--brand); }
.buscar-x { position: absolute; right: 8px; display: grid; place-items: center; width: 26px; height: 26px; border: none; border-radius: var(--r-sm); background: transparent; color: var(--muted); cursor: pointer; }
.barra { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 11px 14px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.todas { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }

.ordenes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.orden { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 13px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.orden.on { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 5%, var(--surface)); }
.o-pick { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.o-codigo { font-size: 15px; font-weight: 800; color: var(--ink); }
.o-datos { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1 1 220px; font-size: 12px; color: var(--muted); }
.o-tipo { padding: 2px 8px; border-radius: var(--r-pill); font-size: 10.5px; font-weight: 800; letter-spacing: .05em; color: var(--brand); background: var(--brand-tint); }
.o-ciudad { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: var(--ink-2); }
.o-tiempo { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 11.5px; color: var(--muted); }
.o-lead strong, .o-espera strong { color: var(--ink); font-variant-numeric: tabular-nums; }

.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .hero-acciones, .hero-acciones .btn { width: 100%; }
  .hero-acciones .btn { justify-content: center; }
  .orden { align-items: flex-start; }
  .o-tiempo { align-items: flex-start; }
  .barra .btn { width: 100%; justify-content: center; }
}
.o-carga { font-weight: 700; color: var(--ink-2); }
.o-ver { flex-shrink: 0; }

.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.panel { width: 100%; max-width: 860px; max-height: 86vh; display: flex; flex-direction: column; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.p-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.p-codigo { margin: 6px 0 4px; font-size: 20px; font-weight: 800; color: var(--ink); }
.p-meta { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin: 0; font-size: 12.5px; color: var(--muted); }
.p-aviso { margin: 8px 0 0; font-size: 12px; font-weight: 700; color: var(--u-aviso); }
.icono { display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: var(--r-sm); background: transparent; color: var(--muted); cursor: pointer; }
.icono:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--ink); }
.tabla-wrap { overflow: auto; margin: 14px 0 4px; }
.tabla { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
.tabla th { position: sticky; top: 0; padding: 9px 10px; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); background: var(--surface); border-bottom: 1px solid var(--border); }
.tabla td { padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
.tabla .num { text-align: right; }
.l-plu { display: block; font-size: 13.5px; font-weight: 800; color: var(--ink); }
.l-desc { display: block; font-size: 11.5px; color: var(--muted); }
.l-estado { padding: 2px 9px; border-radius: var(--r-pill); font-size: 11px; font-weight: 700; color: var(--brand); background: var(--brand-tint); }
.p-pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 12px; font-size: 12.5px; color: var(--muted); }
@media (max-width: 640px) { .panel { padding: 14px; max-height: 92vh; } .o-ver { width: 100%; justify-content: center; } }
</style>
