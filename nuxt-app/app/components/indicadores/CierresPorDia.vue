<script setup lang="ts">
// Cuántas tareas de resurtido (por capacidad), pendientes y movimientos de
// Control Montacargas cierra cada persona por día, y la proyección de un turno a
// partir de eso. La recepción no entra: su medida es el contenedor.
//
// Una tarea cuenta para QUIEN LA CERRÓ. Si otro la había empezado, a ese le
// suma en «Iniciadas y pasadas», que no entra en el total: así el total del
// día es el número real de tareas terminadas, y se ve igual quién arranca para
// que otro termine (el operario y su ayudante).
import { computed } from 'vue'
import {
  fmtDiaCorto,
  type BarraH, type CierresDiaPersona, type ColumnaTabla, type ProyeccionPersona,
} from '~/utils/indicadores'

const props = defineProps<{
  cierres: CierresDiaPersona[]
  proyeccion: ProyeccionPersona[]
}>()

const dec = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 })

// ── Proyección: promedio por día trabajado ──
const barras = computed<BarraH[]>(() => props.proyeccion
  .filter((p) => p.totalDia > 0)
  .map((p) => ({
    id: p.usuarioId,
    etiqueta: p.nombre,
    valor: p.totalDia,
    // Los días van a la vista: un promedio de 1 día no pesa lo mismo que uno de 6.
    texto: `${dec(p.totalDia)} / día · ${p.dias} ${p.dias === 1 ? 'día' : 'días'}`,
    detalle: [
      { etiqueta: 'Tareas de resurtido / día', valor: dec(p.tareasDia) },
      { etiqueta: 'Pendientes / día', valor: dec(p.pendientesDia) },
      { etiqueta: 'Movimientos / día', valor: dec(p.movimientosDia) },
      { etiqueta: 'Iniciadas y pasadas / día', valor: dec(p.pasadasDia) },
      { etiqueta: 'Mejor día', valor: String(p.maxTotal) },
      { etiqueta: 'Días trabajados', valor: String(p.dias) },
    ],
  })))

const colsProyeccion: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'dias', label: 'Días trabajados', num: true },
  { key: 'tareasDia', label: 'Tareas / día', num: true },
  { key: 'pendientesDia', label: 'Pendientes / día', num: true },
  { key: 'movimientosDia', label: 'Movimientos / día', num: true },
  { key: 'totalDia', label: 'Total / día', num: true },
  { key: 'maxTotal', label: 'Mejor día', num: true },
  { key: 'pasadasDia', label: 'Iniciadas y pasadas / día', num: true },
]
const filasProyeccion = computed(() => props.proyeccion.map((p) => ({
  nombre: p.nombre,
  dias: p.dias,
  tareasDia: dec(p.tareasDia),
  pendientesDia: dec(p.pendientesDia),
  movimientosDia: dec(p.movimientosDia),
  totalDia: dec(p.totalDia),
  maxTotal: p.maxTotal,
  pasadasDia: dec(p.pasadasDia),
})))

// El equipo junto: cuánto se cierra en un día típico entre todos.
const equipoDia = computed(() => {
  const porDia = new Map<string, number>()
  for (const c of props.cierres) porDia.set(c.dia, (porDia.get(c.dia) ?? 0) + c.total)
  const dias = [...porDia.values()].filter((n) => n > 0)
  return dias.length ? { promedio: dias.reduce((s, n) => s + n, 0) / dias.length, dias: dias.length } : null
})

// ── Detalle por día ──
const colsDia: ColumnaTabla[] = [
  { key: 'dia', label: 'Día' },
  { key: 'nombre', label: 'Persona' },
  { key: 'tareas', label: 'Tareas', num: true },
  { key: 'pendientes', label: 'Pendientes', num: true },
  { key: 'movimientos', label: 'Movimientos', num: true },
  { key: 'total', label: 'Total cerradas', num: true },
  { key: 'pasadas', label: 'Iniciadas y pasadas', num: true },
]
const filasDia = computed(() => props.cierres.map((c) => ({
  dia: fmtDiaCorto(c.dia),
  nombre: c.nombre,
  tareas: c.tareas,
  pendientes: c.pendientes,
  movimientos: c.movimientos,
  total: c.total,
  pasadas: c.pasadas,
})))
</script>

<template>
  <div class="cpd">
    <IndicadoresTarjeta
      titulo="Proyección diaria"
      subtitulo="Tareas de resurtido, pendientes y movimientos de Control Montacargas que cierra cada persona en un día trabajado. Es lo que se puede esperar de un turno."
    >
      <p v-if="equipoDia" class="cpd-equipo">
        Entre todos: <b class="tnum">{{ dec(equipoDia.promedio) }}</b> cerradas por día
        <span class="cpd-muted">(promedio de {{ equipoDia.dias }} {{ equipoDia.dias === 1 ? 'día' : 'días' }})</span>
      </p>
      <IndicadoresBarrasH
        v-if="barras.length" :items="barras" medida="cerradas por día"
        :formato-eje="(v: number) => dec(v)" :reserva="130"
      />
      <p v-else class="cpd-muted">Nadie cerró tareas, pendientes ni movimientos en el periodo.</p>
      <p class="cpd-regla">
        Cada tarea cuenta para quien la terminó. Si otro la había empezado, a ese le suma en
        «Iniciadas y pasadas», que no entra en el total.
      </p>
      <template #tabla>
        <IndicadoresTabla :columnas="colsProyeccion" :filas="filasProyeccion" principal="nombre" />
      </template>
    </IndicadoresTarjeta>

    <IndicadoresTarjeta
      v-if="cierres.length"
      titulo="Cierres por día"
      subtitulo="Lo que terminó cada persona cada día de turno. La madrugada del turno de noche cuenta para el día en que empezó."
    >
      <div class="cpd-tabla">
        <IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="nombre" />
      </div>
      <template #tabla>
        <IndicadoresTabla :columnas="colsDia" :filas="filasDia" principal="nombre" />
      </template>
    </IndicadoresTarjeta>
  </div>
</template>

<style scoped>
.cpd { display: grid; gap: 18px; }
.cpd-equipo { margin: 0 0 12px; font-size: 13px; color: var(--ink-2); }
.cpd-equipo b { font-size: 16px; color: var(--ink); }
.cpd-muted { color: var(--muted); font-size: 12.5px; }
.cpd-regla { margin: 12px 0 0; font-size: 12px; color: var(--muted); max-width: 80ch; }
.cpd-tabla { max-height: 420px; overflow: auto; margin: 0 -18px -18px; border-top: 1px solid var(--border); }
</style>
