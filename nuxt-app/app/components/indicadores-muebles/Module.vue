<script setup lang="ts">
// Indicadores Muebles — los números del área.
//
// Reutiliza las piezas del módulo de Indicadores (Tarjeta, BarrasH, Tabla), que
// Nuxt auto-importa globalmente. Lo que NO reutiliza es su motor de cálculo:
// aquel gira sobre un `TipoTarea` cerrado de cinco valores, triplicado y con sus
// propios guards, y meter picking/inspección ahí obligaría a tocar todo lo de
// montacargas. Ver mueblesIndicadoresCalc.ts.
import { computed, onMounted, ref, watch } from 'vue'
import { ChartColumnIncreasing, RefreshCw, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { canSeeModule } from '~/utils/modulePermissions'
import { API_INDICADORES_MUEBLES, fmtM3, mensajeError } from '~/utils/muebles'
import { PRESETS_RANGO, rangoDePreset, type BarraH, type ColumnaTabla, type PresetRango } from '~/utils/indicadores'
import { hoyBogota } from '~/utils/exportaciones'

interface FilaOperario {
  id: string; nombre: string; plus: number; minutosPicking: number
  promedioPluMin: number | null; desplazamientoPromedioSeg: number | null
  desplazamientoTotalMin: number; m3: number; kg: number
}
interface FilaInspector {
  id: string; nombre: string; plus: number; minutosInspeccion: number
  promedioPluMin: number | null; enviadosEbanisteria: number
}
interface FilaGrupo {
  clave: string; etiqueta: string; plus: number
  promedioPickingMin: number | null; promedioInspeccionMin: number | null; m3: number
}
interface Datos {
  resumen: {
    plusPickeados: number; minutosPicking: number; minutosInspeccion: number
    m3: number; kg: number
    desplazamientoPromedioSeg: number | null; desplazamientoPorcentaje: number | null
    ordenesEntregadas: number; leadTimePromedioMin: number | null
  }
  operarios: FilaOperario[]
  inspectores: FilaInspector[]
  porDescripcion: FilaGrupo[]
  porVolumen: FilaGrupo[]
  porPeso: FilaGrupo[]
  ebanisteria: {
    enviados: number; enTallerAhora: number
    promedioEsperaMin: number | null; maximoEsperaMin: number | null
    motivos: Array<{ motivo: string; veces: number }>
  }
  ordenes: Array<{
    id: string; codigo: string
    pickingMin: number | null; inspeccionMin: number | null; totalMin: number | null
    leadTimeMin: number | null
  }>
}

const { show } = useToast()
const { me } = useSessionState()
const puedeVer = computed(() => canSeeModule(me.value?.role, 'indicadores-muebles'))

const hoy = hoyBogota()
type Preset = Exclude<PresetRango, 'custom'>
const preset = ref<Preset>('7d')
const desde = ref(rangoDePreset('7d', hoy).desde)
const hasta = ref(hoy)
const operarioId = ref('')

const datos = ref<Datos | null>(null)
const equipo = ref<Array<{ id: string; nombre: string }>>([])
const cargando = ref(false)

function aplicarPreset(p: Preset) {
  preset.value = p
  const r = rangoDePreset(p, hoy)
  desde.value = r.desde
  hasta.value = r.hasta
}

async function cargar() {
  if (!desde.value || !hasta.value) return
  cargando.value = true
  try {
    const res = await $fetch<{ data: Datos; equipo: Array<{ id: string; nombre: string }> }>(
      API_INDICADORES_MUEBLES,
      { query: { desde: desde.value, hasta: hasta.value, operarioId: operarioId.value || undefined } },
    )
    datos.value = res.data
    equipo.value = res.equipo
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar los indicadores'), true)
  } finally {
    cargando.value = false
  }
}

onMounted(ensureSession)
watch(puedeVer, (v) => { if (v && !datos.value) cargar() }, { immediate: true })
watch([desde, hasta, operarioId], () => { if (puedeVer.value) cargar() })

// ── Formato ──
// Los tiempos llegan en minutos con decimales. Un picking de segundos se ve en
// segundos y uno corto en minutos: "0.0 h" hacia creer que no se contaba nada.
const horas = (min: number) => (min < 1 ? `${Math.round(min * 60)} s` : min < 60 ? `${Math.round(min)} min` : `${(min / 60).toFixed(1)} h`)
const min1 = (v: number | null) => (v == null ? '—' : horas(v))
const seg = (v: number | null) => (v == null ? '—' : `${Math.round(v)} s`)

const tiles = computed(() => {
  const r = datos.value?.resumen
  if (!r) return []
  return [
    { label: 'PLUs pickeados', valor: String(r.plusPickeados) },
    { label: 'Tiempo de picking', valor: horas(r.minutosPicking) },
    { label: 'Tiempo de inspección', valor: horas(r.minutosInspeccion) },
    { label: 'Volumen movido', valor: fmtM3(r.m3) },
    // Lead time: lo que espera el cliente, de abrir el picking a subir al camion.
    { label: 'Lead time promedio', valor: horas(r.leadTimePromedioMin ?? 0) },
    { label: 'Órdenes entregadas', valor: String(r.ordenesEntregadas ?? 0) },
  ]
})

const colsOperario: ColumnaTabla[] = [
  { key: 'nombre', label: 'Operario' },
  { key: 'plus', label: 'PLUs', num: true },
  { key: 'tiempo', label: 'Picking', num: true },
  { key: 'promedio', label: 'Prom. PLU', num: true },
  { key: 'despl', label: 'Desplaz.', num: true },
  { key: 'm3', label: 'Volumen', num: true },
]
const filasOperario = computed(() => (datos.value?.operarios ?? []).map((o) => ({
  nombre: o.nombre,
  plus: String(o.plus),
  tiempo: horas(o.minutosPicking),
  promedio: min1(o.promedioPluMin),
  despl: seg(o.desplazamientoPromedioSeg),
  m3: fmtM3(o.m3),
})))

const colsInspector: ColumnaTabla[] = [
  { key: 'nombre', label: 'Inspector' },
  { key: 'plus', label: 'PLUs', num: true },
  { key: 'tiempo', label: 'Inspección', num: true },
  { key: 'promedio', label: 'Prom. PLU', num: true },
  { key: 'eban', label: 'A ebanistería', num: true },
]
const filasInspector = computed(() => (datos.value?.inspectores ?? []).map((i) => ({
  nombre: i.nombre,
  plus: String(i.plus),
  tiempo: horas(i.minutosInspeccion),
  promedio: min1(i.promedioPluMin),
  eban: String(i.enviadosEbanisteria),
})))

const colsGrupo: ColumnaTabla[] = [
  { key: 'etiqueta', label: 'Grupo' },
  { key: 'plus', label: 'PLUs', num: true },
  { key: 'picking', label: 'Prom. picking', num: true },
  { key: 'inspeccion', label: 'Prom. inspección', num: true },
]
const filasDe = (g: FilaGrupo[]) => g.map((f) => ({
  etiqueta: f.etiqueta,
  plus: String(f.plus),
  picking: min1(f.promedioPickingMin),
  inspeccion: min1(f.promedioInspeccionMin),
}))

const barrasDe = (g: FilaGrupo[], etiqueta?: (c: string) => string): BarraH[] => g
  .filter((f) => f.promedioPickingMin != null)
  .map((f) => ({
    id: f.clave,
    etiqueta: etiqueta ? etiqueta(f.clave) : f.etiqueta,
    valor: f.promedioPickingMin!,
    texto: `${f.promedioPickingMin} min`,
    filas: [{ etiqueta: 'PLUs', valor: String(f.plus) }],
  }))
const ejeMin = (v: number) => `${Math.round(v)} min`

// Por descripcion exacta pueden salir cientos de productos: el grafico muestra
// los mas pickeados y la tabla trae todos, con buscador.
const TOP_DESCRIPCION = 10
const buscaDescripcion = ref('')
const normaliza = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const descripcionesFiltradas = computed(() => {
  const q = normaliza(buscaDescripcion.value.trim())
  const todas = datos.value?.porDescripcion ?? []
  return q ? todas.filter((f) => normaliza(f.etiqueta).includes(q)) : todas
})
const colsDescripcion: ColumnaTabla[] = [
  { key: 'etiqueta', label: 'Descripción' },
  { key: 'plus', label: 'PLUs', num: true },
  { key: 'picking', label: 'Prom. picking', num: true },
  { key: 'inspeccion', label: 'Prom. inspección', num: true },
]

const colsOrden: ColumnaTabla[] = [
  { key: 'codigo', label: 'Orden' },
  { key: 'picking', label: 'Picking', num: true },
  { key: 'inspeccion', label: 'Inspección', num: true },
  { key: 'total', label: 'Total', num: true },
  { key: 'lead', label: 'Lead time', num: true },
]
const filasOrden = computed(() => (datos.value?.ordenes ?? []).slice(0, 40).map((o) => ({
  codigo: o.codigo,
  picking: min1(o.pickingMin),
  inspeccion: min1(o.inspeccionMin),
  total: min1(o.totalMin),
  lead: o.leadTimeMin == null ? '—' : min1(o.leadTimeMin),
})))
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><ChartColumnIncreasing :size="13" /></span>
          CEDI · Muebles
        </span>
        <h1 class="hero-title">Indicadores Muebles</h1>
        <p class="hero-desc">Tiempos por persona, tipo de mercancía, volumen y peso.</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="cargando" @click="cargar">
        <RefreshCw :size="14" /> Actualizar
      </button>
    </section>

    <p v-if="!puedeVer" class="vacio">Estos indicadores son para supervisión del área.</p>

    <template v-else>
      <section class="filtros">
        <div class="presets">
          <button
            v-for="p in PRESETS_RANGO" :key="p.key" class="chip"
            :class="{ on: preset === p.key }" @click="aplicarPreset(p.key)"
          >{{ p.label }}</button>
        </div>
        <label class="campo"><span>Desde</span><input v-model="desde" class="input" type="date"></label>
        <label class="campo"><span>Hasta</span><input v-model="hasta" class="input" type="date"></label>
        <label class="campo">
          <span>Operario</span>
          <select v-model="operarioId" class="input">
            <option value="">Todos</option>
            <option v-for="o in equipo" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          </select>
        </label>
      </section>

      <div v-if="cargando && !datos" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

      <template v-else-if="datos">
        <div class="tiles">
          <div v-for="t in tiles" :key="t.label" class="tile">
            <span class="tile-num mono tnum">{{ t.valor }}</span>
            <span class="tile-label">{{ t.label }}</span>
          </div>
        </div>

        <!-- Desplazamiento: el tiempo que no está en ningún reloj pero que el
             operario sí gasta. Verlo junto al de picking es lo que le da sentido. -->
        <IndicadoresTarjeta
          class="bloque" titulo="Tiempo por operario"
          :subtitulo="`Desplazamiento entre PLUs: ${seg(datos.resumen.desplazamientoPromedioSeg)} de promedio, ${datos.resumen.desplazamientoPorcentaje ?? 0}% del tiempo en la jugada`"
        >
          <IndicadoresTabla :columnas="colsOperario" :filas="filasOperario" principal="nombre" />
        </IndicadoresTarjeta>

        <IndicadoresTarjeta class="bloque" titulo="Tiempo de inspección por inspector">
          <IndicadoresTabla :columnas="colsInspector" :filas="filasInspector" principal="nombre" />
        </IndicadoresTarjeta>

        <IndicadoresTarjeta
          class="bloque" titulo="Promedio de picking por descripción"
          :subtitulo="`${datos.porDescripcion.length} productos distintos · el gráfico muestra los ${TOP_DESCRIPCION} más pickeados`"
        >
          <IndicadoresBarrasH
            :items="barrasDe(datos.porDescripcion.slice(0, TOP_DESCRIPCION))" medida="min por PLU" :formato-eje="ejeMin"
          />
          <template #tabla>
            <label class="busca">
              <span class="sr-only">Buscar descripción</span>
              <input v-model="buscaDescripcion" class="busca-input" type="search" placeholder="Buscar producto…">
            </label>
            <IndicadoresTabla
              :columnas="colsDescripcion"
              :filas="filasDe(descripcionesFiltradas)"
              principal="etiqueta"
            />
          </template>
        </IndicadoresTarjeta>

        <div class="dos bloque">
          <IndicadoresTarjeta titulo="Por tamaño del producto" subtitulo="Agrupado por volumen">
            <IndicadoresBarrasH :items="barrasDe(datos.porVolumen)" medida="min por PLU" :formato-eje="ejeMin" />
            <template #tabla>
              <IndicadoresTabla :columnas="colsGrupo" :filas="filasDe(datos.porVolumen)" principal="etiqueta" />
            </template>
          </IndicadoresTarjeta>

          <IndicadoresTarjeta titulo="Por peso del producto" subtitulo="Agrupado por kilos">
            <IndicadoresBarrasH :items="barrasDe(datos.porPeso)" medida="min por PLU" :formato-eje="ejeMin" />
            <template #tabla>
              <IndicadoresTabla :columnas="colsGrupo" :filas="filasDe(datos.porPeso)" principal="etiqueta" />
            </template>
          </IndicadoresTarjeta>
        </div>

        <IndicadoresTarjeta
          class="bloque" titulo="Ebanistería"
          :subtitulo="`${datos.ebanisteria.enviados} enviados · ${datos.ebanisteria.enTallerAhora} en el taller ahora`"
        >
          <div class="eban">
            <div class="eban-cifras">
              <div><strong class="mono tnum">{{ min1(datos.ebanisteria.promedioEsperaMin) }}</strong><span>espera promedio</span></div>
              <div><strong class="mono tnum">{{ min1(datos.ebanisteria.maximoEsperaMin) }}</strong><span>la más larga</span></div>
            </div>
            <ul v-if="datos.ebanisteria.motivos.length" class="eban-motivos">
              <li v-for="m in datos.ebanisteria.motivos" :key="m.motivo">
                <span class="eban-veces">{{ m.veces }}×</span> {{ m.motivo }}
              </li>
            </ul>
            <p v-else class="eban-vacio">Sin envíos a ebanistería en el periodo.</p>
          </div>
        </IndicadoresTarjeta>

        <IndicadoresTarjeta
          class="bloque" titulo="Órdenes completas"
          :subtitulo="`Lead time: de abrir el picking a entregar a transporte · promedio ${horas(datos.resumen.leadTimePromedioMin ?? 0)} en ${datos.resumen.ordenesEntregadas ?? 0} órdenes entregadas`"
        >
          <IndicadoresTabla :columnas="colsOrden" :filas="filasOrden" principal="codigo" />
        </IndicadoresTarjeta>
      </template>
    </template>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 20px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }

