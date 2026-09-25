<script setup lang="ts">
// Indicadores de Transporte (25-09-2026): lo que sale del Cargue de camiones.
// Camiones, órdenes y bultos por día; tiempos del camión y de cada orden;
// bultos por hora; novedades (bultos que no cuadran); y de lo de muebles m³,
// kg y valor OVDM. Repartido por transportadora, ciudad, tipo de vehículo,
// persona que carga, origen de la orden y hora del día.
//
// Usa las mismas piezas del dashboard (Tarjeta, BarrasH, LineaDiaria, Tabla,
// CifraProceso): así el «Exportar dashboard» saca sus gráficos nativos en Excel.
import { computed, provide, ref, watch } from 'vue'
import { Truck, RefreshCw, FileSpreadsheet, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { useSessionState } from '~/composables/useSession'
import { PRESETS_RANGO, fmtDiaCorto, rangoDePreset, type BarraH, type ColumnaTabla, type PresetRango } from '~/utils/indicadores'
import { variacion } from '~/utils/procesos'
import { fmtMin } from '~/utils/muebles'
import { fmtKg, fmtM3 } from '~/utils/carga'
import { hoyBogota } from '~/utils/exportaciones'
import { API_INDICADORES_TRANSPORTE, type GrupoCargueDTO, type IndicadoresTransporteDTO } from '~/utils/indicadoresTransporte'
import { CLAVE_COLECTOR, crearColector, exportarDashboard, type ColectorExport } from '~/utils/exportarDashboard'

const { show } = useToast()
const { me } = useSessionState()

const preset = ref<PresetRango>('7d')
const desde = ref(rangoDePreset('7d', hoyBogota()).desde)
const hasta = ref(hoyBogota())
function aplicarPreset(p: Exclude<PresetRango, 'custom'>) {
  preset.value = p
  const r = rangoDePreset(p, hoyBogota())
  desde.value = r.desde
  hasta.value = r.hasta
}

const datos = ref<IndicadoresTransporteDTO | null>(null)
const cargando = ref(false)
async function cargar() {
  cargando.value = true
  try {
    datos.value = await $fetch<IndicadoresTransporteDTO>(API_INDICADORES_TRANSPORTE, { query: { desde: desde.value, hasta: hasta.value } })
  } catch (e) {
    show(apiErr(e, 'No se pudieron cargar los indicadores'), true)
  } finally {
    cargando.value = false
  }
}
watch([desde, hasta, () => me.value?.id], () => { if (me.value) void cargar() }, { immediate: true })

const entero = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('es-CO'))
const dec = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: 1 }))
const pesos = (v: number | null | undefined) => (v == null ? '—' : `$ ${Math.round(v).toLocaleString('es-CO')}`)
const millones = (v: number) => `$ ${(v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`

const cifras = computed(() => {
  const d = datos.value
  if (!d) return []
  const a = d.resumen
  const b = d.anterior.resumen
  return [
    { label: 'Camiones cargados', valor: entero(a.camiones), hint: `${dec(a.camionesDia)} por día con cargue`, cambio: variacion(a.camiones, b.camiones) },
    { label: 'Órdenes cargadas', valor: entero(a.ordenes), hint: `${dec(a.ordenesPorCamion)} por camión`, cambio: variacion(a.ordenes, b.ordenes) },
    { label: 'Bultos cargados', valor: entero(a.bultos), hint: `${dec(a.bultosPorCamion)} por camión · ${entero(a.bultosDeclarados)} declarados`, cambio: variacion(a.bultos, b.bultos) },
    { label: 'Tiempo por camión', valor: fmtMin(a.minCamion), hint: 'de iniciar a finalizar el camión', cambio: variacion(a.minCamion, b.minCamion, true) },
    { label: 'Tiempo por orden', valor: fmtMin(a.minOrden), hint: 'de iniciar a finalizar cada pedido', cambio: variacion(a.minOrden, b.minOrden, true) },
    { label: 'Bultos por hora', valor: dec(a.bultosHora), hint: 'sobre el tiempo de cargue de las órdenes', cambio: variacion(a.bultosHora, b.bultosHora) },
    { label: 'Órdenes con novedad', valor: entero(a.novedades), hint: a.pctNovedad == null ? 'bultos que no cuadran' : `${dec(a.pctNovedad)} % de las órdenes`, cambio: variacion(a.novedades, b.novedades, true) },
    { label: 'Valor OVDM cargado', valor: pesos(a.valorOvdm), hint: 'muebles OVDM a precio de venta', cambio: variacion(a.valorOvdm, b.valorOvdm) },
    { label: 'Volumen muebles', valor: fmtM3(a.m3), hint: `${fmtKg(a.kg)} de peso`, cambio: variacion(a.m3, b.m3) },
  ]
})

