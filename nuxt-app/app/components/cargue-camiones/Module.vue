<script setup lang="ts">
// Cargue de camiones (25-09-2026). Como Recepción de contenedores pero de
// salida: se inicia el camión (tipo, transportadora, placa, quiénes cargan) y
// arranca su reloj; se le suben órdenes OVDM/TSDM una a una, cada una con su
// reloj y sus bultos contados; y se finaliza el camión.
//
// Puede haber varios camiones abiertos a la vez (varios muelles): se elige en
// cuál se trabaja. Se sobrevive a recargar: todo vive en el servidor.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw, Truck, Plus, Users, ChevronDown, ChevronRight } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import { canSeeModule } from '~/utils/modulePermissions'
import { cronometro, fmtMin } from '~/utils/muebles'
import { hoyBogota } from '~/utils/exportaciones'
import {
  API_CARGUE, ORIGEN_CARGUE_LABEL, bultosCamion, esGestionCargueUi, fmtHoraCargue, minutosCargue, novedadesCamion,
  type CamionCargue, type DatosCamion, type OperarioCargue,
} from '~/utils/cargueCamiones'

const { me, sessionLoaded } = useSessionState()
const { show } = useToast()
const puedeVer = computed(() => canSeeModule(me.value?.role, 'cargue-camiones'))
const esAdmin = computed(() => me.value?.role === 'ADMIN')
const esGestion = computed(() => esGestionCargueUi(me.value?.role))

