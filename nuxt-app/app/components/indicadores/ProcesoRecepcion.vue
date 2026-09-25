<script setup lang="ts">
// Recepción de contenedores: cuánto tarda un contenedor en recibirse y
// almacenarse y con cuánta gente, clasificado por proveedor, tipo de
// contenedor, unidades, volumen y peso.
//
// El almacenamiento sale de Control Montacargas (mismo número de pedido) y
// existe desde el 24-09; antes solo hay descarga.
import { computed, ref } from 'vue'
import type { BarraH, ColumnaTabla } from '~/utils/indicadores'
import { fmtCifra, fmtDuracion, variacion, type GrupoRecepcionDTO, type RespuestaProcesos } from '~/utils/procesos'

const props = defineProps<{ recepcion: RespuestaProcesos['recepcion'] }>()

const g = computed(() => props.recepcion.actual.general)
const ant = computed(() => props.recepcion.anterior)

const cifras = computed(() => {
  const x = g.value
  if (!x) return []
  return [
    { label: 'Contenedores', valor: String(x.contenedores), cambio: variacion(x.contenedores, ant.value?.contenedores) },
    { label: 'Descarga promedio', valor: fmtDuracion(x.descargaMin), cambio: variacion(x.descargaMin, ant.value?.descargaMin, true) },
    {
      label: 'Almacenamiento promedio', valor: fmtDuracion(x.almacenamientoMin),
      hint: x.conAlmacenamiento ? `montacargas ubicando PLU · promedio de ${x.conAlmacenamiento} contenedor${x.conAlmacenamiento === 1 ? '' : "es"}` : 'se mide desde el 24-09',
      cambio: variacion(x.almacenamientoMin, ant.value?.almacenamientoMin, true),
    },
    // Sin sumar (25-09): el almacenamiento va en paralelo a la descarga. El tiempo
    // real es de abrir la descarga a ubicar el último PLU.
    { label: 'Tiempo real promedio', valor: fmtDuracion(x.cicloMin), hint: 'de abrir la descarga al último PLU ubicado', cambio: variacion(x.cicloMin, ant.value?.cicloMin, true) },
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

// La barra es el tiempo real si el contenedor quedó todo ubicado; si no, la descarga.
const barras = computed<BarraH[]>(() => grupos.value.map((x) => ({
  id: x.clave,
  etiqueta: x.clave,
  valor: x.cicloMin ?? x.descargaMin,
  texto: `${fmtDuracion(x.cicloMin ?? x.descargaMin)} · ${x.contenedores} cont.`,
  detalle: [
    { etiqueta: 'Descarga', valor: fmtDuracion(x.descargaMin) },
    { etiqueta: 'Almacenamiento', valor: fmtDuracion(x.almacenamientoMin) },
    { etiqueta: 'Tiempo real', valor: fmtDuracion(x.cicloMin) },
    { etiqueta: 'Personas', valor: fmtCifra(x.personas) },
  ],
})))

const cols: ColumnaTabla[] = [
  { key: 'clave', label: 'Grupo' },
  { key: 'n', label: 'Contenedores', num: true },
  { key: 'descarga', label: 'Descarga', num: true },
  { key: 'alm', label: 'Almacenamiento', num: true },
  { key: 'ciclo', label: 'Tiempo real', num: true },
  { key: 'personas', label: 'Personas', num: true },
  { key: 'und', label: 'Unidades (prom.)', num: true },
  { key: 'm3', label: 'm³ (prom.)', num: true },
  { key: 'kg', label: 'kg (prom.)', num: true },
]
const filasDe = (l: GrupoRecepcionDTO[]) => l.map((x) => ({
  clave: x.clave,
  n: x.contenedores,
  descarga: fmtDuracion(x.descargaMin),
  alm: fmtDuracion(x.almacenamientoMin),
  ciclo: fmtDuracion(x.cicloMin),
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
      subtitulo="Promedio por grupo. El almacenamiento (montacargas, mismo pedido, desde el 24-09) va en paralelo a la descarga, así que no se suman: tiempo real = de abrir la descarga al último PLU ubicado. Sin almacenamiento se muestra la descarga."
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
