<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
// Historial de órdenes de Muebles: buscar cualquier orden y ver cómo quedaron
// sus tiempos, PLU por PLU. El administrador además puede corregir lo que se
// escaneó mal (con motivo, y queda en Auditoría).
import { computed, onMounted, ref } from 'vue'
import { History, RefreshCw, Loader2, Search, MapPin } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ensureSession } from '~/composables/useSession'
import { ESTADO_ORDEN_LABEL, fmtKg, fmtM3, fmtMin, mensajeError, type EstadoOrden, type Orden } from '~/utils/muebles'
import { hoyBogota } from '~/utils/exportaciones'

const API = '/api/historial-muebles'
const { show } = useToast()

const ordenes = ref<Orden[]>([])
const puedeCorregir = ref(false)
const cargando = ref(true)

const desde = ref(hoyBogota())
const hasta = ref(hoyBogota())
const codigo = ref('')
const estado = ref<EstadoOrden | ''>('')
const ciudad = ref('')
const operario = ref('')

const abierta = ref<string | null>(null)

onMounted(() => {
  ensureSession()
  cargar()
})

async function cargar() {
  // Un refresco automatico no pone el esqueleto: la pantalla no parpadea.
  if (!enRefrescoSilencioso()) cargando.value = true
  try {
    const res = await $fetch<{ data: Orden[]; puedeCorregir: boolean }>(API, {
      query: {
        desde: desde.value, hasta: hasta.value,
        ...(codigo.value.trim() ? { codigo: codigo.value.trim() } : {}),
        ...(estado.value ? { estado: estado.value } : {}),
        ...(ciudad.value ? { ciudad: ciudad.value } : {}),
      },
    })
    ordenes.value = res.data
    puedeCorregir.value = res.puedeCorregir
  } catch (e) {
    show(mensajeError(e, 'No se pudo cargar el historial'), true)
  } finally {
    cargando.value = false
  }
}

// Operarios y ciudades salen de lo que trajo la búsqueda: nunca ofrece una
// opción que deje la tabla vacía.
const operarios = computed(() => [...new Map(
  ordenes.value.flatMap((o) => o.participantes.length ? o.participantes : (o.operario ? [{ id: o.operario.id, nombre: o.operario.nombre }] : []))
    .map((p) => [p.id, p.nombre] as const),
).entries()].sort((a, b) => a[1].localeCompare(b[1])))
const ciudades = computed(() => [...new Set(ordenes.value.map((o) => o.ciudadEnvio).filter((c): c is string => !!c))].sort())

const visibles = computed(() => operario.value
  ? ordenes.value.filter((o) => o.participantes.some((p) => p.id === operario.value) || o.operario?.id === operario.value)
  : ordenes.value)

const TONO: Record<EstadoOrden, string> = {
  EN_PICKING: 'var(--info)',
  EN_INSPECCION: 'var(--u-aviso)',
  INSPECCIONADA: 'var(--brand)',
  ENTREGADA_TRANSPORTE: 'var(--muted)',
}

function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

function actualizada(o: Orden) {
  ordenes.value = ordenes.value.map((x) => (x.id === o.id ? o : x))
}

