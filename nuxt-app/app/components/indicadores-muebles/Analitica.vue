<script setup lang="ts">
// Analítica de muebles: picking + inspección + entrega en un tablero.
//
// Va primero lo que decide el día (la proyección del turno y dónde se detiene
// la orden); después el detalle. Cada gráfico tiene su tabla ("Ver tabla") y
// ninguna cifra depende solo del color.
import { computed, ref, watch } from 'vue'
import { CalendarClock, Gauge, Hourglass, Truck, PackageCheck, Sparkles, RotateCcw } from '@lucide/vue'
import { fmtDiaCorto, type BarraH, type ColumnaTabla } from '~/utils/indicadores'
import {
  DIA_SEMANA_CORTO, DIA_SEMANA_LARGO, ESTADO_ORDEN_MUEBLES_LABEL, PLANTILLA_MUEBLES, TIPO_ORDEN_MUEBLES_LABEL,
  fmtDec, fmtMinutos, fmtPct, type AnaliticaMueblesDTO,
} from '~/utils/mueblesAnalitica'

const props = defineProps<{ datos: AnaliticaMueblesDTO }>()
const emit = defineEmits<{ (e: 'plantilla', v: { operarios: number; inspectores: number }): void }>()

// ── Plantilla para simular ──
// Por defecto la real (2 operarios y 5 inspectores). Cambiarla recalcula la
// proyección en el servidor: "¿y con un inspector más?".
const operarios = ref(String(props.datos.proyeccion.plantilla.operarios))
const inspectores = ref(String(props.datos.proyeccion.plantilla.inspectores))
watch(() => props.datos.proyeccion.plantilla, (v) => {
  operarios.value = String(v.operarios)
  inspectores.value = String(v.inspectores)
})
// v-model de un input number entrega número: se normaliza a texto para validar.
const valida = (s: string | number) => /^\d+$/.test(String(s)) && Number(s) >= 1 && Number(s) <= 30
let espera: ReturnType<typeof setTimeout> | null = null
watch([operarios, inspectores], ([o, i]) => {
  if (!valida(o) || !valida(i)) return
  const pl = props.datos.proyeccion.plantilla
  if (Number(o) === pl.operarios && Number(i) === pl.inspectores) return
  if (espera) clearTimeout(espera)
  espera = setTimeout(() => emit('plantilla', { operarios: Number(o), inspectores: Number(i) }), 450)
})
const esReal = computed(() => props.datos.proyeccion.plantilla.operarios === PLANTILLA_MUEBLES.operarios
  && props.datos.proyeccion.plantilla.inspectores === PLANTILLA_MUEBLES.inspectores)
function volverAReal() {
  operarios.value = String(PLANTILLA_MUEBLES.operarios)
  inspectores.value = String(PLANTILLA_MUEBLES.inspectores)
}

const r = computed(() => props.datos.resumen)
const p = computed(() => props.datos.proyeccion)
const q = computed(() => props.datos.calidad)
const tipo = (t: string) => TIPO_ORDEN_MUEBLES_LABEL[t] ?? t
const entero = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-CO'))

// ── KPI ──
const tiles = computed(() => [
  { icono: PackageCheck, label: 'Inspeccionadas', valor: entero(r.value.inspeccionadas), hint: `${fmtDec(r.value.inspeccionadasDia)} por día` },
  { icono: Truck, label: 'Entregadas a transporte', valor: entero(r.value.entregadas), hint: `${fmtDec(r.value.entregadasDia)} por día` },
  { icono: Hourglass, label: 'Lead time (mediana)', valor: fmtMinutos(r.value.leadTimeMedianaMin), hint: 'de abrir picking a entregar' },
  { icono: Sparkles, label: 'Órdenes perfectas', valor: fmtPct(q.value.perfectas, q.value.ordenes), hint: `${q.value.perfectas} de ${q.value.ordenes} inspeccionadas` },
  { icono: CalendarClock, label: 'Días con actividad', valor: entero(r.value.diasActivos), hint: `${entero(r.value.plusPickeados)} PLU pickeados` },
])

