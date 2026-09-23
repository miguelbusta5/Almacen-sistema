<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
// Indicadores Muebles — los números del área.
//
// Reutiliza las piezas del módulo de Indicadores (Tarjeta, BarrasH, Tabla), que
// Nuxt auto-importa globalmente. Lo que NO reutiliza es su motor de cálculo:
// aquel gira sobre un `TipoTarea` cerrado de cinco valores, triplicado y con sus
// propios guards, y meter picking/inspección ahí obligaría a tocar todo lo de
// montacargas. Ver mueblesIndicadoresCalc.ts.
import { computed, onMounted, ref, watch } from 'vue'
import { ChartColumnIncreasing, RefreshCw, Loader2, LayoutList, ChartPie, ClipboardCheck, Download } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { canSeeModule } from '~/utils/modulePermissions'
import { API_INDICADORES_MUEBLES, TIPO_ERROR_PICKING_LABEL, fmtM3, mensajeError } from '~/utils/muebles'
import { PRESETS_RANGO, rangoDePreset, type BarraH, type ColumnaTabla, type PresetRango } from '~/utils/indicadores'
import { hoyBogota } from '~/utils/exportaciones'
import { API_ANALITICA_MUEBLES, type AnaliticaMueblesDTO } from '~/utils/mueblesAnalitica'
import { exportarExcel, type HojaExcel } from '~/utils/exportarExcel'
import { fmtDuracion, type ProcesoDTO } from '~/utils/procesos'

interface ProcesosMuebles {
  rango: { desde: string; hasta: string }
  anterior: { desde: string; hasta: string }
  metaVentana: { desde: string; hasta: string }
  operarios: Array<{ id: string; nombre: string }>
  inspectores: Array<{ id: string; nombre: string }>
  picking: ProcesoDTO
  inspeccion: ProcesoDTO
  ebanisteria: {
    enviados: number; enTaller: number; esperaMin: number | null
    porPlu: Array<{ plu: string; descripcion: string | null; proveedor: string; veces: number; enTaller: number; esperaMin: number; motivos: string[] }>
    porProveedor: Array<{ proveedor: string; veces: number; plus: number; esperaMin: number }>
  }
}

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
interface ErroresPicking {
  total: number
  ordenesConError: number
  porcentajeOrdenes: number | null
  porOperario: Array<{ id: string; nombre: string; errores: number; plus: number; porcentaje: number | null }>
  porTipo: Array<{ tipo: string; cantidad: number }>
  detalle: Array<{
    ordenId: string; codigoOrden: string; plu: string; descripcion: string | null
    operarioNombre: string; tipo: string; nota: string | null; marcadoPorNombre: string; fecha: string
  }>
}
const errores = ref<ErroresPicking | null>(null)

interface Datos {
  comparacionEquipos: Array<{ tipo: string; ordenes: number; plus: number; unidades: number; minutos: number; unidadesHora: number | null }>
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
const inspectorId = ref('')
const procesos = ref<ProcesosMuebles | null>(null)

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
  // Un refresco automatico no pone el esqueleto: la pantalla no parpadea.
  if (!enRefrescoSilencioso()) cargando.value = true
  // El operario filtra el picking; el inspector, la inspeccion. Cada pestana
  // manda solo el suyo: el tiempo por descripcion sale del que se esta mirando.
  const filtro = {
    operarioId: pestana.value === 'picking' ? operarioId.value || undefined : undefined,
    inspectorId: pestana.value === 'inspeccion' ? inspectorId.value || undefined : undefined,
  }
  try {
    const [res, pr] = await Promise.all([
      $fetch<{ data: Datos; equipo: Array<{ id: string; nombre: string }>; erroresPicking?: ErroresPicking }>(
        API_INDICADORES_MUEBLES,
        { query: { desde: desde.value, hasta: hasta.value, ...filtro } },
      ),
      $fetch<ProcesosMuebles>(`${API_INDICADORES_MUEBLES}/procesos`, {
        query: { desde: desde.value, hasta: hasta.value, operarioId: operarioId.value || undefined, inspectorId: inspectorId.value || undefined },
      }),
    ])
    datos.value = res.data
    procesos.value = pr
    errores.value = res.erroresPicking ?? null
    equipo.value = res.equipo
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar los indicadores'), true)
  } finally {
    cargando.value = false
  }
}

