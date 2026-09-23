<script setup lang="ts">
// Tareas generales: cuánto tiempo se va por día en lo que manda supervisión
// fuera de los módulos (aseo, patinador, saneamiento…). Recortado al turno + 1 h.
import { computed } from 'vue'
import { fmtDiaCorto, type BarraH, type ColumnaTabla } from '~/utils/indicadores'
import { fmtDuracion, variacion, type RespuestaProcesos } from '~/utils/procesos'

const props = defineProps<{ generales: RespuestaProcesos['generales'] }>()
const a = computed(() => props.generales.actual)
const ant = computed(() => props.generales.anterior)
const min = (seg: number) => seg / 60

const cifras = computed(() => [
  {
    label: 'Por persona al día', valor: fmtDuracion(min(a.value.personaDiaSeg)),
    hint: 'en los días que tuvo alguna', cambio: variacion(a.value.personaDiaSeg, ant.value.personaDiaSeg, true),
  },
  {
    label: 'Todo el equipo al día', valor: fmtDuracion(min(a.value.equipoDiaSeg)),
    hint: `${a.value.dias} días con tareas generales`, cambio: variacion(a.value.equipoDiaSeg, ant.value.equipoDiaSeg, true),
  },
  { label: 'Total del periodo', valor: fmtDuracion(min(a.value.segundos)), cambio: variacion(a.value.segundos, ant.value.segundos, true) },
])

const barras = computed<BarraH[]>(() => a.value.personas.map((p) => ({
  id: p.usuarioId, etiqueta: p.nombre, valor: min(p.porDiaSeg),
  texto: `${fmtDuracion(min(p.porDiaSeg))}/día`,
  detalle: [{ etiqueta: 'Días', valor: String(p.dias) }, { etiqueta: 'Tareas', valor: String(p.tareas) }],
})))

const colsPersonas: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'dias', label: 'Días', num: true },
  { key: 'porDia', label: 'Por día', num: true },
  { key: 'total', label: 'Total', num: true },
  { key: 'tareas', label: 'Tareas', num: true },
]
const filasPersonas = computed(() => a.value.personas.map((p) => ({
  nombre: p.nombre, dias: p.dias, porDia: fmtDuracion(min(p.porDiaSeg)), total: fmtDuracion(min(p.segundos)), tareas: p.tareas,
})))
const colsDesc: ColumnaTabla[] = [
  { key: 'descripcion', label: 'Tarea' },
  { key: 'veces', label: 'Veces', num: true },
  { key: 'personas', label: 'Personas', num: true },
  { key: 'tiempo', label: 'Tiempo total', num: true },
]
const filasDesc = computed(() => a.value.porDescripcion.map((d) => ({
  descripcion: d.descripcion, veces: d.veces, personas: d.personas, tiempo: fmtDuracion(min(d.segundos)),
})))
const colsDia: ColumnaTabla[] = [
  { key: 'dia', label: 'Día' },
  { key: 'tiempo', label: 'Tiempo', num: true },
  { key: 'personas', label: 'Personas', num: true },
]
const filasDia = computed(() => [...a.value.serie].reverse().map((d) => ({
  dia: fmtDiaCorto(d.dia), tiempo: fmtDuracion(min(d.segundos)), personas: d.personas,
})))

defineExpose({
  hojas: () => [
    { nombre: 'Tareas generales por persona', columnas: colsPersonas, filas: filasPersonas.value },
    { nombre: 'Tareas generales por tarea', columnas: colsDesc, filas: filasDesc.value },
    { nombre: 'Tareas generales por día', columnas: colsDia, filas: filasDia.value },
  ],
})
</script>

<template>
  <div>
    <div class="tg-cifras">
      <IndicadoresCifraProceso v-for="c in cifras" :key="c.label" v-bind="c" />
    </div>
    <p v-if="!a.segundos" class="tg-vacio">Sin tareas generales cerradas en el periodo.</p>
    <template v-else>
      <IndicadoresTarjeta class="bloque" titulo="Tiempo en tareas generales por persona" subtitulo="Por día en que tuvo alguna. Se cuenta hasta el fin del turno + 1 h.">
        <IndicadoresBarrasH :items="barras" medida="por día" :formato-eje="(v: number) => fmtDuracion(v)" :reserva="110" />
        <template #tabla><IndicadoresTabla :columnas="colsPersonas" :filas="filasPersonas" principal="nombre" /></template>
      </IndicadoresTarjeta>
      <div class="dos">
        <IndicadoresTarjeta titulo="En qué se va el tiempo" subtitulo="Las tareas que más tiempo tomaron.">
          <div class="tg-tabla"><IndicadoresTabla :columnas="colsDesc" :filas="filasDesc.slice(0, 10)" principal="descripcion" /></div>
          <template #tabla><IndicadoresTabla :columnas="colsDesc" :filas="filasDesc" principal="descripcion" /></template>
        </IndicadoresTarjeta>
        <IndicadoresTarjeta titulo="Por día" subtitulo="Tiempo del equipo en tareas generales cada día.">
          <IndicadoresLineaDiaria
            :puntos="a.serie.map((d) => ({ dia: d.dia, valor: d.segundos / 3600 }))"
            :formato="(v: number) => fmtDuracion(v * 60)" etiqueta="Horas" :alto="170"
          />
          <template #tabla><IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="dia" /></template>
        </IndicadoresTarjeta>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tg-cifras { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 18px; }
.tg-vacio { padding: 28px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.tg-tabla { margin: 0 -18px -18px; border-top: 1px solid var(--border); overflow-x: auto; }
.bloque { margin-bottom: 18px; }
.dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; margin-bottom: 18px; }
</style>
