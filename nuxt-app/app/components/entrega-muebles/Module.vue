<script setup lang="ts">
// Entrega a Transporte — pantalla del Patinador Muebles.
//
// Toda orden con sus PLU inspeccionados cae aquí sola. El patinador agrupa por
// ciudad, selecciona las que sube al camión y las marca de una vez: ahí cierra
// la medición de la orden (el lead time va desde que se abrió el picking).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Truck, RefreshCw, Loader2, Check, MapPin } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ensureSession } from '~/composables/useSession'
import { fmtMin, mensajeError, type Orden } from '~/utils/muebles'

const API = '/api/entrega-muebles'
const { show } = useToast()

const ordenes = ref<Orden[]>([])
const ciudades = ref<Array<{ ciudad: string; ordenes: number }>>([])
const ciudad = ref('')
const historico = ref(false)
const cargando = ref(true)
const guardando = ref(false)
const elegidas = ref<string[]>([])

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
  cargando.value = true
  try {
    const res = await $fetch<{ data: Orden[]; ciudades: Array<{ ciudad: string; ordenes: number }> }>(API, {
      query: { ...(ciudad.value ? { ciudad: ciudad.value } : {}), ...(historico.value ? { historico: '1' } : {}) },
    })
    ordenes.value = res.data
    ciudades.value = res.ciudades
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

          <div class="o-datos">
            <span class="o-tipo">{{ o.tipoOrden }}</span>
            <span class="o-ciudad"><MapPin :size="12" /> {{ o.ciudadEnvio || 'Sin ciudad' }}</span>
            <span class="o-plus">{{ o.resumen.total }} PLU</span>
            <span v-if="o.cliente" class="o-cliente">{{ o.cliente }}</span>
          </div>

          <div class="o-tiempo">
            <template v-if="historico">
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

    <p v-else class="vacio">
      {{ historico ? 'Todavía no hay órdenes entregadas.' : 'No hay órdenes listas para entregar.' }}
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
</style>