// ── Analítica ──
// Pestaña aparte con su propio endpoint: no se pide hasta que se abre, y no
// depende del filtro de operario (mira el proceso entero).
// Picking | Inspeccion | Ordenes (23-09): un proceso por pestana.
const pestana = ref<'picking' | 'inspeccion' | 'ordenes'>('picking')
const analitica = ref<AnaliticaMueblesDTO | null>(null)
const analiticaDe = ref('')
const cargandoAnalitica = ref(false)
/** Plantilla con la que se proyecta; null = la real (la pone el servidor). */
const plantilla = ref<{ operarios: number; inspectores: number } | null>(null)

async function cargarAnalitica() {
  if (!desde.value || !hasta.value) return
  if (!enRefrescoSilencioso()) cargandoAnalitica.value = true
  try {
    const res = await $fetch<{ data: AnaliticaMueblesDTO }>(API_ANALITICA_MUEBLES, {
      query: { desde: desde.value, hasta: hasta.value, ...(plantilla.value ?? {}) },
    })
    analitica.value = res.data
    analiticaDe.value = `${desde.value}|${hasta.value}`
  } catch (e) {
    show(mensajeError(e, 'No se pudo cargar la analítica'), true)
  } finally {
    cargandoAnalitica.value = false
  }
}

/** Recarga solo lo que se está viendo. */
function refrescar() {
  return pestana.value === 'ordenes' ? cargarAnalitica() : cargar()
}

onMounted(ensureSession)
watch(puedeVer, (v) => { if (v && !datos.value) cargar() }, { immediate: true })
watch([desde, hasta, operarioId, inspectorId], () => { if (puedeVer.value) refrescar() })
watch(pestana, (v) => {
  if (v === 'ordenes') {
    if (analiticaDe.value !== `${desde.value}|${hasta.value}`) cargarAnalitica()
  } else {
    // El tiempo por descripcion depende del filtro de la pestana.
    cargar()
  }
})

// ── Formato ──
// Los tiempos llegan en minutos con decimales. Un picking de segundos se ve en
// segundos y uno corto en minutos: "0.0 h" hacia creer que no se contaba nada.
const horas = (min: number) => (min < 1 ? `${Math.round(min * 60)} s` : min < 60 ? `${Math.round(min)} min` : `${(min / 60).toFixed(1)} h`)
const min1 = (v: number | null) => (v == null ? '—' : horas(v))
const seg = (v: number | null) => (v == null ? '—' : `${Math.round(v)} s`)

