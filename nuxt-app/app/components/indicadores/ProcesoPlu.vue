<script setup lang="ts">
// Un proceso que se mide por PLU cerrado (movimientos, pendientes, resurtido):
// cuánto cierra una persona en un día trabajado, en PLU, unidades, m³ y kg;
// el equipo junto; cada operario frente a la meta; y los PLU que más salen.
import { computed } from 'vue'
import { fmtDiaCorto, type BarraH, type ColumnaTabla } from '~/utils/indicadores'
import {
  SEMAFORO_META_COLOR, SEMAFORO_META_LABEL, fmtCifra, fmtKgProceso, fmtM3Proceso, variacion, type ProcesoDTO,
} from '~/utils/procesos'

// Vue toma como false un booleano que no se pasa: el top va por defecto.
const props = withDefaults(defineProps<{
  proceso: ProcesoDTO
  titulo: string
  /** Qué se cierra: "movimientos", "pendientes", "tareas". */
  que: string
  /** Mostrar el top de PLU (en pendientes se usa el de solicitados). */
  conTop?: boolean
  /** Quién cierra: "operario" o "inspector". */
  persona?: string
  tituloTop?: string
}>(), { conTop: true, persona: 'operario', tituloTop: 'PLU que más salen' })

const a = computed(() => props.proceso.actual)
const ant = computed(() => props.proceso.anterior)
const meta = computed(() => props.proceso.meta)

const cifras = computed(() => [
  {
    label: 'PLU por persona al día', valor: fmtCifra(a.value.personaDia.plus),
    hint: `el equipo junto: ${fmtCifra(a.value.equipoDia.plus)} por día`,
    cambio: variacion(a.value.personaDia.plus, ant.value.personaDia.plus),
    meta: meta.value ? `${fmtCifra(meta.value.plus)} PLU (día típico)` : null,
  },
  {
    label: 'Unidades por persona al día', valor: fmtCifra(a.value.personaDia.unidades),
    hint: `el equipo junto: ${fmtCifra(a.value.equipoDia.unidades)} por día`,
    cambio: variacion(a.value.personaDia.unidades, ant.value.personaDia.unidades),
    meta: meta.value ? `${fmtCifra(meta.value.unidades)} und` : null,
  },
  {
    label: 'Volumen por persona al día', valor: fmtM3Proceso(a.value.personaDia.m3),
    hint: `equipo: ${fmtM3Proceso(a.value.equipoDia.m3)} por día`,
    cambio: variacion(a.value.personaDia.m3, ant.value.personaDia.m3),
  },
  {
    label: 'Peso por persona al día', valor: fmtKgProceso(a.value.personaDia.kg),
    hint: `equipo: ${fmtKgProceso(a.value.equipoDia.kg)} por día`,
    cambio: variacion(a.value.personaDia.kg, ant.value.personaDia.kg),
  },
])

const barras = computed<BarraH[]>(() => a.value.personas.map((p) => ({
  id: p.usuarioId,
  etiqueta: p.nombre,
  valor: p.porDia.plus,
  texto: `${fmtCifra(p.porDia.plus)} PLU/día`,
  color: p.semaforo ? SEMAFORO_META_COLOR[p.semaforo] : undefined,
  detalle: [
    { etiqueta: 'Unidades por día', valor: fmtCifra(p.porDia.unidades) },
    { etiqueta: 'm³ por día', valor: fmtM3Proceso(p.porDia.m3) },
    { etiqueta: 'kg por día', valor: fmtKgProceso(p.porDia.kg) },
    { etiqueta: 'Días trabajados', valor: String(p.dias) },
    ...(p.semaforo ? [{ etiqueta: 'Meta', valor: SEMAFORO_META_LABEL[p.semaforo] }] : []),
  ],
})))

const colsPersonas: ColumnaTabla[] = [
  { key: 'nombre', label: props.persona.charAt(0).toUpperCase() + props.persona.slice(1) },
  { key: 'dias', label: 'Días', num: true },
  { key: 'plus', label: 'PLU / día', num: true },
  { key: 'unidades', label: 'Unidades / día', num: true },
  { key: 'm3', label: 'm³ / día', num: true },
  { key: 'kg', label: 'kg / día', num: true },
  { key: 'totalPlus', label: 'PLU en el periodo', num: true },
  { key: 'meta', label: 'Meta' },
]
const filasPersonas = computed(() => a.value.personas.map((p) => ({
  nombre: p.nombre,
  dias: p.dias,
  plus: fmtCifra(p.porDia.plus),
  unidades: fmtCifra(p.porDia.unidades),
  m3: fmtCifra(p.porDia.m3),
  kg: fmtCifra(p.porDia.kg),
  totalPlus: p.total.plus,
  meta: p.semaforo ? SEMAFORO_META_LABEL[p.semaforo] : '—',
})))