// ── Proyección ──
const cuelloTexto = computed(() => p.value.cuello === 'inspeccion' ? 'Inspección' : p.value.cuello === 'picking' ? 'Picking' : '—')
const barrasEtapaCapacidad = computed<BarraH[]>(() => {
  const j = p.value.jornadas.find((x) => x.horas === 9) ?? p.value.jornadas[0]
  if (!j) return []
  return [
    { id: 'picking', etiqueta: 'Picking', valor: j.capacidadPicking ?? 0, texto: `${entero(j.capacidadPicking)} órdenes` },
    { id: 'inspeccion', etiqueta: 'Inspección', valor: j.capacidadInspeccion ?? 0, texto: `${entero(j.capacidadInspeccion)} órdenes` },
  ].filter((b) => b.valor > 0)
})
const colsTipo: ColumnaTabla[] = [
  { key: 'tipo', label: 'Tipo de orden' },
  { key: 'mezcla', label: '% de la mezcla', num: true },
  { key: 'plus', label: 'PLU por orden', num: true },
  { key: 'picking', label: 'Picking por orden', num: true },
  { key: 'inspeccion', label: 'Inspección por orden', num: true },
  { key: 'unidadesOrden', label: 'Unidades por orden', num: true },
  { key: 'capacidad', label: 'Órdenes en 9 h (todo de este tipo)', num: true },
  { key: 'plus9h', label: 'PLU en 9 h', num: true },
  { key: 'unidades9h', label: 'Unidades en 9 h', num: true },
  { key: 'muestra', label: 'Órdenes medidas', num: true },
]
const filasTipo = computed(() => p.value.porTipo.map((t) => ({
  tipo: tipo(t.tipoOrden),
  mezcla: `${fmtDec(t.porcentajeMezcla)} %`,
  plus: fmtDec(t.plusPorOrden),
  picking: fmtMinutos(t.pickingMin),
  inspeccion: fmtMinutos(t.inspeccionMin),
  unidadesOrden: fmtDec(t.unidadesPorOrden),
  capacidad: entero(t.capacidad9h),
  plus9h: entero(t.plus9h),
  unidades9h: entero(t.unidades9h),
  muestra: t.muestra,
})))

// ── Completadas por día ──
const puntosInsp = computed(() => props.datos.dias.map((d) => ({ dia: d.dia, valor: d.inspeccionadas })))
const puntosEnt = computed(() => props.datos.dias.map((d) => ({ dia: d.dia, valor: d.entregadas })))
const maxDia = computed(() => Math.max(1, ...props.datos.dias.map((d) => Math.max(d.inspeccionadas, d.entregadas))))
const colsDia: ColumnaTabla[] = [
  { key: 'dia', label: 'Día' },
  { key: 'inspeccionadas', label: 'Inspeccionadas', num: true },
  { key: 'entregadas', label: 'Entregadas', num: true },
  { key: 'm3', label: 'm³ entregados', num: true },
  { key: 'kg', label: 'kg entregados', num: true },
]
const filasDia = computed(() => [...props.datos.dias].reverse().map((d) => ({
  dia: `${DIA_SEMANA_CORTO[d.diaSemana] ?? ''} ${fmtDiaCorto(d.dia)}`,
  inspeccionadas: d.inspeccionadas,
  entregadas: d.entregadas,
  m3: fmtDec(d.m3Entregado),
  kg: entero(Math.round(d.kgEntregado)),
})))

// ── Cuellos de botella ──
const barrasEtapas = computed<BarraH[]>(() => props.datos.etapas
  .filter((e) => e.medianaMin != null)
  .map((e) => ({
    id: e.key,
    etiqueta: e.label,
    valor: e.medianaMin!,
    texto: fmtMinutos(e.medianaMin),
    detalle: [
      { etiqueta: 'Mediana', valor: fmtMinutos(e.medianaMin) },
      { etiqueta: 'Promedio', valor: fmtMinutos(e.promedioMin) },
      { etiqueta: 'Órdenes', valor: String(e.ordenes) },
    ],
  })))
const etapaMasLarga = computed(() => [...props.datos.etapas]
  .filter((e) => e.medianaMin != null)
  .sort((a, b) => b.medianaMin! - a.medianaMin!)[0] ?? null)
const colsEtapas: ColumnaTabla[] = [
  { key: 'etapa', label: 'Etapa' },
  { key: 'mediana', label: 'Mediana', num: true },
  { key: 'promedio', label: 'Promedio', num: true },
  { key: 'ordenes', label: 'Órdenes', num: true },
]
const filasEtapas = computed(() => props.datos.etapas.map((e) => ({
  etapa: e.label, mediana: fmtMinutos(e.medianaMin), promedio: fmtMinutos(e.promedioMin), ordenes: e.ordenes,
})))