// El historial se mantiene al dia mientras nadie tiene una orden abierta.
useAutoRefresh({ intervalMs: 60_000, onRefresh: () => (abierta.value ? undefined : cargar()) })
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><History :size="13" /></span>
          CEDI · Muebles
        </span>
        <h1 class="hero-title">Historial de órdenes</h1>
        <p class="hero-desc">Busca cualquier orden y mira cómo quedaron sus tiempos, PLU por PLU.</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="cargando" @click="cargar">
        <RefreshCw :size="14" /> Actualizar
      </button>
    </section>

    <form class="filtros" @submit.prevent="cargar">
      <label class="f f-codigo">
        <span class="lbl">Orden</span>
        <span class="con-icono">
          <Search :size="14" />
          <input v-model="codigo" class="field" type="search" placeholder="TSDM104350" autocomplete="off">
        </span>
      </label>
      <label class="f">
        <span class="lbl">Desde</span>
        <input v-model="desde" class="field" type="date" :disabled="!!codigo.trim()">
      </label>
      <label class="f">
        <span class="lbl">Hasta</span>
        <input v-model="hasta" class="field" type="date" :disabled="!!codigo.trim()">
      </label>
      <label class="f">
        <span class="lbl">Estado</span>
        <select v-model="estado" class="field">
          <option value="">Todos</option>
          <option v-for="(label, key) in ESTADO_ORDEN_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label class="f">
        <span class="lbl">Ciudad</span>
        <select v-model="ciudad" class="field">
          <option value="">Todas</option>
          <option v-for="c in ciudades" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="f">
        <span class="lbl">Operario</span>
        <select v-model="operario" class="field">
          <option value="">Todos</option>
          <option v-for="[id, nombre] in operarios" :key="id" :value="id">{{ nombre }}</option>
        </select>
      </label>
      <button class="btn btn-primary btn-sm buscar" type="submit" :disabled="cargando">
        <Search :size="14" /> Buscar
      </button>
    </form>
    <p v-if="codigo.trim()" class="nota">Buscando por código: se ignoran las fechas.</p>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

    <div v-else-if="visibles.length" class="tabla-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>Orden</th>
            <th>Estado</th>
            <th>Ciudad</th>
            <th>Operario</th>
            <th>Inicio</th>
            <th class="num">PLU</th>
            <th class="num">Peso</th>
            <th class="num">Volumen</th>
            <th class="num">Picking</th>
            <th class="num">Inspección</th>
            <th class="num">Lead time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in visibles" :key="o.id" class="fila" tabindex="0" @click="abierta = o.id" @keyup.enter="abierta = o.id">
            <td>
              <strong class="codigo">{{ o.codigo }}</strong>
              <span class="tipo">{{ o.tipoOrden }}</span>
            </td>
            <td><span class="estado" :style="{ '--c': TONO[o.estado] }">{{ ESTADO_ORDEN_LABEL[o.estado] }}</span></td>
            <td><span v-if="o.ciudadEnvio" class="ciudad"><MapPin :size="12" /> {{ o.ciudadEnvio }}</span><span v-else class="muted">—</span></td>
            <td>{{ o.operario?.nombre ?? '—' }}</td>
            <td class="muted">{{ fechaHora(o.horaInicio) }}</td>
            <td class="num">{{ o.resumen.total }}</td>
            <td class="num tnum">{{ fmtKg(o.volumen.kg) }}</td>
            <td class="num tnum">
              {{ fmtM3(o.volumen.m3) }}
              <span v-if="o.volumen.lineasSinMedida" class="sinmed" :title="`${o.volumen.lineasSinMedida} PLU sin medidas en el maestro`">*</span>
            </td>
            <td class="num">{{ fmtMin(o.duracionPickingMin) }}</td>
            <td class="num">{{ fmtMin(o.duracionInspeccionMin) }}</td>
            <td class="num">{{ fmtMin(o.leadTimeMin) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="vacio">No hay órdenes con esos filtros.</p>

    <HistorialMueblesOrdenDetalle
      v-if="abierta" :orden-id="abierta" :puede-corregir="puedeCorregir"
      @cerrar="abierta = null" @actualizada="actualizada"
    />
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 18px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }

.filtros { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; padding: 14px 16px; margin-bottom: 8px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.f { display: flex; flex-direction: column; gap: 4px; flex: 1 1 130px; min-width: 0; }
.f-codigo { flex: 1.5 1 180px; }
.lbl { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.field { width: 100%; padding: 8px 10px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.field:disabled { opacity: .5; }
.con-icono { position: relative; display: block; }
.con-icono > svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.con-icono .field { padding-left: 30px; }
.buscar { flex: 0 0 auto; }
.nota { margin: 0 0 12px; font-size: 12px; color: var(--muted); }

.tabla-wrap { overflow-x: auto; margin-top: 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
.tabla th { padding: 10px 12px; text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
.tabla td { padding: 11px 12px; border-bottom: 1px solid var(--border); color: var(--ink-2); white-space: nowrap; }
.tabla tr:last-child td { border-bottom: none; }
.num { text-align: right !important; font-variant-numeric: tabular-nums; }
.fila { cursor: pointer; }
.fila:hover, .fila:focus-visible { background: color-mix(in srgb, var(--brand) 5%, transparent); outline: none; }
.codigo { color: var(--ink); font-weight: 800; }
.tipo { margin-left: 7px; padding: 1px 7px; border-radius: var(--r-pill); font-size: 10px; font-weight: 800; color: var(--brand); background: var(--brand-tint); }
.estado { padding: 3px 9px; border-radius: var(--r-pill); font-size: 11px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 13%, transparent); }
.ciudad { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.muted { color: var(--muted); }

.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { margin-top: 12px; padding: 32px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
.sinmed { color: var(--u-aviso); font-weight: 800; }
</style>