const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => { ensureSession(); tick = setInterval(() => { ahora.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const abiertos = ref<CamionCargue[]>([])
const cerrados = ref<CamionCargue[]>([])
const operarios = ref<OperarioCargue[]>([])
const sugerencias = ref<{ transportadoras: string[]; vehiculos: string[] }>({ transportadoras: [], vehiculos: [] })
const fecha = ref(hoyBogota())
const cargando = ref(true)
const guardando = ref(false)
const seleccionado = ref<string | null>(null)
const iniciando = ref(false)
const editando = ref<CamionCargue | null>(null)
const verOperarios = ref(false)
const expandido = ref<string | null>(null)

const actual = computed(() => abiertos.value.find((c) => c.id === seleccionado.value) ?? null)

async function cargar() {
  try {
    const [res, ops] = await Promise.all([
      $fetch<{ abiertos: CamionCargue[]; cerrados: CamionCargue[]; sugerencias: { transportadoras: string[]; vehiculos: string[] } }>(API_CARGUE, { query: { fecha: fecha.value } }),
      $fetch<{ data: OperarioCargue[] }>(`${API_CARGUE}/operarios`),
    ])
    abiertos.value = res.abiertos
    cerrados.value = res.cerrados
    sugerencias.value = res.sugerencias
    operarios.value = ops.data
    if (!abiertos.value.some((c) => c.id === seleccionado.value)) seleccionado.value = abiertos.value[0]?.id ?? null
  } catch (e) {
    show(apiErr(e, 'No se pudo cargar'), true)
  } finally {
    cargando.value = false
  }
}
watch(() => me.value?.id, (id) => { if (id && puedeVer.value) void cargar() }, { immediate: true })
watch(fecha, () => { void cargar() })
useAutoRefresh({ onRefresh: () => (guardando.value || iniciando.value || editando.value ? undefined : (puedeVer.value ? cargar() : undefined)) })

async function iniciar(d: DatosCamion) {
  if (guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: CamionCargue }>(API_CARGUE, { method: 'POST', body: d })
    abiertos.value = [...abiertos.value, res.data]
    seleccionado.value = res.data.id
    iniciando.value = false
    show('Cargue del camión iniciado')
  } catch (e) {
    show(apiErr(e, 'No se pudo iniciar el cargue'), true)
  } finally {
    guardando.value = false
  }
}

async function guardarEdicion(d: DatosCamion) {
  const c = editando.value
  if (!c || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: CamionCargue }>(`${API_CARGUE}/${c.id}`, { method: 'PATCH', body: d })
    actualizado(res.data)
    editando.value = null
    show('Camión actualizado')
  } catch (e) {
    show(apiErr(e, 'No se pudo guardar'), true)
  } finally {
    guardando.value = false
  }
}

function actualizado(c: CamionCargue) {
  if (c.estado === 'CERRADO') {
    abiertos.value = abiertos.value.filter((x) => x.id !== c.id)
    cerrados.value = [c, ...cerrados.value.filter((x) => x.id !== c.id)]
    seleccionado.value = abiertos.value[0]?.id ?? null
  } else {
    abiertos.value = abiertos.value.map((x) => (x.id === c.id ? c : x))
    cerrados.value = cerrados.value.map((x) => (x.id === c.id ? c : x))
  }
}

const inicialEdicion = computed<DatosCamion | null>(() => editando.value
  ? {
      tipoVehiculo: editando.value.tipoVehiculo, transportadora: editando.value.transportadora,
      placa: editando.value.placa, observacion: editando.value.observacion, operarios: editando.value.operarios.map((o) => o.id),
    }
  : null)
// Al corregir, las personas del camión se ofrecen aunque hoy estén inactivas.
const operariosEdicion = computed(() => {
  const extra = (editando.value?.operarios ?? []).filter((o) => !operarios.value.some((x) => x.id === o.id))
  return [...operarios.value, ...extra]
})

const resumenDia = computed(() => {
  const todos = [...abiertos.value.filter((c) => c.fecha === fecha.value), ...cerrados.value]
  return {
    camiones: cerrados.value.length,
    enCurso: abiertos.value.length,
    ordenes: todos.reduce((s, c) => s + c.ordenes.filter((o) => o.horaFin).length, 0),
    bultos: todos.reduce((s, c) => s + bultosCamion(c), 0),
  }
})
const duracion = (a: string, b: string | null) => fmtMin(minutosCargue(a, b))
</script>

<template>
  <div class="mod">
    <section class="hero">
      <div>
        <span class="hero-kicker"><span class="hero-ic"><Truck :size="13" /></span> CEDI · Transporte</span>
        <h1 class="hero-title">Cargue de camiones</h1>
        <p class="hero-desc">Órdenes OVDM/TSDM que suben a cada camión, con su tiempo y sus bultos.</p>
      </div>
      <div class="hero-actions">
        <button v-if="esAdmin" class="btn btn-sm" @click="verOperarios = true"><Users :size="14" /> Personas que cargan</button>
        <button class="btn btn-ghost btn-sm" @click="cargar"><RefreshCw :size="14" /> Actualizar</button>
      </div>
    </section>

    <ListSkeleton v-if="!sessionLoaded || (cargando && puedeVer)" />
    <EmptyState v-else-if="!puedeVer" title="Sin acceso" description="Este módulo es para el equipo de transporte." />

    <template v-else>
      <div class="kpis">
        <div class="kpi card" data-kpi><span class="kpi-l" data-kpi-label>Camiones cargados</span><b class="kpi-v tnum" data-kpi-valor>{{ resumenDia.camiones }}</b></div>
        <div class="kpi card" data-kpi><span class="kpi-l" data-kpi-label>En cargue ahora</span><b class="kpi-v tnum" data-kpi-valor>{{ resumenDia.enCurso }}</b></div>
        <div class="kpi card" data-kpi><span class="kpi-l" data-kpi-label>Órdenes cargadas</span><b class="kpi-v tnum" data-kpi-valor>{{ resumenDia.ordenes }}</b></div>
        <div class="kpi card" data-kpi><span class="kpi-l" data-kpi-label>Bultos</span><b class="kpi-v tnum" data-kpi-valor>{{ resumenDia.bultos }}</b></div>
      </div>

      <!-- Camiones abiertos: se elige en cuál se trabaja -->
      <nav v-if="abiertos.length" class="abiertos" aria-label="Camiones en cargue">
        <button
          v-for="c in abiertos" :key="c.id" class="ab" :class="{ on: c.id === seleccionado }"
          @click="seleccionado = c.id; iniciando = false"
        >
          <Truck :size="14" />
          <span class="ab-t">{{ c.placa ?? c.tipoVehiculo }} · {{ c.transportadora }}</span>
          <span class="ab-r tnum">{{ cronometro(c.horaInicio, ahora) }}</span>
        </button>
        <button class="ab nuevo" :class="{ on: iniciando }" @click="iniciando = true"><Plus :size="14" /> Iniciar otro camión</button>
      </nav>

      <section v-if="iniciando || !abiertos.length" class="card bloque ini">
        <h2 class="ini-t"><Truck :size="16" /> Iniciar cargue del camión</h2>
        <CargueCamionesCamionForm
          :operarios="operarios" :sugerencias="sugerencias" :guardando="guardando" @guardar="iniciar"
        />
        <button v-if="abiertos.length" class="btn btn-ghost btn-sm cancelar-ini" @click="iniciando = false">Volver al camión en cargue</button>
      </section>
      <CargueCamionesPlanilla
        v-else-if="actual" class="bloque" :camion="actual" :ahora="ahora"
        @actualizado="actualizado" @editar="editando = actual"
      />

      <!-- Lo que ya se cargó -->
      <section class="card bloque">
        <header class="hist-cab">
          <h2 class="hist-t">Camiones cargados</h2>
          <input v-model="fecha" class="field" type="date" :max="hoyBogota()">
        </header>
        <p v-if="!cerrados.length" class="vacio">Ningún camión finalizado ese día.</p>
        <ul v-else class="hist">
          <li v-for="c in cerrados" :key="c.id">
            <button class="hist-fila" :aria-expanded="expandido === c.id" @click="expandido = expandido === c.id ? null : c.id">
              <component :is="expandido === c.id ? ChevronDown : ChevronRight" :size="15" />
              <span class="hist-camion"><b>{{ c.placa ?? c.tipoVehiculo }}</b> · {{ c.transportadora }}</span>
              <span class="hist-dato tnum">{{ fmtHoraCargue(c.horaInicio) }}–{{ fmtHoraCargue(c.horaFinalizacion) }} · {{ duracion(c.horaInicio, c.horaFinalizacion) }}</span>
              <span class="hist-dato tnum">{{ c.ordenes.length }} órdenes · {{ bultosCamion(c) }} bultos</span>
              <span v-if="novedadesCamion(c)" class="hist-nov">{{ novedadesCamion(c) }} con novedad</span>
            </button>
            <div v-if="expandido === c.id" class="hist-det">
              <p class="desc">{{ c.tipoVehiculo }} · cargaron {{ c.operarios.map((o) => o.nombre).join(', ') }}<template v-if="c.observacion"> · {{ c.observacion }}</template></p>
              <table class="tabla-c">
                <thead><tr><th>Orden</th><th>Tienda / cliente</th><th>Ciudad</th><th class="num">Declarados</th><th class="num">Cargados</th><th class="num">Tiempo</th><th>Novedad</th></tr></thead>
                <tbody>
                  <tr v-for="o in c.ordenes" :key="o.id">
                    <td><b class="mono">{{ o.codigo }}</b> <span class="desc">{{ ORIGEN_CARGUE_LABEL[o.origen] }}</span></td>
                    <td>{{ o.tienda ?? o.cliente ?? '—' }}</td>
                    <td>{{ o.ciudad ?? '—' }}</td>
                    <td class="num tnum">{{ o.bultosDeclarados ?? '—' }}</td>
                    <td class="num tnum">{{ o.bultosCargados ?? '—' }}</td>
                    <td class="num tnum">{{ duracion(o.horaInicio, o.horaFin) }}</td>
                    <td>{{ o.notaDiferencia ?? '' }}</td>
                  </tr>
                </tbody>
              </table>
              <button v-if="esGestion" class="btn btn-sm" @click="editando = c">Corregir camión</button>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <!-- Editar / corregir el camión -->
    <div v-if="editando" class="ov" @click.self="editando = null">
      <div class="modal-ed card" role="dialog" aria-modal="true" aria-label="Editar camión">
        <h3 class="ini-t"><Truck :size="16" /> {{ editando.estado === 'CERRADO' ? 'Corregir camión' : 'Editar camión' }}</h3>
        <CargueCamionesCamionForm
          :operarios="operariosEdicion" :sugerencias="sugerencias" :inicial="inicialEdicion" :guardando="guardando"
          :pide-motivo="editando.estado === 'CERRADO'" texto-boton="Guardar"
          @guardar="guardarEdicion" @cancelar="editando = null"
        />
      </div>
    </div>

    <CargueCamionesOperariosModal :abierto="verOperarios" @cerrar="verOperarios = false" @cambio="cargar" />
  </div>
</template>

<style scoped>
.mod { position: relative; }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 18px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }
.hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.bloque { margin-bottom: 18px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
.kpi { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.kpi-l { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.kpi-v { font-size: 24px; font-weight: 800; color: var(--ink); }
.abiertos { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ab { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid var(--border-strong); border-radius: var(--r-pill); background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.ab.on { border-color: var(--brand); background: var(--brand-tint); color: var(--ink); }
.ab-r { font-weight: 800; color: var(--brand); }
.ab.nuevo { border-style: dashed; }
.ini { padding: 16px 18px; }
.ini-t { display: flex; align-items: center; gap: 7px; margin: 0 0 14px; font-size: 16px; font-weight: 800; color: var(--ink); }
.ini-t > svg { color: var(--brand); }
.cancelar-ini { margin-top: 10px; }
.hist-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 6px; flex-wrap: wrap; }
.hist-t { margin: 0; font-size: 15px; font-weight: 800; color: var(--ink); }
.vacio { padding: 16px; margin: 0; text-align: center; color: var(--muted); font-size: 13px; }
.hist { list-style: none; margin: 0; padding: 0 8px 10px; }
.hist-fila { width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 8px; border: none; border-bottom: 1px solid var(--border); background: none; text-align: left; cursor: pointer; font-size: 13px; color: var(--ink-2); }
.hist-fila:hover { background: var(--surface-2); }
.hist-camion { flex: 1 1 200px; color: var(--ink); }
.hist-dato { color: var(--muted); font-size: 12.5px; }
.hist-nov { padding: 2px 8px; border-radius: var(--r-pill); font-size: 11px; font-weight: 700; color: var(--u-aviso); background: var(--u-aviso-tint); }
.hist-det { padding: 10px 8px 14px 32px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.desc { margin: 0; font-size: 12px; color: var(--muted); }
.tabla-c { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tabla-c th { text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--muted); padding: 7px 9px; border-bottom: 1px solid var(--border-strong); background: var(--surface-2); white-space: nowrap; }
.tabla-c td { padding: 7px 9px; border-bottom: 1px solid var(--border); color: var(--ink-2); }
.tabla-c .num { text-align: right; }
.ov { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal-ed { width: 100%; max-width: 640px; max-height: calc(100vh - 36px); overflow: auto; padding: 20px; }
@media (max-width: 720px) { .hero-title { font-size: 24px; } .hist-det { padding-left: 8px; } .hist-det { overflow-x: auto; } }
</style>
