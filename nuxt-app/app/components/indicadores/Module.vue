<script setup lang="ts">
// Indicadores del CEDI: el tiempo laborado de montacarguistas y operarios,
// sacado de todas las tomas de tiempo (recepcion, movimientos, resurtido,
// pendientes y recepcion de contenedores).
//
// Sustituye a las pestañas de indicadores que tenia cada modulo. Aquellas
// sumaban los relojes de cada PLU, y con varios PLUs a la vez el mismo minuto
// se contaba dos y tres veces. Aqui el tiempo de una persona es RELOJ DE PARED:
// cada PLU conserva su tiempo en su modulo, pero a la persona se le cuenta el
// rato que tuvo trabajo en la mano, una sola vez.
import { computed, onMounted, ref, watch } from 'vue'
import { BarChart3, Moon, RefreshCw, Sun } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { canSeeModule } from '~/utils/modulePermissions'
import { fmtTiempo } from '~/utils/montacargas'
import { hoyBogota } from '~/utils/exportaciones'
import {
  API_INDICADORES, ejeDeTiempo, fmtDiaCorto, fmtHorasDecimal, fmtNumero, fmtPorcentaje,
  etiquetaNoche, MIN_SEGUNDOS_PRODUCTIVIDAD, PRESETS_NOCHE, PRESETS_RANGO, rangoDePreset, ROL_MEDIDO_LABEL,
  TIPO_TAREA_COLOR, TIPO_TAREA_LABEL, TIPOS_TAREA,
  type BarraH, type ColumnaTabla, type IndicadoresPeriodo, type Jornada, type PresetRango,
  type CargaPersona, type CierresDiaPersona, type ProyeccionPersona, type RespuestaIndicadores, type ResurtidoOperario, type TiemposMuertosPeriodo,
} from '~/utils/indicadores'
import { fmtKg, fmtM3 } from '~/utils/carga'
import { PESTANAS_PROCESO, type PestanaProceso } from '~/utils/procesos'
import { exportarExcel } from '~/utils/exportarExcel'
import { Download } from '@lucide/vue'

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()
const puedeVer = computed(() => canSeeModule(me.value?.role, 'indicadores'))

// ── Filtros: una sola fila, arriba, y mandan sobre todo lo de abajo ────
const hoy = hoyBogota()

// Turno día y turno noche se miran por separado: el de noche empieza un día y
// termina al siguiente, y mezclarlo con el de día por fechas de calendario lo
// dejaba partido a medianoche. En noche, cada fecha es la noche que empieza ese
// día y se ve entera. Se recuerda en este equipo.
const CLAVE_JORNADA = 'indicadores.jornada'
function jornadaGuardada(): Jornada {
  try { return localStorage.getItem(CLAVE_JORNADA) === 'noche' ? 'noche' : 'dia' } catch { return 'dia' }
}
const jornada = ref<Jornada>(jornadaGuardada())
const presetInicial: Exclude<PresetRango, 'custom'> = jornada.value === 'noche' ? 'anoche' : '7d'
const preset = ref<PresetRango>(presetInicial)
const desde = ref(rangoDePreset(presetInicial, hoy).desde)
const hasta = ref(rangoDePreset(presetInicial, hoy).hasta)
const presets = computed(() => (jornada.value === 'noche' ? PRESETS_NOCHE : PRESETS_RANGO))
const tituloNoche = computed(() =>
  jornada.value === 'noche' && desde.value === hasta.value ? etiquetaNoche(desde.value) : null)

function elegirJornada(j: Jornada) {
  if (jornada.value === j) return
  jornada.value = j
  try { localStorage.setItem(CLAVE_JORNADA, j) } catch { /* sin almacenamiento, no se recuerda */ }
  usuarioId.value = ''
  elegirPreset(j === 'noche' ? 'anoche' : '7d')
}
const rol = ref('')
const usuarioId = ref('')

function elegirPreset(p: Exclude<PresetRango, 'custom'>) {
  preset.value = p
  const r = rangoDePreset(p, hoyBogota())
  desde.value = r.desde
  hasta.value = r.hasta
}
function fechaEditada() { preset.value = 'custom' }

const equipo = ref<RespuestaIndicadores['equipo']>([])
const equipoDelRol = computed(() => equipo.value.filter((u) =>
  !rol.value || u.rol === rol.value))
function seleccionarPersona() {
  const persona = equipo.value.find(u => u.id === usuarioId.value)
  if (!persona) return
  jornada.value = persona.jornada ?? 'dia'
  try { localStorage.setItem(CLAVE_JORNADA, jornada.value) } catch {}
}
// Cambiar de rol con una persona del otro rol elegida la dejaria sin datos.
watch(rol, () => {
  if (usuarioId.value && !equipoDelRol.value.some((u) => u.id === usuarioId.value)) usuarioId.value = ''
})

// ── Datos ──────────────────────────────────────────────────────────
const datos = ref<IndicadoresPeriodo | null>(null)
const muertos = ref<TiemposMuertosPeriodo | null>(null)
const resurtido = ref<ResurtidoOperario[]>([])
const carga = ref<CargaPersona[]>([])
const cierresDiarios = ref<CierresDiaPersona[]>([])
const proyeccion = ref<ProyeccionPersona[]>([])
const cargando = ref(false)