// ── Errores de picking ──
const etiquetaError = (t: string) => TIPO_ERROR_PICKING_LABEL[t] ?? t
const ejeEntero = (v: number) => String(Math.round(v))
const colsErrOperario: ColumnaTabla[] = [
  { key: 'nombre', label: 'Operario' },
  { key: 'errores', label: 'Errores', num: true },
  { key: 'plus', label: 'PLUs pickeados', num: true },
  { key: 'porcentaje', label: '% de error', num: true },
]
const filasErrOperario = computed(() => (errores.value?.porOperario ?? []).map((o) => ({
  nombre: o.nombre,
  errores: String(o.errores),
  plus: String(o.plus),
  porcentaje: o.porcentaje == null ? '—' : `${o.porcentaje}%`,
})))
const colsErrTipo: ColumnaTabla[] = [
  { key: 'etiqueta', label: 'Tipo de error' },
  { key: 'cantidad', label: 'Cantidad', num: true },
]
const filasErrTipo = computed(() => (errores.value?.porTipo ?? []).map((t) => ({
  etiqueta: etiquetaError(t.tipo),
  cantidad: String(t.cantidad),
})))
const barrasErrTipo = computed<BarraH[]>(() => (errores.value?.porTipo ?? []).map((t) => ({
  id: t.tipo,
  etiqueta: etiquetaError(t.tipo),
  valor: t.cantidad,
  texto: String(t.cantidad),
})))
const colsErrDetalle: ColumnaTabla[] = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'orden', label: 'Orden' },
  { key: 'plu', label: 'PLU' },
  { key: 'operario', label: 'Operario' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'nota', label: 'Nota' },
  { key: 'marco', label: 'Lo marcó' },
]
const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
const filasErrDetalle = computed(() => (errores.value?.detalle ?? []).map((e) => ({
  fecha: fechaCorta(e.fecha),
  orden: e.codigoOrden,
  plu: e.descripcion ? `${e.plu} · ${e.descripcion}` : e.plu,
  operario: e.operarioNombre,
  tipo: etiquetaError(e.tipo),
  nota: e.nota ?? '—',
  marco: e.marcadoPorNombre,
})))

// ── Genie / Order Picker ──
const EQUIPO_LABEL: Record<string, string> = { GENIE: 'Genie', ORDER_PICKER: 'Order Picker' }
const colsEquipos: ColumnaTabla[] = [
  { key: 'equipo', label: 'Equipo' },
  { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'plus', label: 'PLU distintos', num: true },
  { key: 'unidades', label: 'Unidades', num: true },
  { key: 'minutos', label: 'Minutos efectivos', num: true },
  { key: 'unidadesHora', label: 'Unidades / hora', num: true },
]
const filasEquipos = computed(() => (datos.value?.comparacionEquipos ?? []).map((e) => ({
  equipo: EQUIPO_LABEL[e.tipo] ?? e.tipo,
  ordenes: String(e.ordenes),
  plus: String(e.plus),
  unidades: String(e.unidades),
  minutos: e.minutos.toFixed(1),
  unidadesHora: e.unidadesHora?.toFixed(1) ?? '—',
})))
const barrasEquipos = computed<BarraH[]>(() => (datos.value?.comparacionEquipos ?? [])
  .filter((e) => e.unidadesHora != null)
  .map((e) => ({
    id: e.tipo,
    etiqueta: EQUIPO_LABEL[e.tipo] ?? e.tipo,
    valor: e.unidadesHora!,
    texto: `${e.unidadesHora!.toFixed(1)} und/h`,
  })))

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
const barrasInsp = (g: FilaGrupo[]): BarraH[] => g
  .filter((f) => f.promedioInspeccionMin != null)
  .map((f) => ({
    id: f.clave,
    etiqueta: f.etiqueta,
    valor: f.promedioInspeccionMin!,
    texto: `${f.promedioInspeccionMin} min`,
  }))
const porInspeccion = (g: FilaGrupo[]) => [...g].filter((f) => f.promedioInspeccionMin != null)

