<script setup lang="ts">
// Tiempos muertos: los ratos sin ningun PLU en la mano dentro del dia de cada
// persona, y la lista donde supervision los justifica.
//
// El tiempo muerto no se guarda, se calcula de los tramos; lo que se guarda es
// la justificacion. Por eso, si un PLU se borra despues y el hueco crece, lo
// nuevo vuelve a aparecer por justificar.
import { computed, ref, watch } from 'vue'
import { CheckCircle2, Clock, XCircle } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { fmtTiempo } from '~/utils/montacargas'
import {
  API_TIEMPOS_MUERTOS, ejeDeTiempo, ESTADO_TIEMPO_MUERTO_LABEL, ESTADOS_TIEMPO_MUERTO, fmtDiaCorto,
  fmtHora, fmtNumero, fmtPorcentaje, MOTIVO_TIEMPO_MUERTO_LABEL, ROL_MEDIDO_LABEL,
  type BarraH, type ColumnaTabla, type FilaApilada, type TiempoMuertoDetalle, type TiemposMuertosPeriodo,
} from '~/utils/indicadores'

const props = defineProps<{ muertos: TiemposMuertosPeriodo }>()
const emit = defineEmits<{ (e: 'actualizar'): void }>()
const { show: showToast } = useToast()

const r = computed(() => props.muertos.resumen)
const minimoMin = computed(() => Math.round(props.muertos.minimoSegundos / 60))
const maximoHoras = computed(() => Math.round(props.muertos.maximoSegundos / 3600))

const tiles = computed(() => [
  { key: 'total', label: 'Tiempo muerto', valor: fmtTiempo(r.value.segundos), hint: `${fmtNumero(r.value.cantidad)} rato${r.value.cantidad !== 1 ? 's' : ''}`, color: null },
  { key: 'pendiente', label: 'Por justificar', valor: fmtTiempo(r.value.pendientes), hint: `${fmtNumero(r.value.cantidadPendientes)} por revisar`, color: 'var(--viz-por-justificar)' },
  { key: 'justificado', label: 'Justificado', valor: fmtTiempo(r.value.justificados), hint: fmtPorcentaje(r.value.justificados, r.value.segundos), color: 'var(--viz-justificado)' },
  { key: 'sin', label: 'Sin justificación', valor: fmtTiempo(r.value.sinJustificacion), hint: 'revisado como tiempo perdido', color: 'var(--viz-sin-justificar)' },
])

// ── Por persona ────────────────────────────────────────────────────
const ejePersonas = computed(() => ejeDeTiempo(Math.max(0, ...props.muertos.personas.map((p) => p.segundos))))
const valorEstado = (p: TiemposMuertosPeriodo['personas'][number], k: string) =>
  k === 'pendiente' ? p.pendientes : k === 'justificado' ? p.justificados : p.sinJustificacion
const filasPersonas = computed<FilaApilada[]>(() => props.muertos.personas.map((p) => ({
  id: p.id,
  etiqueta: p.nombre,
  total: p.segundos,
  texto: fmtTiempo(p.segundos),
  segmentos: ESTADOS_TIEMPO_MUERTO.map((e) => ({ key: e.key, valor: valorEstado(p, e.key), color: e.color })),
  tooltip: [
    ...ESTADOS_TIEMPO_MUERTO.filter((e) => valorEstado(p, e.key) > 0).map((e) => ({
      color: e.color, etiqueta: e.label.toLowerCase(), valor: fmtTiempo(valorEstado(p, e.key)),
    })),
    { etiqueta: `en ${p.cantidad} rato${p.cantidad !== 1 ? 's' : ''}`, valor: fmtTiempo(p.segundos) },
  ],
})))
const columnasPersonas: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'rol', label: 'Rol' },
  { key: 'total', label: 'Tiempo muerto', num: true },
  { key: 'ratos', label: 'Ratos', num: true },
  { key: 'pend', label: 'Por justificar', num: true },
  { key: 'just', label: 'Justificado', num: true },
  { key: 'sin', label: 'Sin justificación', num: true },
]
const tablaPersonas = computed(() => props.muertos.personas.map((p) => ({
  nombre: p.nombre,
  rol: ROL_MEDIDO_LABEL[p.rol] ?? p.rol,
  total: fmtTiempo(p.segundos),
  ratos: fmtNumero(p.cantidad),
  pend: p.pendientes ? fmtTiempo(p.pendientes) : '—',
  just: p.justificados ? fmtTiempo(p.justificados) : '—',
  sin: p.sinJustificacion ? fmtTiempo(p.sinJustificacion) : '—',
})))