const puntos = (k: 'camiones' | 'bultos' | 'valorOvdm' | 'ordenes') => (datos.value?.porDia ?? []).map((d) => ({ dia: d.dia, valor: d[k] }))
const barras = (g: GrupoCargueDTO[], k: 'bultos' | 'camiones' | 'ordenes', sufijo: string, max = 15): BarraH[] =>
  g.slice(0, max).map((x) => ({ id: x.clave, etiqueta: x.clave, valor: x[k], texto: `${entero(x[k])} ${sufijo}` }))

const colsGrupo = (nombre: string): ColumnaTabla[] => [
  { key: 'clave', label: nombre },
  { key: 'camiones', label: 'Camiones', num: true },
  { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'bultos', label: 'Bultos', num: true },
  { key: 'minCamion', label: 'Min. por camión', num: true },
  { key: 'minOrden', label: 'Min. por orden', num: true },
]
const filasGrupo = (g: GrupoCargueDTO[]) => g.map((x) => ({
  clave: x.clave, camiones: x.camiones, ordenes: x.ordenes, bultos: x.bultos,
  minCamion: x.minCamion == null ? '—' : dec(x.minCamion), minOrden: x.minOrden == null ? '—' : dec(x.minOrden),
}))

const colsDia: ColumnaTabla[] = [
  { key: 'dia', label: 'Día' }, { key: 'camiones', label: 'Camiones', num: true }, { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'bultos', label: 'Bultos', num: true }, { key: 'm3', label: 'm³ muebles', num: true }, { key: 'kg', label: 'kg muebles', num: true },
  { key: 'valor', label: 'Valor OVDM', num: true },
]
const filasDia = computed(() => [...(datos.value?.porDia ?? [])].reverse().map((d) => ({
  dia: fmtDiaCorto(d.dia), camiones: d.camiones, ordenes: d.ordenes, bultos: d.bultos, m3: dec(d.m3), kg: entero(d.kg), valor: pesos(d.valorOvdm),
})))

const barrasHora = computed<BarraH[]>(() => (datos.value?.porHora ?? []).map((h) => ({
  id: String(h.hora), etiqueta: `${String(h.hora).padStart(2, '0')}:00`, valor: h.camiones, texto: `${h.camiones} camiones`,
})))
const colsHora: ColumnaTabla[] = [{ key: 'hora', label: 'Hora de inicio' }, { key: 'camiones', label: 'Camiones', num: true }]
const filasHora = computed(() => (datos.value?.porHora ?? []).map((h) => ({ hora: `${String(h.hora).padStart(2, '0')}:00`, camiones: h.camiones })))

const colsNov: ColumnaTabla[] = [
  { key: 'fecha', label: 'Día' }, { key: 'codigo', label: 'Orden' }, { key: 'transportadora', label: 'Transportadora' },
  { key: 'ciudad', label: 'Ciudad' }, { key: 'declarados', label: 'Declarados', num: true }, { key: 'cargados', label: 'Cargados', num: true },
  { key: 'nota', label: 'Qué pasó' },
]
const filasNov = computed(() => (datos.value?.novedades ?? []).map((n) => ({
  fecha: fmtDiaCorto(n.fecha), codigo: n.codigo, transportadora: n.transportadora, ciudad: n.ciudad ?? '—',
  declarados: n.declarados ?? '—', cargados: n.cargados ?? '—', nota: n.nota ?? '—',
})))

const colsCamiones: ColumnaTabla[] = [
  { key: 'fecha', label: 'Día' }, { key: 'transportadora', label: 'Transportadora' }, { key: 'vehiculo', label: 'Vehículo' },
  { key: 'placa', label: 'Placa' }, { key: 'minutos', label: 'Minutos', num: true }, { key: 'ordenes', label: 'Órdenes', num: true },
  { key: 'bultos', label: 'Bultos', num: true }, { key: 'personas', label: 'Personas', num: true }, { key: 'novedades', label: 'Novedades', num: true },
]
const filasCamiones = computed(() => (datos.value?.camiones ?? []).map((c) => ({
  fecha: fmtDiaCorto(c.fecha), transportadora: c.transportadora, vehiculo: c.tipoVehiculo, placa: c.placa ?? '—',
  minutos: c.minutos == null ? '—' : dec(c.minutos), ordenes: c.ordenes, bultos: c.bultos, personas: c.personas, novedades: c.novedades,
})))