// Tiempo laborado y tiempos muertos salen de la misma consulta y de los mismos
// filtros: cambiar de pestaña no recarga nada.
// Primero los procesos (lo que se hace), despues lo de las personas (23-09).
const pestana = ref<PestanaProceso | 'laborado' | 'muertos' | 'turnos' | 'pausas' | 'ubicaciones'>('recepcion')
const esProceso = computed(() => PESTANAS_PROCESO.some((x) => x.key === pestana.value))

// Excel de "Tiempo trabajado": las mismas tablas de la pantalla.
const exportando = ref(false)
async function exportarLaborado() {
  if (exportando.value || !datos.value) return
  exportando.value = true
  try {
    await exportarExcel(`indicadores-tiempo-trabajado-${desde.value}_${hasta.value}`, [
      { nombre: 'Efectividad por persona', columnas: columnasEfectividad, filas: tablaEfectividad.value },
      { nombre: 'Productividad por persona', columnas: columnasProd, filas: tablaProd.value },
      { nombre: 'Reparto por tipo', columnas: columnasReparto, filas: tablaReparto.value },
      { nombre: 'Peso y volumen', columnas: columnasCarga, filas: tablaCarga.value },
      { nombre: 'Resurtido por operario', columnas: columnasResurtido, filas: tablaResurtido.value },
      {
        nombre: 'Cierres por día',
        columnas: [
          { key: 'dia', label: 'Día' }, { key: 'nombre', label: 'Persona' },
          { key: 'tareas', label: 'Tareas', num: true }, { key: 'pendientes', label: 'Pendientes', num: true },
          { key: 'movimientos', label: 'Movimientos', num: true }, { key: 'total', label: 'Total', num: true },
          { key: 'pasadas', label: 'Iniciadas y pasadas', num: true },
        ],
        filas: cierresDiarios.value.map((c) => ({ ...c })),
      },
    ])
  } catch (e) {
    showToast(apiErr(e, 'No se pudo exportar'), true)
  } finally {
    exportando.value = false
  }
}
// El registro de pausas es solo para el administrador y quien reparte el
// trabajo (permiso por persona: Felipe Ossa y Eduardo Zurita). El servidor lo
// vuelve a comprobar.
const puedeVerPausas = computed(() => me.value?.role === 'ADMIN' || me.value?.can?.montarResurtido === true)
const porJustificar = computed(() => muertos.value?.resumen.cantidadPendientes ?? 0)

async function cargar() {
  if (!desde.value || !hasta.value) return
  cargando.value = true
  try {
    const res = await $fetch<RespuestaIndicadores>(API_INDICADORES, {
      query: {
        desde: desde.value,
        hasta: hasta.value,
        rol: rol.value || undefined,
        usuarioId: usuarioId.value || undefined,
        turno: jornada.value,
      },
    })
    datos.value = res.data
    muertos.value = res.muertos
    resurtido.value = res.resurtido ?? []
    carga.value = res.carga ?? []
    cierresDiarios.value = res.cierresDiarios ?? []
    proyeccion.value = res.proyeccion ?? []
    equipo.value = res.equipo
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los indicadores'), true)
  } finally {
    cargando.value = false
  }
}

onMounted(ensureSession)
// La sesion puede llegar despues del montaje (o ya estar cargada): se carga en
// cuanto se sabe que la persona puede verlo.
watch(puedeVer, (v) => { if (v && !datos.value) cargar() }, { immediate: true })
watch([desde, hasta, rol, usuarioId, jornada], () => { if (puedeVer.value) cargar() })

const vacio = computed(() => {
  const r = datos.value?.resumen
  return !!r && r.segundos === 0 && r.unidades === 0
})

// ── Cifras del periodo ─────────────────────────────────────────────
const resumen = computed(() => datos.value?.resumen ?? null)
const personaElegida = computed(() =>
  (datos.value?.personas ?? []).find((p) => p.id === usuarioId.value) ?? null)