// ── Ebanisteria por PLU y proveedor ──
const colsEbanPlu: ColumnaTabla[] = [
  { key: 'plu', label: 'PLU' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'veces', label: 'Veces', num: true },
  { key: 'espera', label: 'Espera promedio', num: true },
  { key: 'motivos', label: 'Motivos' },
]
const filasEbanPlu = computed(() => (procesos.value?.ebanisteria.porPlu ?? []).map((e) => ({
  plu: e.plu, descripcion: e.descripcion ?? '—', proveedor: e.proveedor, veces: e.veces,
  espera: fmtDuracion(e.esperaMin), motivos: e.motivos.join(' · ') || '—',
})))
const colsEbanProv: ColumnaTabla[] = [
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'veces', label: 'Envíos', num: true },
  { key: 'plus', label: 'PLU distintos', num: true },
  { key: 'espera', label: 'Espera promedio', num: true },
]
const filasEbanProv = computed(() => (procesos.value?.ebanisteria.porProveedor ?? []).map((e) => ({
  proveedor: e.proveedor, veces: e.veces, plus: e.plus, espera: fmtDuracion(e.esperaMin),
})))
const barrasEbanPlu = computed<BarraH[]>(() => (procesos.value?.ebanisteria.porPlu ?? []).slice(0, 10).map((e) => ({
  id: e.plu,
  etiqueta: `${e.plu} · ${e.descripcion ?? ''}`,
  valor: e.veces,
  texto: `${e.veces} · ${e.proveedor}`,
  detalle: [{ etiqueta: 'Espera promedio', valor: fmtDuracion(e.esperaMin) }, { etiqueta: 'Proveedor', valor: e.proveedor }],
})))

// ── Excel de la pestana abierta ──
const vistaPicking = ref<{ hojas: () => HojaExcel[] } | null>(null)
const vistaInspeccion = ref<{ hojas: () => HojaExcel[] } | null>(null)
const vistaOrdenes = ref<{ hojas: () => HojaExcel[] } | null>(null)
const exportando = ref(false)
async function exportar() {
  if (exportando.value) return
  if (pestana.value !== 'ordenes' && !datos.value) return
  exportando.value = true
  try {
    if (pestana.value === 'ordenes') {
      await exportarExcel(`indicadores-muebles-ordenes-${desde.value}_${hasta.value}`, vistaOrdenes.value?.hojas() ?? [])
      return
    }
    if (!datos.value) return
    const grupo = (nombre: string, g: FilaGrupo[]) => ({ nombre, columnas: colsGrupo, filas: filasDe(g) })
    const hojas: HojaExcel[] = pestana.value === 'picking'
      ? [
          ...(vistaPicking.value?.hojas() ?? []),
          { nombre: 'Tiempo por operario', columnas: colsOperario, filas: filasOperario.value },
          { nombre: 'Genie - Order Picker', columnas: colsEquipos, filas: filasEquipos.value },
          grupo('Picking por descripción', datos.value.porDescripcion),
          grupo('Picking por volumen', datos.value.porVolumen),
          grupo('Picking por peso', datos.value.porPeso),
          { nombre: 'Errores de picking', columnas: colsErrDetalle, filas: filasErrDetalle.value },
        ]
      : [
          ...(vistaInspeccion.value?.hojas() ?? []),
          { nombre: 'Tiempo por inspector', columnas: colsInspector, filas: filasInspector.value },
          grupo('Inspección por descripción', porInspeccion(datos.value.porDescripcion)),
          grupo('Inspección por volumen', porInspeccion(datos.value.porVolumen)),
          grupo('Inspección por peso', porInspeccion(datos.value.porPeso)),
          { nombre: 'Ebanistería por PLU', columnas: colsEbanPlu, filas: filasEbanPlu.value },
          { nombre: 'Ebanistería por proveedor', columnas: colsEbanProv, filas: filasEbanProv.value },
        ]
    await exportarExcel(`indicadores-muebles-${pestana.value}-${desde.value}_${hasta.value}`, hojas)
  } catch (e) {
    show(mensajeError(e, 'No se pudo exportar'), true)
  } finally {
    exportando.value = false
  }
}

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