// ── Por motivo ─────────────────────────────────────────────────────
const revisado = computed(() => props.muertos.porMotivo.reduce((s, m) => s + m.segundos, 0))
const ejeMotivos = computed(() => ejeDeTiempo(Math.max(0, ...props.muertos.porMotivo.map((m) => m.segundos))))
const barrasMotivo = computed<BarraH[]>(() => props.muertos.porMotivo.map((m) => ({
  id: m.motivo,
  etiqueta: MOTIVO_TIEMPO_MUERTO_LABEL[m.motivo],
  valor: m.segundos,
  texto: `${fmtTiempo(m.segundos)} · ${fmtPorcentaje(m.segundos, revisado.value)}`,
  // El color dice el estado, igual que en el grafico por persona.
  color: m.motivo === 'SIN_JUSTIFICACION' ? 'var(--viz-sin-justificar)' : 'var(--viz-justificado)',
})))
const columnasMotivo: ColumnaTabla[] = [
  { key: 'motivo', label: 'Motivo' },
  { key: 'tiempo', label: 'Tiempo', num: true },
  { key: 'pct', label: '% de lo revisado', num: true },
]
const tablaMotivo = computed(() => props.muertos.porMotivo.map((m) => ({
  motivo: MOTIVO_TIEMPO_MUERTO_LABEL[m.motivo],
  tiempo: fmtTiempo(m.segundos),
  pct: fmtPorcentaje(m.segundos, revisado.value),
})))

// ── Lista para justificar ──────────────────────────────────────────
const filtro = ref<'pendientes' | 'todos'>(r.value.cantidadPendientes > 0 ? 'pendientes' : 'todos')
const visibles = computed(() => props.muertos.tramos.filter((t) => filtro.value === 'todos' || t.estado === 'pendiente'))
const clave = (t: TiempoMuertoDetalle) => `${t.usuarioId}|${t.inicio}`

const seleccion = ref(new Set<string>())
// Al recargar (tras justificar) o cambiar de filtro, la seleccion vieja ya no
// apunta a lo que se ve.
watch([() => props.muertos, filtro], () => { seleccion.value = new Set() })
const seleccionados = computed(() => visibles.value.filter((t) => seleccion.value.has(clave(t))))
const todosMarcados = computed(() => visibles.value.length > 0 && seleccionados.value.length === visibles.value.length)
function alternar(t: TiempoMuertoDetalle) {
  const s = new Set(seleccion.value)
  if (s.has(clave(t))) s.delete(clave(t))
  else s.add(clave(t))
  seleccion.value = s
}
function alternarTodos() {
  seleccion.value = todosMarcados.value ? new Set() : new Set(visibles.value.map(clave))
}

const justificando = ref<TiempoMuertoDetalle[] | null>(null)
function alJustificar() {
  justificando.value = null
  emit('actualizar')
}

const quitando = ref<TiempoMuertoDetalle | null>(null)
const quitandoGuardar = ref(false)
async function quitar() {
  const id = quitando.value?.justificacion?.id
  if (!id) return
  quitandoGuardar.value = true
  try {
    await $fetch(`${API_TIEMPOS_MUERTOS}/${id}`, { method: 'DELETE' })
    showToast('Justificación quitada')
    quitando.value = null
    emit('actualizar')
  } catch (e) {
    showToast(apiErr(e, 'No se pudo quitar la justificación'), true)
  } finally {
    quitandoGuardar.value = false
  }
}

const ICONO = { pendiente: Clock, justificado: CheckCircle2, sin_justificacion: XCircle } as const
</script>

