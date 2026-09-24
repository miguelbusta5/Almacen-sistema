<script setup lang="ts">
// Evolución día a día, una gráfica por persona.
//
// Por persona y no del equipo: sumar las horas de todos da mucho más de lo que
// dura un turno y no se puede leer. Una gráfica pequeña por cada uno deja
// comparar de un vistazo quién sube y quién baja, con el mismo eje para todos.
import { computed } from 'vue'
import { fmtTiempo } from '~/utils/montacargas'
import {
  fmtDiaCorto, fmtHorasDecimal, fmtNumero, type ColumnaTabla, type IndicadorPersona,
} from '~/utils/indicadores'

const props = defineProps<{ personas: IndicadorPersona[]; unidades?: boolean }>()

const dias = computed(() => props.personas[0]?.porDia.map((d) => d.dia) ?? [])
const valor = (d: { segundos: number; unidades: number }) => (props.unidades ? d.unidades : d.segundos)
// Mismo tope para todas: si cada una se escala a lo suyo, dos gráficas iguales
// dicen cosas distintas.
const tope = computed(() => Math.max(0, ...props.personas.flatMap((p) => p.porDia.map(valor))))
const formato = (v: number) => (props.unidades ? fmtNumero(v) : fmtTiempo(v))

const columnas = computed<ColumnaTabla[]>(() => [
  { key: 'nombre', label: 'Persona' },
  ...dias.value.map((d) => ({ key: d, label: fmtDiaCorto(d), num: true })),
])
const tabla = computed(() => props.personas.map((p) => ({
  nombre: p.nombre,
  ...Object.fromEntries(p.porDia.map((d) => [d.dia, valor(d) ? formato(valor(d)) : '—'])),
})))
</script>

<template>
  <IndicadoresTarjeta
    :titulo="unidades ? 'Unidades por día y persona' : 'Tiempo laborado por día y persona'"
    subtitulo="Cada persona con su propia línea y el mismo eje, para poder compararlas."
  >
    <div v-if="dias.length > 1" class="rejilla">
      <div v-for="p in personas" :key="p.id" class="mini">
        <h4 class="mini-titulo" :title="p.nombre">{{ p.nombre }}</h4>
        <IndicadoresLineaDiaria
          :puntos="p.porDia.map((d) => ({ dia: d.dia, valor: unidades ? d.unidades : d.segundos }))"
          :etiqueta="unidades ? 'unidades' : 'tiempo laborado'" :serie="p.nombre"
          :formato="formato"
          :formato-fin="unidades ? fmtNumero : fmtHorasDecimal"
          :escala-eje="unidades ? 1 : 3600"
          :sufijo-eje="unidades ? '' : ' h'"
          :maximo="tope"
          :alto="140"
        />
      </div>
    </div>
    <p v-else class="aviso">Con un solo día no hay evolución que ver: elige 7 o 30 días.</p>

    <template #tabla>
      <IndicadoresTabla :columnas="columnas" :filas="tabla" principal="nombre" />
    </template>
  </IndicadoresTarjeta>
</template>

<style scoped>
.rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px 18px; }
.mini { min-width: 0; }
.mini-titulo {
  margin: 0 0 2px; font-family: inherit; font-size: 12.5px; font-weight: 700; letter-spacing: 0;
  color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.aviso { margin: 8px 0; font-size: 13px; color: var(--muted); }
</style>