// Los indicadores se ponen al dia solos; cada minuto basta (son consultas pesadas).
useAutoRefresh({ intervalMs: 60_000, onRefresh: () => refrescar() })
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><ChartColumnIncreasing :size="13" /></span>
          CEDI · Muebles
        </span>
        <h1 class="hero-title">Indicadores</h1>
        <p class="hero-desc">Picking, inspección y órdenes: por día, por persona, por producto.</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="cargando || cargandoAnalitica" @click="refrescar">
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
        <label v-if="pestana === 'picking'" class="campo">
          <span>Operario</span>
          <select v-model="operarioId" class="input">
            <option value="">Todos (general)</option>
            <option v-for="o in equipo" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          </select>
        </label>
        <label v-if="pestana === 'inspeccion'" class="campo">
          <span>Inspector</span>
          <select v-model="inspectorId" class="input">
            <option value="">Todos (general)</option>
            <option v-for="i in procesos?.inspectores ?? []" :key="i.id" :value="i.id">{{ i.nombre }}</option>
          </select>
        </label>
        <button class="btn btn-sm exportar" :disabled="(pestana === 'ordenes' ? !analitica : !datos) || exportando" @click="exportar">
          <Loader2 v-if="exportando" :size="13" class="spin" /><Download v-else :size="13" /> Exportar a Excel
        </button>
      </section>

      <nav class="tabs" role="tablist" aria-label="Proceso">
        <button
          class="tab" role="tab" :class="{ on: pestana === 'picking' }"
          :aria-selected="pestana === 'picking'" @click="pestana = 'picking'"
        >
          <LayoutList :size="14" /> Picking
        </button>
        <button
          class="tab" role="tab" :class="{ on: pestana === 'inspeccion' }"
          :aria-selected="pestana === 'inspeccion'" @click="pestana = 'inspeccion'"
        >
          <ClipboardCheck :size="14" /> Inspección
        </button>
        <button
          class="tab" role="tab" :class="{ on: pestana === 'ordenes' }"
          :aria-selected="pestana === 'ordenes'" @click="pestana = 'ordenes'"
        >
          <ChartPie :size="14" /> Órdenes
        </button>
      </nav>

      <template v-if="pestana === 'ordenes'">
        <div v-if="cargandoAnalitica && !analitica" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>
        <IndicadoresMueblesAnalitica
          v-else-if="analitica" ref="vistaOrdenes" :datos="analitica"
          @plantilla="(v) => { plantilla = v; cargarAnalitica() }"
        />
      </template>

      <div v-else-if="cargando && !datos" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

      <!-- ── Picking ── -->
      <template v-else-if="datos && procesos && pestana === 'picking'">
        <IndicadoresProcesoPlu
          ref="vistaPicking" :proceso="procesos.picking" titulo="Picking" que="PLU pickeados" titulo-top="PLU con más demanda"
        />

        <IndicadoresTarjeta
          class="bloque" titulo="Tiempo por PLU según la descripción"
          :subtitulo="`${operarioId ? equipo.find((o) => o.id === operarioId)?.nombre ?? 'Operario' : 'General'} · ${datos.porDescripcion.length} productos · el gráfico muestra los ${TOP_DESCRIPCION} más pickeados`"
        >
          <IndicadoresBarrasH
            :items="barrasDe(datos.porDescripcion.slice(0, TOP_DESCRIPCION))" medida="min por PLU" :formato-eje="ejeMin"
          />
          <template #tabla>
            <label class="busca">
              <span class="sr-only">Buscar descripción</span>
              <input v-model="buscaDescripcion" class="busca-input" type="search" placeholder="Buscar producto…">
            </label>
            <IndicadoresTabla :columnas="colsDescripcion" :filas="filasDe(descripcionesFiltradas)" principal="etiqueta" />
          </template>
        </IndicadoresTarjeta>

        <div class="dos bloque">
          <IndicadoresTarjeta titulo="Según el volumen" subtitulo="Tiempo de picking por PLU">
            <IndicadoresBarrasH :items="barrasDe(datos.porVolumen)" medida="min por PLU" :formato-eje="ejeMin" />
            <template #tabla>
              <IndicadoresTabla :columnas="colsGrupo" :filas="filasDe(datos.porVolumen)" principal="etiqueta" />
            </template>
          </IndicadoresTarjeta>
          <IndicadoresTarjeta titulo="Según el peso" subtitulo="Tiempo de picking por PLU">
            <IndicadoresBarrasH :items="barrasDe(datos.porPeso)" medida="min por PLU" :formato-eje="ejeMin" />
            <template #tabla>
              <IndicadoresTabla :columnas="colsGrupo" :filas="filasDe(datos.porPeso)" principal="etiqueta" />
            </template>
          </IndicadoresTarjeta>
        </div>

        <div class="dos bloque">
          <IndicadoresTarjeta
            titulo="Tiempo por operario"
            :subtitulo="`Desplazamiento entre PLUs: ${seg(datos.resumen.desplazamientoPromedioSeg)} de promedio, ${datos.resumen.desplazamientoPorcentaje ?? 0}% del tiempo`"
          >
            <IndicadoresTabla :columnas="colsOperario" :filas="filasOperario" principal="nombre" />
          </IndicadoresTarjeta>
          <IndicadoresTarjeta
            titulo="Genie / Order Picker"
            subtitulo="Picking terminado, descontando pausas. Una orden compartida aporta a los dos."
          >
            <IndicadoresBarrasH
              v-if="barrasEquipos.length" :items="barrasEquipos" medida="und/hora"
              :formato-eje="(v: number) => v.toFixed(0)"
            />
            <p v-else class="sin-errores">Todavía no hay picking terminado en el periodo.</p>
            <template #tabla>
              <IndicadoresTabla :columnas="colsEquipos" :filas="filasEquipos" principal="equipo" />
            </template>
          </IndicadoresTarjeta>
        </div>

        <div class="dos bloque">
          <IndicadoresTarjeta
            titulo="Errores de picking"
            :subtitulo="errores && errores.total
              ? `${errores.total} ${errores.total === 1 ? 'error' : 'errores'} en ${errores.ordenesConError} ${errores.ordenesConError === 1 ? 'orden' : 'órdenes'} · ${errores.porcentajeOrdenes ?? 0}% de las órdenes`
              : 'Sin errores de picking en el periodo'"
          >
            <IndicadoresTabla v-if="errores && errores.total" :columnas="colsErrOperario" :filas="filasErrOperario" principal="nombre" />
            <p v-else class="sin-errores">Ningún PLU marcado con error de picking.</p>
            <template #tabla>
              <IndicadoresTabla :columnas="colsErrDetalle" :filas="filasErrDetalle" principal="orden" />
            </template>
          </IndicadoresTarjeta>
          <IndicadoresTarjeta v-if="errores && errores.total" titulo="Errores por tipo">
            <IndicadoresBarrasH :items="barrasErrTipo" medida="errores" :formato-eje="ejeEntero" />
            <template #tabla>
              <IndicadoresTabla :columnas="colsErrTipo" :filas="filasErrTipo" principal="etiqueta" />
            </template>
          </IndicadoresTarjeta>
        </div>
      </template>

      <!-- ── Inspección ── -->
      <template v-else-if="datos && procesos && pestana === 'inspeccion'">
        <IndicadoresProcesoPlu
          ref="vistaInspeccion" :proceso="procesos.inspeccion" titulo="Inspección" que="PLU inspeccionados"
          persona="inspector" titulo-top="PLU más inspeccionados"
        />

        <IndicadoresTarjeta
          class="bloque" titulo="Tiempo por PLU según la descripción"
          :subtitulo="`${inspectorId ? procesos.inspectores.find((i) => i.id === inspectorId)?.nombre ?? 'Inspector' : 'General'} · tiempo de inspección por PLU (sin taller ni almuerzo)`"
        >
          <IndicadoresBarrasH
            :items="barrasInsp(porInspeccion(datos.porDescripcion).slice(0, TOP_DESCRIPCION))" medida="min por PLU" :formato-eje="ejeMin"
          />
          <template #tabla>
            <IndicadoresTabla :columnas="colsDescripcion" :filas="filasDe(porInspeccion(datos.porDescripcion))" principal="etiqueta" />
          </template>
        </IndicadoresTarjeta>

        <div class="dos bloque">
          <IndicadoresTarjeta titulo="Según el volumen" subtitulo="Tiempo de inspección por PLU">
            <IndicadoresBarrasH :items="barrasInsp(datos.porVolumen)" medida="min por PLU" :formato-eje="ejeMin" />
            <template #tabla>
              <IndicadoresTabla :columnas="colsGrupo" :filas="filasDe(porInspeccion(datos.porVolumen))" principal="etiqueta" />
            </template>
          </IndicadoresTarjeta>
          <IndicadoresTarjeta titulo="Según el peso" subtitulo="Tiempo de inspección por PLU">
            <IndicadoresBarrasH :items="barrasInsp(datos.porPeso)" medida="min por PLU" :formato-eje="ejeMin" />
            <template #tabla>
              <IndicadoresTabla :columnas="colsGrupo" :filas="filasDe(porInspeccion(datos.porPeso))" principal="etiqueta" />
            </template>
          </IndicadoresTarjeta>
        </div>

        <IndicadoresTarjeta class="bloque" titulo="Tiempo de inspección por inspector">
          <IndicadoresTabla :columnas="colsInspector" :filas="filasInspector" principal="nombre" />
        </IndicadoresTarjeta>

        <IndicadoresTarjeta
          class="bloque" titulo="Ebanistería: PLU que más van al taller"
          :subtitulo="`${procesos.ebanisteria.enviados} envíos · ${procesos.ebanisteria.enTaller} en el taller ahora · espera promedio ${fmtDuracion(procesos.ebanisteria.esperaMin)}. El proveedor es el fabricante del maestro.`"
        >
          <IndicadoresBarrasH
            v-if="barrasEbanPlu.length" :items="barrasEbanPlu" medida="envíos"
            :formato-eje="ejeEntero" :reserva="190" :ancho-etiqueta="240"
          />
          <p v-else class="sin-errores">Sin envíos a ebanistería en el periodo.</p>
          <template #tabla>
            <IndicadoresTabla :columnas="colsEbanPlu" :filas="filasEbanPlu" principal="plu" />
          </template>
        </IndicadoresTarjeta>

        <div class="dos bloque">
          <IndicadoresTarjeta titulo="Ebanistería por proveedor" subtitulo="Envíos y espera promedio en el taller.">
            <IndicadoresTabla :columnas="colsEbanProv" :filas="filasEbanProv" principal="proveedor" />
          </IndicadoresTarjeta>
          <IndicadoresTarjeta titulo="Motivos de ebanistería" :subtitulo="`La espera más larga: ${min1(datos.ebanisteria.maximoEsperaMin)}`">
            <ul v-if="datos.ebanisteria.motivos.length" class="eban-motivos">
              <li v-for="m in datos.ebanisteria.motivos" :key="m.motivo">
                <span class="eban-veces">{{ m.veces }}×</span> {{ m.motivo }}
              </li>
            </ul>
            <p v-else class="eban-vacio">Sin envíos a ebanistería en el periodo.</p>
          </IndicadoresTarjeta>
        </div>
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
.exportar { margin-left: auto; }
.campo span { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.tile { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.tile-num { font-size: 22px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
.tile-label { font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }

.bloque { margin-bottom: 18px; }

.tabs { display: flex; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--border); }
.tab {
  appearance: none; border: none; background: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 15px; font-size: 13px; font-weight: 600; color: var(--muted);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab:hover { color: var(--ink-2); }
.tab.on { color: var(--brand); border-bottom-color: var(--brand); }
.tab:focus-visible { outline: none; box-shadow: var(--ring); border-radius: var(--r-xs); }
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
.sin-errores { margin: 0; padding: 14px 0 4px; font-size: 13px; color: var(--muted); }
</style>