// ── PLU más pickeados ──
const TOP_PLU = 15
const barrasPlu = computed<BarraH[]>(() => props.datos.topPlus.slice(0, TOP_PLU).map((x) => ({
  id: x.plu,
  etiqueta: `${x.plu} · ${x.descripcion ?? 'Sin descripción'}`,
  valor: x.veces,
  texto: `${x.veces} ${x.veces === 1 ? 'vez' : 'veces'}`,
  detalle: [
    { etiqueta: 'Órdenes', valor: String(x.ordenes) },
    { etiqueta: 'Unidades', valor: entero(x.unidades) },
    { etiqueta: 'Picking promedio', valor: fmtMinutos(x.promedioPickingMin) },
  ],
})))
const colsPlu: ColumnaTabla[] = [
  { key: 'plu', label: 'PLU' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'veces', label: 'Veces', num: true },
  { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'unidades', label: 'Unidades', num: true },
  { key: 'picking', label: 'Picking promedio', num: true },
]
const filasPlu = computed(() => props.datos.topPlus.map((x) => ({
  plu: x.plu, descripcion: x.descripcion ?? '—', veces: x.veces, ordenes: x.ordenes,
  unidades: entero(x.unidades), picking: fmtMinutos(x.promedioPickingMin),
})))

// ── Ciudades ──
const barrasCiudad = computed<BarraH[]>(() => props.datos.ciudades.slice(0, 12).map((c) => ({
  id: c.ciudad,
  etiqueta: c.ciudad,
  valor: c.ordenes,
  texto: `${c.ordenes} · ${fmtDec(c.promedioDia)}/día`,
  detalle: [
    { etiqueta: 'Parte del total', valor: `${fmtDec(c.porcentaje)} %` },
    { etiqueta: 'Promedio por día', valor: fmtDec(c.promedioDia) },
    { etiqueta: 'm³', valor: fmtDec(c.m3) },
  ],
})))
const colsCiudad: ColumnaTabla[] = [
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'dia', label: 'Promedio por día', num: true },
  { key: 'pct', label: '% del total', num: true },
  { key: 'm3', label: 'm³', num: true },
  { key: 'kg', label: 'kg', num: true },
]
const filasCiudad = computed(() => props.datos.ciudades.map((c) => ({
  ciudad: c.ciudad, ordenes: c.ordenes, dia: fmtDec(c.promedioDia), pct: `${fmtDec(c.porcentaje)} %`,
  m3: fmtDec(c.m3), kg: entero(Math.round(c.kg)),
})))

// ── Horas pico ──
// Solo las horas y los días con algo: columnas vacías de noche no dicen nada.
const horasHeat = computed(() => {
  const con = props.datos.horasPico.celdas.filter((c) => c.plus > 0).map((c) => c.hora)
  if (!con.length) return []
  const desde = Math.min(...con), hasta = Math.max(...con)
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
})
const diasHeat = computed(() => [1, 2, 3, 4, 5, 6]
  .filter((ds) => props.datos.horasPico.celdas.some((c) => c.diaSemana === ds && c.plus > 0)))
const celda = (ds: number, h: number) => props.datos.horasPico.celdas.find((c) => c.diaSemana === ds && c.hora === h)?.plus ?? 0
const intensidad = (n: number) => {
  const max = props.datos.horasPico.maximo
  // Escala de un solo tono (la marca), de claro a oscuro; el cero queda vacío.
  return n > 0 && max > 0 ? `color-mix(in srgb, var(--brand) ${Math.round(12 + (n / max) * 78)}%, var(--surface))` : 'var(--surface-2)'
}
const horaPicoTexto = computed(() => {
  const top = [...props.datos.horasPico.porHora].sort((a, b) => b.plus - a.plus)[0]
  return top && top.plus ? `${top.hora}:00 – ${top.hora + 1}:00 (${top.plus} PLU)` : '—'
})
const colsDiaSemana: ColumnaTabla[] = [
  { key: 'dia', label: 'Día' },
  { key: 'plus', label: 'PLU pickeados', num: true },
  { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'dias', label: 'Días', num: true },
  { key: 'prom', label: 'Órdenes por día', num: true },
]
const filasDiaSemana = computed(() => props.datos.horasPico.porDiaSemana.map((d) => ({
  dia: DIA_SEMANA_LARGO[d.diaSemana] ?? '', plus: d.plus, ordenes: d.ordenes, dias: d.dias, prom: fmtDec(d.promedioOrdenes),
})))