const colsDia: ColumnaTabla[] = [
  { key: 'dia', label: 'Día' },
  { key: 'plus', label: 'PLU', num: true },
  { key: 'unidades', label: 'Unidades', num: true },
  { key: 'm3', label: 'm³', num: true },
  { key: 'kg', label: 'kg', num: true },
]
const filasDia = computed(() => [...a.value.serie].reverse().map((d) => ({
  dia: fmtDiaCorto(d.dia), plus: d.plus, unidades: fmtCifra(d.unidades), m3: fmtCifra(d.m3), kg: fmtCifra(d.kg),
})))

const colsTop: ColumnaTabla[] = [
  { key: 'plu', label: 'PLU' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'veces', label: 'Veces', num: true },
  { key: 'unidades', label: 'Unidades', num: true },
]
const filasTop = computed(() => a.value.topPlus.map((t) => ({
  plu: t.plu, descripcion: t.descripcion ?? '—', veces: t.veces, unidades: fmtCifra(t.unidades),
})))

defineExpose({
  hojas: () => [
    { nombre: `${props.titulo} por ${props.persona}`, columnas: colsPersonas, filas: filasPersonas.value },
    { nombre: `${props.titulo} por día`, columnas: colsDia, filas: filasDia.value },
    ...(props.conTop ? [{ nombre: `${props.titulo} PLU`, columnas: colsTop, filas: filasTop.value }] : []),
  ],
})
</script>

<template>
  <div class="pp">
    <div class="pp-cifras">
      <IndicadoresCifraProceso v-for="c in cifras" :key="c.label" v-bind="c" />
    </div>

    <p v-if="!a.total.plus" class="pp-vacio">Sin {{ que }} cerrados en el periodo.</p>
    <template v-else>
      <IndicadoresTarjeta
        class="bloque" :titulo="`${titulo} por ${persona}`"
        :subtitulo="`PLU por día trabajado. ${meta ? `Verde: llega al día típico del equipo (${fmtCifra(meta.plus)} PLU); amarillo: 80 % o más; rojo: debajo.` : 'Sin meta todavía: faltan 4 semanas de historia.'}`"
      >
        <IndicadoresBarrasH :items="barras" medida="PLU por día" :formato-eje="(v: number) => fmtCifra(v)" :reserva="110" />
        <p v-if="a.sinMedida" class="pp-nota">
          {{ a.sinMedida }} {{ a.sinMedida === 1 ? 'cierre no tiene' : 'cierres no tienen' }} medidas en el maestro: no suman m³ ni kg.
        </p>
        <p class="pp-nota">
          Un registro cuenta completo a todos los que lo tuvieron (el que lo empezó y el que lo terminó). Por eso
          la suma de las personas puede ser mayor que lo del equipo, que cuenta cada registro una vez.
        </p>
        <template #tabla>
          <IndicadoresTabla :columnas="colsPersonas" :filas="filasPersonas" principal="nombre" />
        </template>
      </IndicadoresTarjeta>

      <div class="dos">
        <IndicadoresTarjeta :titulo="`${titulo} por día`" subtitulo="Lo que cerró el equipo cada día.">
          <IndicadoresLineaDiaria
            :puntos="a.serie.map((d) => ({ dia: d.dia, valor: d.plus }))" :formato="(v: number) => `${fmtCifra(v)} PLU`"
            etiqueta="PLU" :alto="170"
          />
          <template #tabla>
            <IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="dia" />
          </template>
        </IndicadoresTarjeta>
        <IndicadoresTarjeta v-if="conTop" :titulo="tituloTop" subtitulo="Veces que se cerró cada PLU en el periodo.">
          <div class="pp-tabla"><IndicadoresTabla :columnas="colsTop" :filas="filasTop.slice(0, 10)" principal="plu" /></div>
          <template #tabla>
            <IndicadoresTabla :columnas="colsTop" :filas="filasTop" principal="plu" />
          </template>
        </IndicadoresTarjeta>
        <slot name="extra" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.pp-cifras { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 18px; }
.pp-vacio { padding: 28px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.pp-nota { margin: 10px 0 0; font-size: 12px; color: var(--muted); }
.pp-tabla { margin: 0 -18px -18px; border-top: 1px solid var(--border); overflow-x: auto; }
.bloque { margin-bottom: 18px; }
.dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; margin-bottom: 18px; }
</style>
