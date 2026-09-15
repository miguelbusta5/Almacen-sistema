<script setup lang="ts">
// Registro de las pausas de alimentación y cambio de baterías: cuántas veces y
// cuánto tiempo las usa cada persona. Solo lo ven el administrador, Felipe Ossa
// y Eduardo Zurita (lo decide el servidor; aquí solo se muestra).
//
// Usa el mismo periodo, rol y persona que el resto de Indicadores.
import { computed, ref, watch } from 'vue'
import { Coffee, BatteryCharging } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { fmtHoraMovimiento, fmtTiempo } from '~/utils/montacargas'
import {
  API_INDICADORES, fmtNumero, MOTIVO_PAUSA_LABEL, ROL_MEDIDO_LABEL,
  type ColumnaTabla, type PausasPeriodo,
} from '~/utils/indicadores'

const props = defineProps<{
  desde: string
  hasta: string
  rol: string
  usuarioId: string
}>()

const { show: showToast } = useToast()
const datos = ref<PausasPeriodo | null>(null)
const cargando = ref(false)

async function cargar() {
  if (!props.desde || !props.hasta) return
  cargando.value = true
  try {
    const res = await $fetch<{ data: PausasPeriodo }>(`${API_INDICADORES}/pausas`, {
      query: { desde: props.desde, hasta: props.hasta },
    })
    datos.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar el registro de pausas'), true)
  } finally {
    cargando.value = false
  }
}
watch(() => [props.desde, props.hasta], cargar, { immediate: true })
defineExpose({ cargar })

// Rol y persona se filtran aquí: el registro trae a todos los que pausaron.
const personas = computed(() => (datos.value?.personas ?? [])
  .filter((p) => (!props.rol || p.rol === props.rol) && (!props.usuarioId || p.id === props.usuarioId)))
const ids = computed(() => new Set(personas.value.map((p) => p.id)))
const detalle = computed(() => (datos.value?.detalle ?? []).filter((d) => ids.value.has(d.usuarioId)))

const totales = computed(() => {
  const t = { ALIMENTACION: { veces: 0, segundos: 0 }, CAMBIO_BATERIAS: { veces: 0, segundos: 0 } }
  for (const p of personas.value) {
    for (const m of ['ALIMENTACION', 'CAMBIO_BATERIAS'] as const) {
      t[m].veces += p.veces[m]
      t[m].segundos += p.segundos[m]
    }
  }
  return t
})

const columnasPersonas: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'rol', label: 'Rol' },
  { key: 'alimVeces', label: 'Alimentación · veces', num: true },
  { key: 'alimTiempo', label: 'Alimentación · tiempo', num: true },
  { key: 'batVeces', label: 'Baterías · veces', num: true },
  { key: 'batTiempo', label: 'Baterías · tiempo', num: true },
  { key: 'total', label: 'Tiempo total', num: true },
]
const filasPersonas = computed(() => personas.value.map((p) => ({
  nombre: p.enPausa ? `${p.nombre} (en pausa)` : p.nombre,
  rol: ROL_MEDIDO_LABEL[p.rol] ?? p.rol,
  alimVeces: fmtNumero(p.veces.ALIMENTACION),
  alimTiempo: fmtTiempo(p.segundos.ALIMENTACION),
  batVeces: fmtNumero(p.veces.CAMBIO_BATERIAS),
  batTiempo: fmtTiempo(p.segundos.CAMBIO_BATERIAS),
  total: fmtTiempo(p.totalSegundos),
})))

const columnasDetalle: ColumnaTabla[] = [
  { key: 'nombre', label: 'Persona' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'inicio', label: 'Inicio' },
  { key: 'fin', label: 'Fin' },
  { key: 'duracion', label: 'Duración', num: true },
]
const filasDetalle = computed(() => detalle.value.map((d) => ({
  nombre: d.nombre,
  motivo: MOTIVO_PAUSA_LABEL[d.motivo] ?? d.motivo,
  inicio: fmtHoraMovimiento(d.inicio),
  fin: d.fin ? fmtHoraMovimiento(d.fin) : 'En pausa',
  duracion: fmtTiempo(d.segundos),
})))
</script>

<template>
  <div class="pz" :class="{ recargando: cargando }">
    <ListSkeleton v-if="!datos" />
    <EmptyState
      v-else-if="!personas.length" title="Sin pausas en el periodo"
      description="Nadie usó los botones de alimentación ni de cambio de baterías en estas fechas."
    />
    <template v-else>
      <div class="tiles">
        <article class="tile card">
          <span class="tile-lbl"><Coffee :size="14" /> Tiempo de alimentación</span>
          <b class="tile-valor tnum">{{ fmtTiempo(totales.ALIMENTACION.segundos) }}</b>
          <span class="tile-hint">{{ fmtNumero(totales.ALIMENTACION.veces) }} pausa{{ totales.ALIMENTACION.veces === 1 ? '' : 's' }}</span>
        </article>
        <article class="tile card">
          <span class="tile-lbl"><BatteryCharging :size="14" /> Cambio de baterías</span>
          <b class="tile-valor tnum">{{ fmtTiempo(totales.CAMBIO_BATERIAS.segundos) }}</b>
          <span class="tile-hint">{{ fmtNumero(totales.CAMBIO_BATERIAS.veces) }} pausa{{ totales.CAMBIO_BATERIAS.veces === 1 ? '' : 's' }}</span>
        </article>
      </div>

      <section class="card bloque">
        <header class="cab">
          <h3 class="titulo">Por persona</h3>
          <p class="sub">Cuántas veces usó cada botón y cuánto tiempo en total. La pausa abierta cuenta hasta ahora.</p>
        </header>
        <div class="scroll">
          <IndicadoresTabla :columnas="columnasPersonas" :filas="filasPersonas" principal="nombre" />
        </div>
      </section>

      <section class="card bloque">
        <header class="cab">
          <h3 class="titulo">Cada pausa</h3>
          <p class="sub">La más reciente primero.</p>
        </header>
        <div class="scroll">
          <IndicadoresTabla :columnas="columnasDetalle" :filas="filasDetalle" principal="nombre" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.pz { display: flex; flex-direction: column; gap: 16px; transition: opacity .2s; }
.pz.recargando { opacity: .6; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.tile { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; }
.tile-lbl { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.tile-valor { font-family: var(--display); font-size: 24px; font-weight: 800; color: var(--ink); }
.tile-hint { font-size: 12px; color: var(--faint); }
.bloque { padding: 14px 16px; }
.cab { margin-bottom: 10px; }
.titulo { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.sub { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
.scroll { overflow-x: auto; }
</style>