<template>
  <div class="tm">
    <p class="explica">
      Tiempo muerto: {{ minimoMin }} minutos o más sin ningún PLU en la mano entre un PLU y el siguiente del mismo turno.
      Un hueco de {{ maximoHoras }} horas o más se toma como cambio de turno. Lo de antes del primer PLU y después del
      último se sumará cuando carguemos los horarios de los turnos.
    </p>

    <div class="cifras">
      <div v-for="t in tiles" :key="t.key" class="kpi card">
        <span class="kpi-label">
          <span v-if="t.color" class="sw" :style="{ background: t.color }" />{{ t.label }}
        </span>
        <span class="kpi-valor">{{ t.valor }}</span>
        <span class="kpi-hint">{{ t.hint }}</span>
      </div>
    </div>

    <EmptyState
      v-if="r.cantidad === 0" title="Sin tiempos muertos"
      :description="`Nadie estuvo ${minimoMin} minutos o más sin un PLU en la mano en estas fechas.`"
    />

    <template v-else>
      <div class="dos bloque">
        <IndicadoresTarjeta titulo="Tiempo muerto por persona" subtitulo="Cuánto de ese tiempo ya tiene explicación.">
          <template #leyenda>
            <ul class="leyenda" aria-label="Estado">
              <li v-for="e in ESTADOS_TIEMPO_MUERTO" :key="e.key">
                <span class="sw" :style="{ background: e.color }" />{{ e.label }}
              </li>
            </ul>
          </template>
          <IndicadoresBarrasApiladas
            :filas="filasPersonas" :escala-eje="ejePersonas.escala" :formato-eje="ejePersonas.formato"
          />
          <template #tabla>
            <IndicadoresTabla :columnas="columnasPersonas" :filas="tablaPersonas" principal="nombre" />
          </template>
        </IndicadoresTarjeta>

        <IndicadoresTarjeta titulo="En qué se fue el tiempo muerto" subtitulo="Lo ya revisado, por motivo.">
          <IndicadoresBarrasH
            v-if="barrasMotivo.length" :items="barrasMotivo" medida="del tiempo revisado"
            :ancho-etiqueta="200" :reserva="130"
            :escala-eje="ejeMotivos.escala" :formato-eje="ejeMotivos.formato"
          />
          <p v-else class="aviso">Todavía no hay nada justificado en estas fechas.</p>
          <template #tabla>
            <IndicadoresTabla :columnas="columnasMotivo" :filas="tablaMotivo" principal="motivo" />
          </template>
        </IndicadoresTarjeta>
      </div>

      <section class="lista card">
        <header class="lista-head">
          <div>
            <h3 class="lista-titulo">Tiempos muertos</h3>
            <p class="lista-sub">Marca varios para justificarlos juntos, por ejemplo el almuerzo de todo el equipo.</p>
          </div>
          <div class="presets" role="group" aria-label="Qué mostrar">
            <button
              type="button" class="preset" :class="{ on: filtro === 'pendientes' }"
              :aria-pressed="filtro === 'pendientes'" @click="filtro = 'pendientes'"
            >
              Por justificar ({{ r.cantidadPendientes }})
            </button>
            <button
              type="button" class="preset" :class="{ on: filtro === 'todos' }"
              :aria-pressed="filtro === 'todos'" @click="filtro = 'todos'"
            >
              Todos ({{ r.cantidad }})
            </button>
          </div>
        </header>

        <div v-if="seleccionados.length" class="masivo">
          <span>
            <b>{{ seleccionados.length }}</b> seleccionado{{ seleccionados.length !== 1 ? 's' : '' }} ·
            {{ fmtTiempo(seleccionados.reduce((s, t) => s + t.segundos, 0)) }}
          </span>
          <button class="btn btn-sm btn-primary" type="button" @click="justificando = [...seleccionados]">
            Justificar seleccionados
          </button>
          <button class="btn btn-sm btn-ghost" type="button" @click="seleccion = new Set()">Quitar selección</button>
        </div>

        <p v-if="visibles.length === 0" class="aviso vacio">
          <CheckCircle2 :size="15" /> No queda nada por justificar en estas fechas.
        </p>
        <div v-else class="tabla-scroll">
          <table class="table">
            <thead>
              <tr>
                <th class="chk">
                  <input
                    type="checkbox" :checked="todosMarcados" aria-label="Seleccionar todos"
                    @change="alternarTodos"
                  >
                </th>
                <th>Persona</th>
                <th>Día</th>
                <th>Horario</th>
                <th class="num">Duración</th>
                <th>Estado</th>
                <th>Motivo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in visibles" :key="clave(t)" :class="{ marcada: seleccion.has(clave(t)) }">
                <td class="chk">
                  <input
                    type="checkbox" :checked="seleccion.has(clave(t))"
                    :aria-label="`Seleccionar ${t.nombre} ${fmtHora(t.inicio)}`" @change="alternar(t)"
                  >
                </td>
                <td class="nom">{{ t.nombre }}</td>
                <td>{{ fmtDiaCorto(t.dia) }}</td>
                <td class="horario">{{ fmtHora(t.inicio) }} – {{ fmtHora(t.fin) }}</td>
                <td class="tnum">{{ fmtTiempo(t.segundos) }}</td>
                <td>
                  <span class="estado" :class="t.estado">
                    <component :is="ICONO[t.estado]" :size="13" />
                    {{ ESTADO_TIEMPO_MUERTO_LABEL[t.estado] }}
                  </span>
                  <span v-if="t.estado === 'pendiente' && t.justificacion" class="falta">
                    faltan {{ fmtTiempo(t.segundosPendientes) }}
                  </span>
                </td>
                <td class="motivo">
                  <template v-if="t.justificacion">
                    <span class="motivo-txt">{{ MOTIVO_TIEMPO_MUERTO_LABEL[t.justificacion.motivo] }}</span>
                    <span class="motivo-sub" :title="t.justificacion.observacion ?? undefined">
                      <template v-if="t.justificacion.observacion">“{{ t.justificacion.observacion }}” · </template>{{ t.justificacion.justificadoPor }}
                    </span>
                  </template>
                  <span v-else class="motivo-vacio">—</span>
                </td>
                <td class="acc">
                  <button
                    class="btn btn-sm" :class="{ 'btn-primary': t.estado === 'pendiente' }" type="button"
                    @click="justificando = [t]"
                  >
                    {{ t.estado === 'pendiente' ? 'Justificar' : 'Cambiar' }}
                  </button>
                  <button
                    v-if="t.justificacion" class="btn btn-sm btn-ghost" type="button"
                    @click="quitando = t"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <IndicadoresJustificarModal
      v-if="justificando" :tramos="justificando"
      @close="justificando = null" @justificado="alJustificar"
    />
    <ConfirmModal
      v-if="quitando"
      title="Quitar justificación"
      :message="`El tiempo muerto de ${quitando.nombre} de ${fmtHora(quitando.inicio)} a ${fmtHora(quitando.fin)} vuelve a quedar por justificar (o con la justificación anterior, si tenía una).`"
      confirm-label="Quitar" :confirming="quitandoGuardar"
      @close="quitando = null" @confirm="quitar"
    />
  </div>