// ── Exportar dashboard (gráficos nativos en Excel) ──
const colector: ColectorExport = crearColector(ref(false))
provide(CLAVE_COLECTOR, colector)
const contenido = ref<HTMLElement | null>(null)
const exportando = ref(false)
async function exportar() {
  if (exportando.value || !datos.value) return
  exportando.value = true
  try {
    await exportarDashboard({
      archivo: `indicadores-transporte-${desde.value}_${hasta.value}`,
      titulo: 'Indicadores · Transporte',
      filtros: [['Periodo', desde.value === hasta.value ? desde.value : `${desde.value} a ${hasta.value}`]],
      pestanas: [{ key: 'cargue', label: 'Cargue de camiones' }],
      actual: 'cargue',
      irA: () => {},
      raiz: () => contenido.value,
      colector,
    })
    show('Dashboard exportado')
  } catch (e) {
    show(apiErr(e, 'No se pudo exportar'), true)
  } finally {
    exportando.value = false
  }
}
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker"><span class="hero-ic"><Truck :size="13" /></span> CEDI · Transporte</span>
        <h1 class="hero-title">Indicadores</h1>
        <p class="hero-desc">Cargue de camiones: camiones, órdenes, bultos, tiempos y novedades.</p>
      </div>
      <div class="hero-acciones">
        <button class="btn btn-sm" :disabled="exportando || !datos" @click="exportar">
          <Loader2 v-if="exportando" :size="14" class="spin" /><FileSpreadsheet v-else :size="14" /> Exportar dashboard
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="cargando" @click="cargar"><RefreshCw :size="14" /> Actualizar</button>
      </div>
    </section>

    <section class="filtros card">
      <div class="presets">
        <button v-for="p in PRESETS_RANGO" :key="p.key" class="chip" :class="{ on: preset === p.key }" @click="aplicarPreset(p.key)">{{ p.label }}</button>
      </div>
      <label class="campo"><span>Desde</span><input v-model="desde" class="field" type="date" @input="preset = 'custom'"></label>
      <label class="campo"><span>Hasta</span><input v-model="hasta" class="field" type="date" @input="preset = 'custom'"></label>
    </section>

    <div v-if="cargando && !datos" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>
    <p v-else-if="datos && !datos.resumen.camiones" class="vacio">Ningún camión finalizado en el periodo.</p>

    <div v-if="datos && datos.resumen.camiones" ref="contenido">
      <p class="sub">Se compara con {{ fmtDiaCorto(datos.anterior.desde) }} – {{ fmtDiaCorto(datos.anterior.hasta) }}.</p>
      <div class="cifras">
        <IndicadoresCifraProceso v-for="c in cifras" :key="c.label" v-bind="c" />
      </div>

      <div class="dos bloque">
        <IndicadoresTarjeta titulo="Camiones por día" subtitulo="Camiones finalizados cada día.">
          <IndicadoresLineaDiaria :puntos="puntos('camiones')" :formato="(v: number) => `${entero(v)} camiones`" etiqueta="Camiones" />
          <template #tabla><IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="dia" /></template>
        </IndicadoresTarjeta>
        <IndicadoresTarjeta titulo="Bultos por día" subtitulo="Bultos contados al subir cada orden.">
          <IndicadoresLineaDiaria :puntos="puntos('bultos')" :formato="(v: number) => `${entero(v)} bultos`" etiqueta="Bultos" />
          <template #tabla><IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="dia" /></template>
        </IndicadoresTarjeta>
      </div>

      <IndicadoresTarjeta class="bloque" titulo="Valor OVDM cargado por día" subtitulo="Órdenes OVDM de muebles a precio de venta del maestro (sin contado ni órdenes de tienda).">
        <IndicadoresLineaDiaria
          :puntos="puntos('valorOvdm')" :formato="pesos" :formato-fin="millones" :escala-eje="1000000" sufijo-eje=" M" etiqueta="Valor OVDM"
        />
        <template #tabla><IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="dia" /></template>
      </IndicadoresTarjeta>

      <div class="dos bloque">
        <IndicadoresTarjeta titulo="Por transportadora" subtitulo="Bultos cargados por cada transportadora.">
          <IndicadoresBarrasH :items="barras(datos.porTransportadora, 'bultos', 'bultos')" medida="bultos" :formato-eje="entero" :reserva="100" />
          <template #tabla><IndicadoresTabla :columnas="colsGrupo('Transportadora')" :filas="filasGrupo(datos.porTransportadora)" principal="clave" /></template>
        </IndicadoresTarjeta>
        <IndicadoresTarjeta titulo="Por ciudad" subtitulo="Bultos que salieron hacia cada ciudad.">
          <IndicadoresBarrasH :items="barras(datos.porCiudad, 'bultos', 'bultos')" medida="bultos" :formato-eje="entero" :reserva="100" />
          <template #tabla><IndicadoresTabla :columnas="colsGrupo('Ciudad')" :filas="filasGrupo(datos.porCiudad)" principal="clave" /></template>
        </IndicadoresTarjeta>
      </div>

      <div class="dos bloque">
        <IndicadoresTarjeta titulo="Por persona que carga" subtitulo="Camiones en que participó cada persona (cada camión le cuenta completo).">
          <IndicadoresBarrasH :items="barras(datos.porOperario, 'camiones', 'camiones', 20)" medida="camiones" :formato-eje="entero" :reserva="110" :ancho-etiqueta="190" />
          <template #tabla><IndicadoresTabla :columnas="colsGrupo('Persona')" :filas="filasGrupo(datos.porOperario)" principal="clave" /></template>
        </IndicadoresTarjeta>
        <IndicadoresTarjeta titulo="Por tipo de vehículo" subtitulo="Camiones de cada tipo.">
          <IndicadoresBarrasH :items="barras(datos.porVehiculo, 'camiones', 'camiones')" medida="camiones" :formato-eje="entero" :reserva="110" />
          <template #tabla><IndicadoresTabla :columnas="colsGrupo('Vehículo')" :filas="filasGrupo(datos.porVehiculo)" principal="clave" /></template>
        </IndicadoresTarjeta>
      </div>

      <div class="dos bloque">
        <IndicadoresTarjeta titulo="Origen de las órdenes" subtitulo="De Cargue Gourmet, de Muebles, de los dos o sin registro.">
          <IndicadoresBarrasH :items="barras(datos.porOrigen, 'ordenes', 'órdenes')" medida="órdenes" :formato-eje="entero" :reserva="100" />
          <template #tabla><IndicadoresTabla :columnas="colsGrupo('Origen')" :filas="filasGrupo(datos.porOrigen)" principal="clave" /></template>
        </IndicadoresTarjeta>
        <IndicadoresTarjeta titulo="Hora de inicio de los camiones" subtitulo="A qué hora del día arranca cada cargue.">
          <IndicadoresBarrasH :items="barrasHora" medida="camiones" :formato-eje="entero" :reserva="110" />
          <template #tabla><IndicadoresTabla :columnas="colsHora" :filas="filasHora" principal="hora" /></template>
        </IndicadoresTarjeta>
      </div>

      <IndicadoresTarjeta
        class="bloque" titulo="Órdenes con novedad"
        :subtitulo="filasNov.length ? 'Bultos cargados que no cuadran con los declarados, con lo que se anotó.' : 'Todas las órdenes del periodo cuadraron.'"
      >
        <IndicadoresTabla v-if="filasNov.length" :columnas="colsNov" :filas="filasNov" principal="codigo" />
      </IndicadoresTarjeta>

      <IndicadoresTarjeta class="bloque" titulo="Camiones del periodo" subtitulo="Cada camión con su tiempo, órdenes, bultos y novedades.">
        <IndicadoresTabla :columnas="colsCamiones" :filas="filasCamiones" principal="transportadora" />
      </IndicadoresTarjeta>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 18px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }
.hero-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
.filtros { display: flex; align-items: flex-end; gap: 12px; padding: 12px 14px; margin-bottom: 16px; flex-wrap: wrap; }
.presets { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { padding: 7px 12px; border: 1px solid var(--border-strong); border-radius: var(--r-pill); background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; }
.chip.on { border-color: var(--brand); color: var(--ink); background: var(--brand-tint); }
.campo { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); }
.sub { margin: 0 0 10px; font-size: 12.5px; color: var(--muted); }
.cifras { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 18px; }
.bloque { margin-bottom: 18px; }
.dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; }
.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
@media (max-width: 720px) { .hero-title { font-size: 24px; } }
</style>