// La cifra grande NUNCA es una suma de horas de varias personas: eso da mas que
// cualquier turno y no se puede leer. Con una persona elegida, su tiempo; con
// todo el equipo, la efectividad del turno, que es una proporcion.
const heroe = computed(() => {
  const r = resumen.value
  if (!r) return null
  const p = personaElegida.value
  if (p) {
    return {
      label: `Tiempo real de ${p.nombre}`,
      valor: fmtTiempo(p.segundos),
      nota: p.jornadaSegundos > 0
        ? `De ${fmtTiempo(p.jornadaSegundos)} de turno, ${fmtTiempo(p.segundosEnTurno)} con mercancía en la mano: ${p.efectividad} % de efectividad.`
        : 'Sin cuadro de turnos para estas fechas: se puede ver cuánto trabajó, pero no qué parte de su jornada fue.',
    }
  }
  if (r.jornadaSegundos > 0) {
    return {
      label: 'Efectividad del turno',
      valor: `${r.efectividad} %`,
      nota: `Del turno de las ${r.personas} personas del periodo, esa parte tuvo mercancía en la mano. Cada una por separado, abajo.`,
    }
  }
  return {
    label: 'Efectividad del turno',
    valor: 'Sin turnos',
    nota: 'Carga el cuadro de turnos en la pestaña Turnos para medir qué parte de la jornada fue trabajo registrado.',
  }
})
// Promedio por PLU del equipo: pesado por PLUs, no promedio de promedios.
const promedioEquipo = computed(() => {
  const ps = datos.value?.personas ?? []
  const n = ps.reduce((s, p) => s + p.plus, 0)
  if (!n) return null
  return Math.round(ps.reduce((s, p) => s + (p.promedioPorPlu ?? 0) * p.plus, 0) / n)
})
const tiles = computed(() => {
  const r = resumen.value
  if (!r) return []
  const p = personaElegida.value
  if (p) {
    return [
      { label: 'Unidades ubicadas', valor: fmtNumero(p.unidades), hint: 'de lo que cerró' },
      { label: 'Unidades por hora', valor: fmtNumero(p.unidadesPorHora), hint: 'sobre su tiempo real' },
      { label: 'PLUs trabajados', valor: fmtNumero(p.plus), hint: 'en el periodo' },
      { label: 'Promedio por PLU', valor: fmtTiempo(p.promedioPorPlu), hint: 'reloj de cada PLU' },
    ]
  }
  return [
    { label: 'Unidades ubicadas', valor: fmtNumero(r.unidades), hint: 'de quien cerró el PLU' },
    { label: 'Unidades por hora', valor: fmtNumero(r.unidadesPorHora), hint: 'sobre el tiempo real' },
    // PLUs distintos: uno que pasó al ayudante es un PLU, aunque lo tocaran dos.
    { label: 'PLUs trabajados', valor: fmtNumero(r.registros), hint: `entre ${r.personas} persona${r.personas !== 1 ? 's' : ''}` },
    { label: 'Promedio por PLU', valor: fmtTiempo(promedioEquipo.value), hint: 'reloj de cada PLU' },
  ]
})

// ── Evolucion dia a dia ────────────────────────────────────────────
const porDia = computed(() => datos.value?.porDia ?? [])
const puntosTiempo = computed(() => porDia.value.map((d) => ({ dia: d.dia, valor: d.segundos })))
const puntosUnidades = computed(() => porDia.value.map((d) => ({ dia: d.dia, valor: d.unidades })))
const columnasDia: ColumnaTabla[] = [
  { key: 'dia', label: 'Día' },
  { key: 'tiempo', label: 'Tiempo laborado', num: true },
  { key: 'und', label: 'Unidades', num: true },
]
const tablaDia = computed(() => porDia.value.map((d) => ({
  dia: fmtDiaCorto(d.dia), tiempo: d.segundos ? fmtTiempo(d.segundos) : '—', und: fmtNumero(d.unidades),
})))

// ── Efectividad del turno ─────────────────────────────────────────
// Tiempo de movimiento dentro del turno sobre la jornada, persona por persona.
// Quien registra el PLU despues de hacer el trabajo sale bajo, y eso es
// exactamente lo que tiene que verse.
const conTurnos = computed(() => (resumen.value?.jornadaSegundos ?? 0) > 0)
const barrasEfectividad = computed<BarraH[]>(() => (datos.value?.personas ?? [])
  .filter((p) => p.jornadaSegundos > 0)
  .sort((a, b) => (b.efectividad ?? 0) - (a.efectividad ?? 0))
  .map((p) => ({
    id: p.id,
    etiqueta: p.nombre,
    valor: p.efectividad ?? 0,
    texto: `${p.efectividad ?? 0} %`,
    detalle: [
      { etiqueta: 'de turno', valor: fmtTiempo(p.jornadaSegundos) },
      { etiqueta: 'con mercancía en la mano', valor: fmtTiempo(p.segundosEnTurno) },
      { etiqueta: 'PLUs', valor: fmtNumero(p.plus) },
    ],
  })))
// ── Resurtido por operario ──
// PLU cerrados por cada uno y su ritmo sobre el tiempo real en tareas de resurtido.
const columnasResurtido: ColumnaTabla[] = [
  { key: 'nombre', label: 'Operario' },
  { key: 'plus', label: 'PLU resurtidos', num: true },
  { key: 'porHora', label: 'PLU por hora', num: true },
  { key: 'porDia', label: 'PLU por día', num: true },
  { key: 'porPlu', label: 'Tiempo por PLU', num: true },
  { key: 'dias', label: 'Días', num: true },
  { key: 'tiempo', label: 'Tiempo en resurtido', num: true },
]
const tablaResurtido = computed(() => resurtido.value.map((r) => ({
  nombre: r.nombre,
  plus: fmtNumero(r.plus),
  porHora: r.plusPorHora == null ? '—' : fmtNumero(r.plusPorHora),
  porDia: r.plusPorDia == null ? '—' : fmtNumero(r.plusPorDia),
  porPlu: r.segundosPorPlu == null ? '—' : fmtTiempo(r.segundosPorPlu),
  dias: fmtNumero(r.dias),
  tiempo: fmtTiempo(r.segundos),
})))
const barrasResurtido = computed<BarraH[]>(() => resurtido.value
  .filter((r) => r.plusPorHora != null && r.segundos >= MIN_SEGUNDOS_PRODUCTIVIDAD)
  .map((r) => ({
    id: r.id,
    etiqueta: r.nombre,
    valor: r.plusPorHora!,
    texto: `${fmtNumero(r.plusPorHora)} PLU/h`,
  })))