// ── Calidad ──
const barrasCalidad = computed<BarraH[]>(() => {
  const n = q.value.ordenes
  if (!n) return []
  const b = (id: string, etiqueta: string, v: number, color: string): BarraH => ({
    id, etiqueta, valor: Math.round((v / n) * 1000) / 10, texto: `${fmtPct(v, n)} · ${v}`, color,
  })
  return [
    b('perfectas', 'Perfectas', q.value.perfectas, 'var(--u-ok)'),
    b('ebanisteria', 'Con ebanistería', q.value.conEbanisteria, 'var(--u-aviso)'),
    b('error', 'Con error de picking', q.value.conError, 'var(--u-critico)'),
    b('averia', 'Con avería', q.value.conAveria, 'var(--u-critico)'),
    b('pendientes', 'Con PLU pendiente', q.value.conPendientes, 'var(--u-aviso)'),
  ]
})
const colsCalidad: ColumnaTabla[] = [
  { key: 'etiqueta', label: 'Órdenes' },
  { key: 'n', label: 'Cantidad', num: true },
  { key: 'pct', label: '% de las inspeccionadas', num: true },
]
const filasCalidad = computed(() => barrasCalidad.value.map((b) => ({
  etiqueta: b.etiqueta, n: b.texto.split(' · ')[1] ?? '', pct: `${fmtDec(b.valor)} %`,
})))

// ── Mezcla ──
const colsMezcla: ColumnaTabla[] = [
  { key: 'tipo', label: 'Tipo' },
  { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'pct', label: '%', num: true },
  { key: 'plus', label: 'PLU por orden', num: true },
  { key: 'm3', label: 'm³', num: true },
  { key: 'kg', label: 'kg', num: true },
]
const filasMezcla = computed(() => props.datos.mezcla.map((m) => ({
  tipo: tipo(m.tipoOrden), ordenes: m.ordenes, pct: `${fmtDec(m.porcentaje)} %`, plus: fmtDec(m.plusPorOrden),
  m3: fmtDec(m.m3), kg: entero(Math.round(m.kg)),
})))
const barrasMezcla = computed<BarraH[]>(() => props.datos.mezcla.map((m) => ({
  id: m.tipoOrden, etiqueta: tipo(m.tipoOrden), valor: m.ordenes,
  texto: `${m.ordenes} · ${fmtDec(m.porcentaje)} %`,
  detalle: [{ etiqueta: 'PLU por orden', valor: fmtDec(m.plusPorOrden) }, { etiqueta: 'm³', valor: fmtDec(m.m3) }],
})))

// ── Órdenes completadas ──
const busca = ref('')
const MAX_FILAS = 200
const ordenesVisibles = computed(() => {
  const t = busca.value.trim().toUpperCase()
  const lista = t
    ? props.datos.ordenes.filter((o) => o.codigo.includes(t) || (o.ciudad ?? '').includes(t) || o.tipoOrden.includes(t))
    : props.datos.ordenes
  return lista
})
const colsOrdenes: ColumnaTabla[] = [
  { key: 'codigo', label: 'Orden' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'plus', label: 'PLU', num: true },
  { key: 'picking', label: 'Picking', num: true },
  { key: 'espera', label: 'Espera a inspección', num: true },
  { key: 'inspeccion', label: 'Inspección', num: true },
  { key: 'esperaEnt', label: 'Espera a entrega', num: true },
  { key: 'lead', label: 'Lead time', num: true },
  { key: 'estado', label: 'Estado' },
  { key: 'calidad', label: 'Novedades' },
]
const filaOrden = (o: AnaliticaMueblesDTO['ordenes'][number]) => ({
  codigo: o.codigo,
  tipo: tipo(o.tipoOrden),
  ciudad: o.ciudad ?? '—',
  plus: o.plus,
  picking: fmtMinutos(o.pickingMin),
  espera: fmtMinutos(o.esperaInspeccionMin),
  inspeccion: fmtMinutos(o.inspeccionRelojMin),
  esperaEnt: fmtMinutos(o.esperaEntregaMin),
  lead: fmtMinutos(o.leadTimeMin),
  estado: ESTADO_ORDEN_MUEBLES_LABEL[o.estado] ?? o.estado,
  calidad: [
    o.errores ? `${o.errores} error${o.errores === 1 ? '' : 'es'}` : '',
    o.ebanisteria ? 'Ebanistería' : '',
    o.averia ? 'Avería' : '',
    o.pendientes ? 'Pendiente' : '',
  ].filter(Boolean).join(' · ') || '—',
})
const filasOrdenes = computed(() => ordenesVisibles.value.slice(0, MAX_FILAS).map(filaOrden))

