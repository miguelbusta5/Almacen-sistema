<script setup lang="ts">
// Recepción de contenedores: cuánto tarda un contenedor en recibirse y
// almacenarse y con cuánta gente, clasificado por proveedor, tipo de
// contenedor, unidades, volumen y peso.
//
// El almacenamiento sale de Control Montacargas (mismo número de pedido) y
// existe desde el 24-09; antes solo hay descarga.
import { computed, ref } from 'vue'
import type { BarraH, ColumnaTabla } from '~/utils/indicadores'
import { fmtCifra, fmtDuracion, fmtTiempoExacto, variacion, type GrupoRecepcionDTO, type RespuestaProcesos } from '~/utils/procesos'

const props = defineProps<{ recepcion: RespuestaProcesos['recepcion'] }>()

const g = computed(() => props.recepcion.actual.general)
const ant = computed(() => props.recepcion.anterior)

const cifras = computed(() => {
  const x = g.value
  if (!x) return []
  return [
    { label: 'Contenedores', valor: String(x.contenedores), cambio: variacion(x.contenedores, ant.value?.contenedores) },
    // UN solo tiempo para la dirección (25-09): de abrir la descarga a dejar el
    // último PLU ubicado, al segundo. Sus dos partes suman exacto el total.
    {
      label: 'Tiempo de recepción promedio', valor: fmtTiempoExacto(x.tiempoTotalSeg),
      hint: x.completos ? `de abrir la descarga al último PLU ubicado · ${x.completos} contenedor${x.completos === 1 ? '' : 'es'}` : 'sin contenedores completos (con todos sus PLU ubicados)',
      cambio: variacion(x.tiempoTotalSeg, ant.value?.tiempoTotalSeg, true),
    },
    {
      label: 'Descarga', valor: fmtTiempoExacto(x.tiempoDescargaSeg), hint: 'abrir y cerrar la planilla, sin pausas',
      cambio: variacion(x.tiempoDescargaSeg, ant.value?.tiempoDescargaSeg, true),
    },
    {
      label: 'Almacenamiento tras la descarga', valor: fmtTiempoExacto(x.tiempoColaSeg), hint: 'lo que faltaba ubicar al cerrar la descarga',
      cambio: variacion(x.tiempoColaSeg, ant.value?.tiempoColaSeg, true),
    },
    { label: 'Personas por contenedor', valor: fmtCifra(x.personas), hint: 'descargan + almacenan', cambio: variacion(x.personas, ant.value?.personas) },
  ]
})

const VISTAS = [
  { key: 'porProveedor', label: 'Proveedor' },
  { key: 'porTipo', label: 'Tipo de contenedor' },
  { key: 'porUnidades', label: 'Unidades' },
  { key: 'porVolumen', label: 'Volumen' },
  { key: 'porPeso', label: 'Peso' },
] as const
type Vista = (typeof VISTAS)[number]['key']
const vista = ref<Vista>('porProveedor')
const grupos = computed<GrupoRecepcionDTO[]>(() => props.recepcion.actual[vista.value])

// La barra es el tiempo de recepción; sin contenedores completos, solo la descarga.
const barras = computed<BarraH[]>(() => grupos.value.map((x) => ({
  id: x.clave,
  etiqueta: x.clave,
  valor: x.tiempoTotalSeg != null ? x.tiempoTotalSeg / 60 : x.descargaMin,
  texto: x.tiempoTotalSeg != null
    ? `${fmtTiempoExacto(x.tiempoTotalSeg)} · ${x.completos} cont.`
    : `${fmtTiempoExacto(x.descargaMin * 60)} (solo descarga) · ${x.contenedores} cont.`,
  detalle: [
    { etiqueta: 'Descarga', valor: fmtTiempoExacto(x.tiempoDescargaSeg) },
    { etiqueta: 'Almacenamiento tras la descarga', valor: fmtTiempoExacto(x.tiempoColaSeg) },
    { etiqueta: 'Personas', valor: fmtCifra(x.personas) },
  ],
})))

const cols: ColumnaTabla[] = [
  { key: 'clave', label: 'Grupo' },
  { key: 'n', label: 'Contenedores', num: true },
  { key: 'total', label: 'Tiempo de recepción', num: true },
  { key: 'descarga', label: 'Descarga', num: true },
  { key: 'cola', label: 'Almacenamiento tras la descarga', num: true },
  { key: 'personas', label: 'Personas', num: true },
  { key: 'und', label: 'Unidades (prom.)', num: true },
  { key: 'm3', label: 'm³ (prom.)', num: true },
  { key: 'kg', label: 'kg (prom.)', num: true },
]
const filasDe = (l: GrupoRecepcionDTO[]) => l.map((x) => ({
  clave: x.clave,
  n: x.contenedores,
  total: fmtTiempoExacto(x.tiempoTotalSeg),
  descarga: fmtTiempoExacto(x.tiempoDescargaSeg ?? x.descargaMin * 60),
  cola: fmtTiempoExacto(x.tiempoColaSeg),
  personas: fmtCifra(x.personas),
  und: fmtCifra(x.unidades),
  m3: fmtCifra(x.m3),
  kg: fmtCifra(x.kg),
}))
const filas = computed(() => filasDe(grupos.value))

defineExpose({
  hojas: () => VISTAS.map((v) => ({ nombre: `Recepción por ${v.label}`, columnas: cols, filas: filasDe(props.recepcion.actual[v.key]) })),
})
</script>

<template>
  <div>
    <div v-if="cifras.length" class="rc-cifras">
      <IndicadoresCifraProceso v-for="c in cifras" :key="c.label" v-bind="c" />
    </div>
    <p v-else class="rc-vacio">Sin contenedores cerrados en el periodo.</p>

    <IndicadoresTarjeta
      v-if="g" titulo="Tiempo por contenedor"
      subtitulo="Tiempo de recepción = de abrir la descarga a dejar el último PLU ubicado (montacargas, mismo pedido), sin pausas. Es la suma exacta de la descarga y el almacenamiento que quedaba al cerrarla. Promedio por grupo."
    >
      <div class="rc-vistas" role="tablist" aria-label="Clasificar por">
        <button
          v-for="v in VISTAS" :key="v.key" type="button" class="chip" role="tab"
          :class="{ on: vista === v.key }" :aria-selected="vista === v.key" @click="vista = v.key"
        >
          {{ v.label }}
        </button>
      </div>
      <IndicadoresBarrasH
        :items="barras" medida="tiempo por contenedor" :formato-eje="(v: number) => fmtDuracion(v)"
        :reserva="150" :ancho-etiqueta="170"
      />
      <div class="rc-tabla"><IndicadoresTabla :columnas="cols" :filas="filas" principal="clave" /></div>
      <template #tabla>
        <IndicadoresTabla :columnas="cols" :filas="filas" principal="clave" />
      </template>
    </IndicadoresTarjeta>
  </div>
</template>

<style scoped>
.rc-cifras { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px; }
.rc-vacio { padding: 28px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.rc-vistas { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.chip { padding: 6px 12px; border-radius: var(--r-pill); border: 1px solid var(--border-strong); background: var(--surface); font-size: 12px; font-weight: 600; color: var(--muted); cursor: pointer; }
.chip.on { color: var(--brand); border-color: var(--brand); background: var(--brand-tint); }
.rc-tabla { margin: 14px -18px -18px; border-top: 1px solid var(--border); overflow-x: auto; }
</style>