// ── Peso y volumen movido ──
// Del maestro vigente: corregir una medida arregla tambien lo que ya paso.
const columnasCarga: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'kg', label: 'Peso total', num: true },
  { key: 'm3', label: 'Volumen total', num: true },
  { key: 'resurtido', label: 'Resurtido', num: true },
  { key: 'pendiente', label: 'Pendientes', num: true },
  { key: 'montacargas', label: 'Montacargas', num: true },
  { key: 'sinMedida', label: 'Sin medida', num: true },
]
const tablaCarga = computed(() => carga.value.map((c) => ({
  nombre: c.nombre,
  kg: fmtKg(c.kg),
  m3: fmtM3(c.m3),
  resurtido: fmtM3(c.porTipo.resurtido.m3),
  pendiente: fmtM3(c.porTipo.pendiente.m3),
  montacargas: fmtM3(c.porTipo.montacargas.m3),
  sinMedida: c.sinMedida ? String(c.sinMedida) : '-',
})))
const barrasCarga = computed<BarraH[]>(() => carga.value
  .filter((c) => c.m3 > 0)
  .map((c) => ({ id: c.id, etiqueta: c.nombre, valor: c.m3, texto: fmtM3(c.m3) })))
const sinMedidaTotal = computed(() => carga.value.reduce((a, c) => a + c.sinMedida, 0))

const columnasEfectividad: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'rol', label: 'Rol' },
  { key: 'jornada', label: 'Jornada del turno', num: true },
  { key: 'enTurno', label: 'Tiempo de movimiento', num: true },
  { key: 'efect', label: 'Efectividad', num: true },
  { key: 'plus', label: 'PLUs', num: true },
  { key: 'prom', label: 'Prom. por PLU', num: true },
]
const tablaEfectividad = computed(() => (datos.value?.personas ?? [])
  .filter((p) => p.jornadaSegundos > 0)
  .map((p) => ({
    nombre: p.nombre,
    rol: ROL_MEDIDO_LABEL[p.rol] ?? p.rol,
    jornada: fmtTiempo(p.jornadaSegundos),
    enTurno: fmtTiempo(p.segundosEnTurno),
    efect: `${p.efectividad ?? 0} %`,
    plus: fmtNumero(p.plus),
    prom: fmtTiempo(p.promedioPorPlu),
  })))
// Sin turno no hay con que comparar: se dice, en vez de dejar el hueco.
const sinTurno = computed(() => (datos.value?.personas ?? [])
  .filter((p) => p.jornadaSegundos === 0)
  .map((p) => p.nombre))

// ── Productividad ─────────────────────────────────────────────────
const segundosPlu = (p: IndicadoresPeriodo['personas'][number]) => p.segundos - p.porTipo.contenedor
const barrasUndHora = computed<BarraH[]>(() => (datos.value?.personas ?? [])
  .filter((p) => p.unidadesPorHora != null && segundosPlu(p) >= MIN_SEGUNDOS_PRODUCTIVIDAD)
  .sort((a, b) => (b.unidadesPorHora ?? 0) - (a.unidadesPorHora ?? 0))
  .map((p) => ({
    id: p.id,
    etiqueta: p.nombre,
    valor: p.unidadesPorHora ?? 0,
    texto: fmtNumero(p.unidadesPorHora),
    detalle: [
      { etiqueta: 'unidades', valor: fmtNumero(p.unidades) },
      { etiqueta: 'tiempo en PLUs', valor: fmtTiempo(segundosPlu(p)) },
    ],
  })))
// Quien trabajo muy poco no entra en el grafico (en la tabla si): con 36
// segundos salian 6.565 und/hora y esa barra aplastaba a todos los demas.
const pocoTiempo = computed(() => (datos.value?.personas ?? [])
  .filter((p) => p.unidades > 0 && segundosPlu(p) < MIN_SEGUNDOS_PRODUCTIVIDAD)
  .map((p) => p.nombre))

const barrasPromedio = computed<BarraH[]>(() => (datos.value?.personas ?? [])
  .filter((p) => p.promedioPorPlu != null && p.plus > 0)
  .sort((a, b) => (a.promedioPorPlu ?? 0) - (b.promedioPorPlu ?? 0))
  .map((p) => ({
    id: p.id,
    etiqueta: p.nombre,
    valor: p.promedioPorPlu ?? 0,
    texto: fmtTiempo(p.promedioPorPlu),
    detalle: [{ etiqueta: 'PLUs', valor: fmtNumero(p.plus) }],
  })))
const ejePromedio = computed(() => ejeDeTiempo(Math.max(0, ...barrasPromedio.value.map((b) => b.valor))))