</template>

<style scoped>
.tm { display: flex; flex-direction: column; }
.explica { margin: 0 2px 14px; font-size: 12.5px; line-height: 1.5; color: var(--muted); max-width: 820px; }

.cifras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.kpi { display: flex; flex-direction: column; gap: 3px; padding: 16px; }
.kpi-label { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--muted); }
.kpi-valor { font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; color: var(--ink); }
.kpi-hint { font-size: 11.5px; color: var(--faint); }
.sw { width: 10px; height: 10px; border-radius: 2px; flex: none; }

.bloque { margin-bottom: 18px; }
.dos { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.dos > * { min-width: 0; }
.leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 14px; padding: 0; list-style: none; }
.leyenda li { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-2); }
.aviso { margin: 8px 0; font-size: 13px; color: var(--muted); }
.aviso.vacio { display: flex; align-items: center; gap: 7px; margin: 0; padding: 18px; color: var(--success); font-weight: 600; }

.lista { padding: 0; overflow: hidden; }
.lista-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 12px; flex-wrap: wrap; }
.lista-titulo { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.lista-sub { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
.presets { display: inline-flex; padding: 3px; gap: 2px; border-radius: var(--r-sm); background: var(--surface-3); }
.preset {
  height: 30px; padding: 0 12px; border: none; border-radius: var(--r-xs); background: none;
  font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; white-space: nowrap;
}
.preset:hover { color: var(--ink-2); }
.preset.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-xs); }
.preset:focus-visible { outline: none; box-shadow: var(--ring); }

.masivo {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 18px;
  background: var(--brand-tint); border-top: 1px solid var(--border); font-size: 13px; color: var(--ink-2);
}
.masivo b { color: var(--ink); }

.tabla-scroll { overflow-x: auto; }
.table { width: 100%; min-width: 860px; border-collapse: separate; border-spacing: 0; }
.table th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--muted); padding: 10px 12px; white-space: nowrap;
  background: var(--surface-2);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border-strong);
}
.table th.num { text-align: right; }
.table td {
  padding: 9px 12px; font-size: 13px; color: var(--ink-2); white-space: nowrap;
  border-bottom: 1px solid var(--border); vertical-align: middle;
}
.table td.tnum { text-align: right; }
.table tbody tr:hover td { background: var(--surface-2); }
.table tbody tr.marcada td { background: var(--brand-tint); }
.table tbody tr:last-child td { border-bottom: none; }
.horario { font-variant-numeric: tabular-nums; }
.chk { width: 34px; }
.chk input { accent-color: var(--brand); width: 15px; height: 15px; }
.nom { font-weight: 600; color: var(--ink); }

.estado { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--ink-2); }
/* El icono lleva el color del estado; el texto se queda en tinta para leerse. */
.estado.pendiente :deep(svg) { color: var(--viz-por-justificar); }
.estado.justificado :deep(svg) { color: var(--viz-justificado); }
.estado.sin_justificacion :deep(svg) { color: var(--viz-sin-justificar); }
.falta { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.motivo { max-width: 280px; }
.motivo-txt { display: block; font-weight: 600; color: var(--ink); }
.motivo-sub {
  display: block; max-width: 280px; overflow: hidden; text-overflow: ellipsis;
  font-size: 11.5px; color: var(--muted);
}
.motivo-vacio { color: var(--faint); }
.acc { text-align: right; }
.acc .btn + .btn { margin-left: 4px; }

@media (max-width: 1100px) { .cifras { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 900px) { .dos { grid-template-columns: 1fr; } }
</style>