// El Excel lleva TODAS las ordenes (la pantalla muestra 200).
defineExpose({
  hojas: () => [
    { nombre: 'Órdenes completadas', columnas: colsOrdenes, filas: props.datos.ordenes.map(filaOrden) },
    { nombre: 'Proyección por tipo', columnas: colsTipo, filas: filasTipo.value },
    { nombre: 'Completadas por día', columnas: colsDia, filas: filasDia.value },
    { nombre: 'Dónde se detiene', columnas: colsEtapas, filas: filasEtapas.value },
    { nombre: 'Entregas por ciudad', columnas: colsCiudad, filas: filasCiudad.value },
    { nombre: 'Mezcla', columnas: colsMezcla, filas: filasMezcla.value },
    { nombre: 'PLU más pickeados', columnas: colsPlu, filas: filasPlu.value },
    { nombre: 'Horas pico por día', columnas: colsDiaSemana, filas: filasDiaSemana.value },
    { nombre: 'Calidad', columnas: colsCalidad, filas: filasCalidad.value },
  ],
})
</script>

<template>
  <div class="an">
    <!-- KPI del periodo -->
    <div class="an-tiles">
      <div v-for="t in tiles" :key="t.label" class="an-tile">
        <span class="an-tile-ic"><component :is="t.icono" :size="14" /></span>
        <span class="an-tile-num tnum">{{ t.valor }}</span>
        <span class="an-tile-label">{{ t.label }}</span>
        <span class="an-tile-hint">{{ t.hint }}</span>
      </div>
    </div>

    <!-- Proyección del turno -->
    <IndicadoresTarjeta
      class="bloque" titulo="Proyección del turno"
      subtitulo="Cuántas órdenes caben en un día con el equipo y los tiempos reales del periodo (trabajo medido, sin colas)."
    >
      <div class="proy">
        <div v-for="j in p.jornadas" :key="j.etiqueta" class="proy-dato">
          <span class="proy-label">{{ j.etiqueta }} · {{ String(j.horas).replace('.5', ' h 30').replace(/^(\d+)$/, '$1 h') }}</span>
          <span class="proy-num tnum">{{ entero(j.capacidad) }}</span>
          <span class="proy-hint">órdenes por día</span>
          <span class="proy-equiv tnum">{{ entero(j.capacidadPlus) }} PLU · {{ entero(j.capacidadUnidades) }} und</span>
        </div>
        <div class="proy-dato">
          <span class="proy-label">Semana (lun–vie)</span>
          <span class="proy-num tnum">{{ entero(p.semana) }}</span>
          <span class="proy-hint">órdenes</span>
          <span class="proy-equiv tnum">{{ entero(p.semanaPlus) }} PLU · {{ entero(p.semanaUnidades) }} und</span>
        </div>
        <div class="proy-dato proy-cuello">
          <span class="proy-label"><Gauge :size="12" /> Cuello de botella</span>
          <span class="proy-num">{{ cuelloTexto }}</span>
          <span class="proy-hint">la etapa que limita el día</span>
        </div>
      </div>

      <div class="plantilla">
        <label class="pl-campo">
          <span class="pl-label">Operarios de picking</span>
          <input v-model="operarios" class="field tnum" type="number" min="1" max="30" inputmode="numeric">
        </label>
        <label class="pl-campo">
          <span class="pl-label">Inspectores</span>
          <input v-model="inspectores" class="field tnum" type="number" min="1" max="30" inputmode="numeric">
        </label>
        <p class="pl-nota">
          <template v-if="esReal">Plantilla real del turno. Cámbiala para simular.</template>
          <template v-else>
            Simulando otra plantilla.
            <button type="button" class="btn btn-sm btn-ghost" @click="volverAReal"><RotateCcw :size="13" /> Volver a 2 y 5</button>
          </template>
          <span class="pl-obs">
            En los registros aparecieron {{ fmtDec(p.operariosDia) }} operarios y {{ fmtDec(p.inspectoresDia) }}
            inspectores por día (cuenta a quien hizo aunque sea un PLU).
          </span>
        </p>
      </div>

      <p class="proy-como">
        Con <b class="tnum">{{ p.plantilla.operarios }}</b> {{ p.plantilla.operarios === 1 ? 'operario' : 'operarios' }} y
        <b class="tnum">{{ p.plantilla.inspectores }}</b> {{ p.plantilla.inspectores === 1 ? 'inspector' : 'inspectores' }}, y
        <b>{{ fmtMinutos(p.pickingMinMezcla) }}</b> de picking y <b>{{ fmtMinutos(p.inspeccionMinMezcla) }}</b>
        de inspección por orden (con la mezcla real de tipos).
        <template v-if="p.pickingRitmoMin != null && p.pickingRelojMin != null">
          El picking va a <b>ritmo real</b>: una orden pickeada toma {{ fmtMinutos(p.pickingRitmoMin) }} contando el tiempo
          entre órdenes (con la orden abierta son {{ fmtMinutos(p.pickingRelojMin) }}).
        </template> Cada orden trae en promedio
        <b class="tnum">{{ fmtDec(p.plusPorOrdenMezcla) }}</b> PLU y <b class="tnum">{{ fmtDec(p.unidadesPorOrdenMezcla) }}</b> unidades,
        y con eso se pasa a PLU y unidades. En un turno de 9 h (martes a jueves) cabe esto por etapa:
      </p>
      <IndicadoresBarrasH
        v-if="barrasEtapaCapacidad.length" :items="barrasEtapaCapacidad" medida="órdenes en 9 h"
        :formato-eje="entero" :reserva="100"
      />
      <p class="proy-real">
        <b>Lo que se hizo:</b> {{ fmtDec(p.realDia) }} inspeccionadas por día.
        El turno de inspección estuvo ocupado el <b>{{ fmtDec(p.ocupacionInspeccion) }} %</b>
        y el de picking de muebles el <b>{{ fmtDec(p.ocupacionPicking) }} %</b>
        (el resto del tiempo el operario hace otras cosas o espera).
        La proyección supone el turno completo trabajando: es el techo, no la meta.
      </p>
      <template #tabla>
        <IndicadoresTabla :columnas="colsTipo" :filas="filasTipo" principal="tipo" />
      </template>
    </IndicadoresTarjeta>

    <!-- Dónde se detiene la orden -->
    <IndicadoresTarjeta
      class="bloque" titulo="Dónde se detiene la orden"
      :subtitulo="etapaMasLarga
        ? `Mediana de cada etapa. La más larga: ${etapaMasLarga.label.toLowerCase()} (${fmtMinutos(etapaMasLarga.medianaMin)}).`
        : 'Mediana de cada etapa del proceso.'"
    >
      <IndicadoresBarrasH
        v-if="barrasEtapas.length" :items="barrasEtapas" medida="mediana"
        :formato-eje="(v: number) => fmtMinutos(v)" :reserva="110"
      />
      <p v-else class="an-vacio">No hay órdenes completadas en el periodo.</p>
      <p class="an-nota">
        Las esperas son tiempo en cola: la orden está lista y nadie la ha tomado. Mediana y no promedio,
        porque unas pocas órdenes que esperan desde el día anterior disparan el promedio.
      </p>
      <template #tabla>
        <IndicadoresTabla :columnas="colsEtapas" :filas="filasEtapas" principal="etapa" />
      </template>
    </IndicadoresTarjeta>

    <!-- Completadas por día -->
    <IndicadoresTarjeta
      class="bloque" titulo="Órdenes completadas por día"
      :subtitulo="`Promedio por día con actividad: ${fmtDec(r.inspeccionadasDia)} inspeccionadas y ${fmtDec(r.entregadasDia)} entregadas a transporte.`"
    >
      <div class="dos-graf">
        <div>
          <h4 class="an-sub">Inspeccionadas</h4>
          <IndicadoresLineaDiaria :puntos="puntosInsp" :formato="entero" etiqueta="Inspeccionadas" :maximo="maxDia" :alto="170" />
        </div>
        <div>
          <h4 class="an-sub">Entregadas a transporte</h4>
          <IndicadoresLineaDiaria :puntos="puntosEnt" :formato="entero" etiqueta="Entregadas" :maximo="maxDia" :alto="170" />
        </div>
      </div>
      <template #tabla>
        <IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="dia" />
      </template>
    </IndicadoresTarjeta>

    <div class="dos">
      <!-- Ciudades -->
      <IndicadoresTarjeta
        titulo="Entregas a transporte por ciudad"
        :subtitulo="`${r.entregadas} órdenes entregadas · promedio por día con entregas`"
      >
        <IndicadoresBarrasH
          v-if="barrasCiudad.length" :items="barrasCiudad" medida="órdenes"
          :formato-eje="entero" :reserva="110" :ancho-etiqueta="120"
        />
        <p v-else class="an-vacio">Sin entregas en el periodo.</p>
        <template #tabla>
          <IndicadoresTabla :columnas="colsCiudad" :filas="filasCiudad" principal="ciudad" />
        </template>
      </IndicadoresTarjeta>

      <!-- Mezcla -->
      <IndicadoresTarjeta
        titulo="Mezcla de órdenes"
        subtitulo="Completadas por tipo. Una TSDM trae varios PLU; una OVDM, casi siempre uno."
      >
        <IndicadoresBarrasH
          v-if="barrasMezcla.length" :items="barrasMezcla" medida="órdenes"
          :formato-eje="entero" :reserva="110"
        />
        <IndicadoresTabla :columnas="colsMezcla" :filas="filasMezcla" principal="tipo" class="an-mini" />
        <template #tabla>
          <IndicadoresTabla :columnas="colsMezcla" :filas="filasMezcla" principal="tipo" />
        </template>
      </IndicadoresTarjeta>
    </div>

    <!-- PLU más pickeados -->
    <IndicadoresTarjeta
      class="bloque" titulo="PLU más pickeados"
      :subtitulo="`Veces que se pickeó cada PLU en el periodo · el gráfico muestra los ${TOP_PLU} primeros, la tabla ${datos.topPlus.length}`"
    >
      <IndicadoresBarrasH
        v-if="barrasPlu.length" :items="barrasPlu" medida="veces"
        :formato-eje="entero" :reserva="80" :ancho-etiqueta="260"
      />
      <p v-else class="an-vacio">No se pickeó nada en el periodo.</p>
      <template #tabla>
        <IndicadoresTabla :columnas="colsPlu" :filas="filasPlu" principal="plu" />
      </template>
    </IndicadoresTarjeta>

    <!-- Horas pico -->
    <IndicadoresTarjeta
      class="bloque" titulo="Horas pico de picking"
      :subtitulo="`PLU pickeados por día de la semana y hora. Hora más cargada: ${horaPicoTexto}.`"
    >
      <p v-if="!diasHeat.length" class="an-vacio">No se pickeó nada en el periodo.</p>
      <div v-else class="heat-wrap">
        <table class="heat" aria-label="PLU pickeados por día y hora">
          <thead>
            <tr>
              <th />
              <th v-for="h in horasHeat" :key="h" class="heat-h tnum">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ds in diasHeat" :key="ds">
              <th class="heat-d">{{ DIA_SEMANA_CORTO[ds] }}</th>
              <td
                v-for="h in horasHeat" :key="h" class="heat-c tnum"
                :style="{ background: intensidad(celda(ds, h)) }"
                :class="{ fuerte: celda(ds, h) > datos.horasPico.maximo * 0.55 }"
                :title="`${DIA_SEMANA_LARGO[ds]} ${h}:00 – ${h + 1}:00 · ${celda(ds, h)} PLU`"
              >
                {{ celda(ds, h) || '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="an-nota">Más oscuro, más PLU pickeados en esa hora. Sirve para ubicar descansos y refuerzos.</p>
      <template #tabla>
        <IndicadoresTabla :columnas="colsDiaSemana" :filas="filasDiaSemana" principal="dia" />
      </template>
    </IndicadoresTarjeta>

    <!-- Calidad -->
    <IndicadoresTarjeta
      class="bloque" titulo="Calidad por orden"
      :subtitulo="`Sobre ${q.ordenes} órdenes inspeccionadas. Perfecta = sin error, ebanistería, avería ni pendientes.`"
    >
      <IndicadoresBarrasH
        v-if="barrasCalidad.length" :items="barrasCalidad" medida="de las órdenes"
        :eje-maximo="100" :formato-eje="(v: number) => `${Math.round(v)} %`" :reserva="110" :ancho-etiqueta="170"
      />
      <p v-else class="an-vacio">No hay órdenes inspeccionadas en el periodo.</p>
      <template #tabla>
        <IndicadoresTabla :columnas="colsCalidad" :filas="filasCalidad" principal="etiqueta" />
      </template>
    </IndicadoresTarjeta>

    <!-- Órdenes completadas -->
    <IndicadoresTarjeta
      class="bloque" titulo="Órdenes completadas y su proceso"
      :subtitulo="`${datos.ordenes.length} órdenes inspeccionadas o entregadas en el periodo, de la más reciente a la más vieja`"
    >
      <label class="an-busca">
        <span class="sr-only">Buscar orden, ciudad o tipo</span>
        <input v-model="busca" class="field" type="search" placeholder="Buscar orden, ciudad o tipo">
      </label>
      <div class="an-tabla">
        <IndicadoresTabla :columnas="colsOrdenes" :filas="filasOrdenes" principal="codigo" />
      </div>
      <p v-if="ordenesVisibles.length > MAX_FILAS" class="an-nota">
        Se muestran {{ MAX_FILAS }} de {{ ordenesVisibles.length }}: busca por orden o ciudad para acotar.
      </p>
      <template #tabla>
        <IndicadoresTabla :columnas="colsOrdenes" :filas="filasOrdenes" principal="codigo" />
      </template>
    </IndicadoresTarjeta>
  </div>
</template>

<style scoped>
.an-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px; }
.an-tile { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.an-tile-ic { display: grid; place-items: center; width: 24px; height: 24px; margin-bottom: 6px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.an-tile-num { font-size: 24px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
.an-tile-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.an-tile-hint { font-size: 12px; color: var(--muted); }

.bloque { margin-bottom: 18px; }
.dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; margin-bottom: 18px; }

.proy { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 14px; }
.proy-dato { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--border); }
.proy-label { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.proy-num { font-size: 30px; font-weight: 800; letter-spacing: -.03em; color: var(--brand); }
.proy-hint { font-size: 12px; color: var(--muted); }
.proy-equiv { margin-top: 4px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); }
.proy-cuello .proy-num { font-size: 22px; color: var(--ink); padding: 5px 0 3px; }
.plantilla { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.pl-campo { display: grid; gap: 5px; width: 150px; }
.pl-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pl-nota { flex: 1 1 260px; margin: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; font-size: 12.5px; color: var(--ink-2); }
.pl-obs { font-size: 12px; color: var(--muted); }
.proy-como, .proy-real { margin: 0 0 10px; font-size: 12.5px; line-height: 1.55; color: var(--ink-2); max-width: 90ch; }
.proy-real { margin: 12px 0 0; padding: 10px 12px; border-radius: var(--r-sm); background: var(--surface-2); color: var(--muted); }
.proy-como b, .proy-real b { color: var(--ink); }

.dos-graf { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.an-sub { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: var(--ink-2); }
.an-nota { margin: 10px 0 0; font-size: 12px; color: var(--muted); max-width: 90ch; }
.an-vacio { margin: 0; padding: 14px 0 4px; font-size: 13px; color: var(--muted); }
.an-mini { margin-top: 12px; }

.heat-wrap { overflow-x: auto; }
.heat { border-collapse: separate; border-spacing: 3px; min-width: 620px; width: 100%; }
.heat-h { font-size: 10.5px; font-weight: 600; color: var(--muted); text-align: center; }
.heat-d { font-size: 11.5px; font-weight: 700; color: var(--ink-2); text-align: left; padding-right: 6px; white-space: nowrap; }
.heat-c { height: 30px; min-width: 26px; border-radius: 5px; text-align: center; font-size: 11px; font-weight: 600; color: var(--ink-2); }
.heat-c.fuerte { color: var(--on-brand); }

.an-busca { display: block; margin-bottom: 10px; max-width: 320px; }
.an-tabla { max-height: 520px; overflow: auto; margin: 0 -18px -18px; border-top: 1px solid var(--border); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