const columnasProd: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'rol', label: 'Rol' },
  { key: 'und', label: 'Unidades', num: true },
  { key: 'tiempo', label: 'Tiempo en PLUs', num: true },
  { key: 'undh', label: 'Und/hora', num: true },
  { key: 'plus', label: 'PLUs', num: true },
  { key: 'prom', label: 'Prom. por PLU', num: true },
]
const tablaProd = computed(() => (datos.value?.personas ?? []).map((p) => ({
  nombre: p.nombre,
  rol: ROL_MEDIDO_LABEL[p.rol] ?? p.rol,
  und: fmtNumero(p.unidades),
  tiempo: fmtTiempo(segundosPlu(p)),
  undh: fmtNumero(p.unidadesPorHora),
  plus: fmtNumero(p.plus),
  prom: fmtTiempo(p.promedioPorPlu),
})))

// ── Reparto por tipo de tarea ─────────────────────────────────────
const totalTipos = computed(() => TIPOS_TAREA.reduce((s, t) => s + (datos.value?.porTipo[t] ?? 0), 0))
const barrasReparto = computed<BarraH[]>(() => TIPOS_TAREA
  .map((t) => ({ t, v: datos.value?.porTipo[t] ?? 0 }))
  .filter((x) => x.v > 0)
  .sort((a, b) => b.v - a.v)
  .map(({ t, v }) => ({
    id: t,
    etiqueta: TIPO_TAREA_LABEL[t],
    valor: v,
    texto: `${fmtTiempo(v)} · ${fmtPorcentaje(v, totalTipos.value)}`,
    color: TIPO_TAREA_COLOR[t],
  })))
const ejeReparto = computed(() => ejeDeTiempo(Math.max(0, ...barrasReparto.value.map((b) => b.valor))))
const columnasReparto: ColumnaTabla[] = [
  { key: 'tipo', label: 'Tipo de tarea' },
  { key: 'tiempo', label: 'Tiempo', num: true },
  { key: 'pct', label: '% del total', num: true },
]
const tablaReparto = computed(() => barrasReparto.value.map((b) => ({
  tipo: b.etiqueta, tiempo: fmtTiempo(b.valor), pct: fmtPorcentaje(b.valor, totalTipos.value),
})))

const formatoHoras = (v: number) => fmtHorasDecimal(v)
</script>