.filtros { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; padding: 14px 16px; margin-bottom: 18px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.presets { display: flex; gap: 5px; flex-wrap: wrap; }
.chip { padding: 6px 12px; border-radius: var(--r-pill); border: 1px solid var(--border-strong); background: var(--surface); font-size: 12px; font-weight: 600; color: var(--muted); cursor: pointer; }
.chip.on { color: var(--brand); border-color: var(--brand); background: var(--brand-tint); }
.campo { display: flex; flex-direction: column; gap: 4px; }
.campo span { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.tile { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.tile-num { font-size: 22px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
.tile-label { font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }

.bloque { margin-bottom: 18px; }
.dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; }

.eban { display: flex; gap: 26px; flex-wrap: wrap; }
.eban-cifras { display: flex; gap: 22px; }
.eban-cifras div { display: flex; flex-direction: column; }
.eban-cifras strong { font-size: 20px; font-weight: 800; color: var(--u-aviso); }
.eban-cifras span { font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.eban-motivos { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: var(--ink-2); }
.eban-veces { font-weight: 800; color: var(--u-aviso); margin-right: 6px; }
.eban-vacio { margin: 0; font-size: 12.5px; color: var(--muted); }

.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 720px) { .hero-title { font-size: 24px; } }
.busca { display: block; margin: 12px 18px 10px; }
.busca-input { width: 100%; max-width: 320px; padding: 8px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