<template>
  <div class="mod">
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><BarChart3 :size="13" /></span>
          CEDI · Tiempos
        </span>
        <h1 class="hero-title">Indicadores</h1>
        <p class="hero-desc">
          Tiempo laborado de montacarguistas y operarios en todos los módulos del CEDI.
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm" :disabled="cargando" @click="cargar">
          <Spinner v-if="cargando" :size="14" /><RefreshCw v-else :size="14" />
          Actualizar
        </button>
      </div>
    </section>

    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="Los indicadores son para la supervisión de almacenamiento y la gerencia."
    />

    <template v-else>
      <!-- Filtros: una fila, arriba de todo, y lo de abajo siempre cuadra con ellos. -->
      <div class="filtros card">
        <div class="presets jornada" role="group" aria-label="Turno">
          <button
            type="button" class="preset" :class="{ on: jornada === 'dia' }" :aria-pressed="jornada === 'dia'"
            @click="elegirJornada('dia')"
          >
            <Sun :size="13" /> Turno día
          </button>
          <button
            type="button" class="preset" :class="{ on: jornada === 'noche' }" :aria-pressed="jornada === 'noche'"
            @click="elegirJornada('noche')"
          >
            <Moon :size="13" /> Turno noche
          </button>
        </div>
        <div class="presets" role="group" aria-label="Periodo">
          <button
            v-for="p in presets" :key="p.key" type="button" class="preset"
            :class="{ on: preset === p.key }" :aria-pressed="preset === p.key"
            @click="elegirPreset(p.key)"
          >
            {{ p.label }}
          </button>
        </div>
        <label class="f">
          <span class="lbl">{{ jornada === 'noche' ? 'Noche desde' : 'Desde' }}</span>
          <input v-model="desde" class="field" type="date" :max="hasta" @input="fechaEditada">
        </label>
        <label class="f">
          <span class="lbl">{{ jornada === 'noche' ? 'Noche hasta' : 'Hasta' }}</span>
          <input v-model="hasta" class="field" type="date" :min="desde" @input="fechaEditada">
        </label>
        <label class="f">
          <span class="lbl">Rol</span>
          <select v-model="rol" class="field">
            <option value="">Todos</option>
            <option value="MONTACARGAS">Montacarguistas</option>
            <option value="OPERARIO_ALMACENAMIENTO">Operarios</option>
          </select>
        </label>
        <label class="f f-persona">
          <span class="lbl">Persona</span>
          <select v-model="usuarioId" class="field" @change="seleccionarPersona">
            <option value="">Todo el equipo</option>
            <option v-for="u in equipoDelRol" :key="u.id" :value="u.id">{{ u.nombre }} · {{u.jornada==='noche'?'Noche':'Día'}}</option>
          </select>
        </label>
      </div>

      <!-- En noche, que quede claro que la fecha es la noche que empieza y que va
           completa hasta la mañana siguiente. -->
      <p v-if="jornada === 'noche' && !esProceso && pestana !== 'pausas' && pestana !== 'ubicaciones'" class="aviso-noche">
        <Moon :size="14" />
        <span>
          <b v-if="tituloNoche">{{ tituloNoche }}.</b>
          Solo el personal de noche. Cada noche va completa, desde que empieza hasta su cierre a la mañana siguiente.
        </span>
      </p>

      <nav class="tabs" role="tablist">
        <button
          v-for="t in PESTANAS_PROCESO" :key="t.key"
          class="tab" role="tab" :class="{ on: pestana === t.key }"
          :aria-selected="pestana === t.key" @click="pestana = t.key"
        >
          {{ t.label }}
        </button>
        <span class="tab-sep" aria-hidden="true" />
        <button
          class="tab" role="tab" :class="{ on: pestana === 'laborado' }"
          :aria-selected="pestana === 'laborado'" @click="pestana = 'laborado'"
        >
          Tiempo trabajado
        </button>
        <button
          class="tab" role="tab" :class="{ on: pestana === 'muertos' }"
          :aria-selected="pestana === 'muertos'" @click="pestana = 'muertos'"
        >
          Tiempos muertos
          <!-- Lo que falta por justificar: sin esto hay que entrar a mirar. -->
          <span v-if="porJustificar > 0" class="badge-tab">{{ porJustificar }}</span>
        </button>
        <button
          class="tab" role="tab" :class="{ on: pestana === 'turnos' }"
          :aria-selected="pestana === 'turnos'" @click="pestana = 'turnos'"
        >
          Turnos
        </button>
        <button
          v-if="puedeVerPausas"
          class="tab" role="tab" :class="{ on: pestana === 'pausas' }"
          :aria-selected="pestana === 'pausas'" @click="pestana = 'pausas'"
        >
          Pausas
        </button>
        <button
          v-if="puedeVerPausas"
          class="tab" role="tab" :class="{ on: pestana === 'ubicaciones' }"
          :aria-selected="pestana === 'ubicaciones'" @click="pestana = 'ubicaciones'"
        >
          Ubicaciones
        </button>
      </nav>

      <!-- Los procesos traen sus propios datos (una consulta para todos). -->
      <IndicadoresProcesos
        v-if="esProceso" :pestana="(pestana as PestanaProceso)"
        :desde="desde" :hasta="hasta" :usuario-id="usuarioId"
      />

      <!-- El cuadro de turnos no depende del periodo ni de los datos: se ve
           aunque el rango elegido no tenga trabajo. -->
      <IndicadoresTurnos v-else-if="pestana === 'turnos'" @actualizar="cargar" />

      <!-- Alimentación y cambio de baterías: cuántas veces y cuánto tiempo. -->
      <IndicadoresPausas
        v-else-if="pestana === 'pausas' && puedeVerPausas"
        :desde="desde" :hasta="hasta" :rol="rol" :usuario-id="usuarioId"
      />

      <!-- Pendientes donde no se uso la altura o el picking sugeridos por el teorico. -->
      <IndicadoresUbicaciones
        v-else-if="pestana === 'ubicaciones' && puedeVerPausas"
        :desde="desde" :hasta="hasta" :usuario-id="usuarioId"
        :equipo-ids="rol ? equipo.filter((u) => u.rol === rol).map((u) => u.id) : []"
      />

      <ListSkeleton v-else-if="!datos" />

      <EmptyState
        v-else-if="vacio" title="Sin tiempos en el periodo"
        description="No hay PLUs cerrados en estas fechas. Prueba con un rango más amplio."
      />

      <!-- Al recargar se queda lo anterior, atenuado: sin saltos ni parpadeos. -->
      <div v-else class="contenido" :class="{ recargando: cargando }">
        <IndicadoresTiemposMuertos
          v-if="pestana === 'muertos' && muertos" :muertos="muertos" @actualizar="cargar"
        />

        <template v-else>
        <div class="cifras">
          <div class="heroe card">
            <span class="kpi-label">{{ heroe!.label }}</span>
            <span class="heroe-valor">{{ heroe!.valor }}</span>
            <p class="heroe-nota">{{ heroe!.nota }}</p>
          </div>
          <div v-for="t in tiles" :key="t.label" class="kpi card">
            <span class="kpi-label">{{ t.label }}</span>
            <span class="kpi-valor">{{ t.valor }}</span>
            <span class="kpi-hint">{{ t.hint }}</span>
          </div>
        </div>
        <p class="nota-cerrados">
          Solo cuenta lo cerrado: un PLU que sigue en curso entra cuando se ubica.
          <button class="btn btn-sm exportar-lab" :disabled="exportando" @click="exportarLaborado">
            <Spinner v-if="exportando" :size="13" /><Download v-else :size="13" /> Exportar a Excel
          </button>
        </p>

        <IndicadoresTiempoPersonas class="bloque" :personas="datos.personas" />

        <IndicadoresTarjeta
          v-if="carga.length" class="bloque" titulo="Peso y volumen movido"
          subtitulo="Lo que bajó y ubicó cada persona en el periodo: resurtido, pendientes y montacargas. Sale del maestro de medidas."
        >
          <IndicadoresBarrasH
            v-if="barrasCarga.length" :items="barrasCarga" medida="m³"
            :formato-eje="(v) => `${Math.round(v)} m³`"
          />
          <p v-else class="aviso">Todavía no hay trabajo cerrado con PLU medidos en este periodo.</p>
          <p v-if="sinMedidaTotal" class="pie">
            {{ sinMedidaTotal }} {{ sinMedidaTotal === 1 ? 'trabajo no se pudo contar' : 'trabajos no se pudieron contar' }}:
            su PLU no tiene medidas en el maestro.
          </p>
          <template #tabla>
            <IndicadoresTabla :columnas="columnasCarga" :filas="tablaCarga" principal="nombre" />
          </template>
        </IndicadoresTarjeta>

        <IndicadoresTarjeta
          v-if="resurtido.length" class="bloque" titulo="Resurtido por operario"
          subtitulo="PLU resurtidos cerrados en el periodo y su ritmo sobre el tiempo real en resurtido."
        >
          <IndicadoresBarrasH
            v-if="barrasResurtido.length" :items="barrasResurtido" medida="PLU/hora"
            :formato-eje="fmtNumero"
          />
          <IndicadoresTabla v-else :columnas="columnasResurtido" :filas="tablaResurtido" principal="nombre" />
          <template #tabla>
            <IndicadoresTabla :columnas="columnasResurtido" :filas="tablaResurtido" principal="nombre" />
          </template>
        </IndicadoresTarjeta>

        <IndicadoresCierresPorDia
          v-if="cierresDiarios.length" class="bloque"
          :cierres="cierresDiarios" :proyeccion="proyeccion"
        />

        <IndicadoresTarjeta
          class="bloque" titulo="Efectividad del turno por persona"
          subtitulo="Tiempo con mercancía en la mano dentro del turno, sobre la jornada que le toca."
        >
          <IndicadoresBarrasH
            v-if="barrasEfectividad.length" :items="barrasEfectividad" medida="del turno"
            :eje-maximo="100" :formato-eje="(v) => `${Math.round(v)} %`"
          />
          <p v-else class="aviso">
            Sin cuadro de turnos para estas fechas: cárgalo en la pestaña Turnos y aquí sale
            qué parte de la jornada de cada uno fue trabajo registrado.
          </p>
          <p v-if="conTurnos && sinTurno.length" class="pie">
            Sin turno en el cuadro, no se les puede medir: {{ sinTurno.join(', ') }}.
          </p>
          <template #tabla>
            <IndicadoresTabla :columnas="columnasEfectividad" :filas="tablaEfectividad" principal="nombre" />
          </template>
        </IndicadoresTarjeta>

        <!-- Una persona elegida: sus dos series en grande. Todo el equipo: una
             gráfica pequeña por persona, porque sumar las horas de todos da más
             que cualquier turno. -->
        <IndicadoresEvolucionPersonas
          v-if="!personaElegida" class="bloque" :personas="datos.personas"
        />
        <IndicadoresTarjeta
          v-else
          class="bloque" :titulo="`Evolución día a día de ${personaElegida.nombre}`"
          subtitulo="Tiempo real laborado y unidades ubicadas por día."
        >
          <div v-if="porDia.length > 1" class="dos">
            <div>
              <h4 class="mini-titulo">Tiempo laborado</h4>
              <IndicadoresLineaDiaria
                :puntos="puntosTiempo" etiqueta="tiempo laborado"
                :formato="fmtTiempo" :formato-fin="formatoHoras" :escala-eje="3600" sufijo-eje=" h"
              />
            </div>
            <div>
              <h4 class="mini-titulo">Unidades ubicadas</h4>
              <IndicadoresLineaDiaria
                :puntos="puntosUnidades" etiqueta="unidades" :formato="fmtNumero"
              />
            </div>
          </div>
          <p v-else class="aviso">Con un solo día no hay evolución que ver: elige 7 o 30 días.</p>
          <template #tabla>
            <IndicadoresTabla :columnas="columnasDia" :filas="tablaDia" principal="dia" />
          </template>
        </IndicadoresTarjeta>

        <div class="dos bloque">
          <IndicadoresTarjeta
            titulo="Unidades por hora"
            subtitulo="Unidades ubicadas por hora real en PLUs. La descarga de contenedores no entra."
          >
            <IndicadoresBarrasH
              v-if="barrasUndHora.length" :items="barrasUndHora" medida="und/hora"
              :formato-eje="fmtNumero"
            />
            <p v-else class="aviso">Nadie llega a 15 minutos en PLUs en este periodo.</p>
            <p v-if="pocoTiempo.length" class="pie">
              Con menos de 15 min en PLUs no se grafica (está en la tabla): {{ pocoTiempo.join(', ') }}.
            </p>
            <template #tabla>
              <IndicadoresTabla :columnas="columnasProd" :filas="tablaProd" principal="nombre" />
            </template>
          </IndicadoresTarjeta>

          <IndicadoresTarjeta
            titulo="Tiempo promedio por PLU"
            subtitulo="Lo que tarda cada PLU en su propio reloj. Más rápido arriba."
          >
            <IndicadoresBarrasH
              v-if="barrasPromedio.length" :items="barrasPromedio" medida="por PLU"
              :escala-eje="ejePromedio.escala" :formato-eje="ejePromedio.formato"
            />
            <p v-else class="aviso">Sin PLUs cerrados en este periodo.</p>
            <template #tabla>
              <IndicadoresTabla :columnas="columnasProd" :filas="tablaProd" principal="nombre" />
            </template>
          </IndicadoresTarjeta>
        </div>

        <IndicadoresTarjeta
          class="bloque" titulo="Reparto por tipo de tarea"
          subtitulo="En qué se fue el tiempo real del equipo."
        >
          <IndicadoresBarrasH
            :items="barrasReparto" medida="del tiempo" :ancho-etiqueta="190" :reserva="136"
            :escala-eje="ejeReparto.escala" :formato-eje="ejeReparto.formato"
          />
          <template #tabla>
            <IndicadoresTabla :columnas="columnasReparto" :filas="tablaReparto" principal="tipo" />
          </template>
        </IndicadoresTarjeta>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mod { position: relative; }
.hero { position: relative; z-index: 5; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }
.hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.bloque { margin-bottom: 18px; }

.filtros { display: flex; align-items: flex-end; gap: 12px; padding: 13px 15px; margin-bottom: 18px; flex-wrap: wrap; }
.f { display: flex; flex-direction: column; gap: 5px; }
.f .field { min-width: 140px; }
.f-persona .field { min-width: 200px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.presets { display: inline-flex; padding: 3px; gap: 2px; border-radius: var(--r-sm); background: var(--surface-3); align-self: flex-end; }
.preset {
  height: 32px; padding: 0 12px; border: none; border-radius: var(--r-xs); background: none;
  font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; white-space: nowrap;
}
.preset:hover { color: var(--ink-2); }
.presets.jornada .preset { display: inline-flex; align-items: center; gap: 6px; }
.aviso-noche {
  display: flex; align-items: center; gap: 9px; margin: 0 0 14px; padding: 10px 14px;
  border-radius: var(--r-sm); font-size: 12.5px; color: var(--ink-2);
  background: color-mix(in srgb, var(--info) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
}
.aviso-noche > svg { color: var(--info); flex-shrink: 0; }
.aviso-noche b { color: var(--ink); }
.preset.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-xs); }
.preset:focus-visible { outline: none; box-shadow: var(--ring); }

.tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid var(--border); overflow-x: auto; scrollbar-width: thin; }
.tabs .tab { flex-shrink: 0; white-space: nowrap; }
.tab {
  appearance: none; border: none; background: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 15px; font-size: 13px; font-weight: 600; color: var(--muted);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab:hover { color: var(--ink-2); }
.tab.on { color: var(--brand); border-bottom-color: var(--brand); }
.tab-sep { width: 1px; margin: 8px 6px; background: var(--border-strong); }
.exportar-lab { margin-left: 10px; vertical-align: middle; }
.tab:focus-visible { outline: none; box-shadow: var(--ring); border-radius: var(--r-xs); }
.badge-tab {
  display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 999px; background: var(--viz-por-justificar); color: var(--ink);
  font-size: 11px; font-weight: 800;
}

.contenido { transition: opacity .18s; }
.contenido.recargando { opacity: .55; pointer-events: none; }

.cifras { display: grid; grid-template-columns: 2fr repeat(4, 1fr); gap: 14px; }
.heroe { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; }
/* Una sola cifra grande por pantalla, en la misma letra que el resto. */
.heroe-valor { font-size: 48px; font-weight: 700; letter-spacing: -.03em; line-height: 1.05; color: var(--ink); }
.heroe-nota { margin: 4px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--muted); }
.heroe-nota b { color: var(--ink-2); }
.kpi { display: flex; flex-direction: column; gap: 3px; padding: 16px; }
.kpi-label { font-size: 12px; font-weight: 600; color: var(--muted); }
.kpi-valor { font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; color: var(--ink); }
.kpi-hint { font-size: 11.5px; color: var(--faint); }
.nota-cerrados { margin: 8px 2px 18px; font-size: 12px; color: var(--muted); }

.dos { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.dos > * { min-width: 0; }
.mini-titulo { margin: 0 0 6px; font-family: inherit; font-size: 12.5px; font-weight: 700; color: var(--ink-2); letter-spacing: 0; }
.aviso { margin: 8px 0; font-size: 13px; color: var(--muted); }
.pie { margin: 10px 0 0; font-size: 11.5px; line-height: 1.4; color: var(--muted); }

@media (max-width: 1100px) {
  .cifras { grid-template-columns: repeat(2, 1fr); }
  .heroe { grid-column: 1 / -1; }
}
@media (max-width: 900px) {
  .dos { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .hero-title { font-size: 24px; }
  .heroe-valor { font-size: 40px; }
  .presets { width: 100%; }
  .preset { flex: 1; }
  .f, .f-persona { flex: 1 1 140px; }
  .f .field, .f-persona .field { min-width: 0; width: 100%; }
}
</style>
