<script setup lang="ts">
// Pendientes en los que el operario no uso la altura o el picking sugeridos
// segun el teorico. Solo lo ven el administrador, Felipe Ossa y Eduardo Zurita
// (lo decide el servidor). Usa el periodo, rol y persona de Indicadores.
import { computed, ref, watch } from 'vue'
import { MapPinOff } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { fmtHoraMovimiento } from '~/utils/montacargas'
import { API_INDICADORES, type ColumnaTabla } from '~/utils/indicadores'

interface FilaDesvio {
  id: string; plu: string; descripcion: string; estado: string; horaInicio: string | null
  inicioPorId: string | null; inicioPorNombre: string | null
  cierrePorId: string | null; cierrePorNombre: string | null
  alturaSugerida: string | null; alturaUsada: string | null; desvioAltura: boolean
  pickingSugerido: string | null; pickingUsado: string | null; desvioPicking: boolean
}

const props = defineProps<{ desde: string; hasta: string; usuarioId: string; equipoIds: string[] }>()
const { show: showToast } = useToast()
const filas = ref<FilaDesvio[] | null>(null)
const cargando = ref(false)

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{ data: FilaDesvio[] }>(`${API_INDICADORES}/ubicaciones-pendientes`, {
      query: { desde: props.desde, hasta: props.hasta },
    })
    filas.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar el registro de ubicaciones'), true)
  } finally {
    cargando.value = false
  }
}
watch(() => [props.desde, props.hasta], cargar, { immediate: true })

// Persona elegida: cuenta si escaneo la altura o si ubico en el picking.
const visibles = computed(() => (filas.value ?? []).filter((f) => {
  const ids = [f.inicioPorId, f.cierrePorId].filter(Boolean) as string[]
  if (props.usuarioId) return ids.includes(props.usuarioId)
  return !props.equipoIds.length || ids.some((id) => props.equipoIds.includes(id))
}))
const totalAltura = computed(() => visibles.value.filter((f) => f.desvioAltura).length)
const totalPicking = computed(() => visibles.value.filter((f) => f.desvioPicking).length)

const columnas: ColumnaTabla[] = [
  { key: 'fecha', label: 'Empezó' },
  { key: 'plu', label: 'PLU' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'altura', label: 'Altura sugerida → usada' },
  { key: 'quienAltura', label: 'Escaneó la altura' },
  { key: 'picking', label: 'Picking sugerido → usado' },
  { key: 'quienPicking', label: 'Ubicó en picking' },
]
const tabla = computed(() => visibles.value.map((f) => ({
  fecha: fmtHoraMovimiento(f.horaInicio),
  plu: f.plu,
  descripcion: f.descripcion,
  altura: f.desvioAltura ? `${f.alturaSugerida ?? '—'} → ${f.alturaUsada ?? '—'}` : 'Usó la sugerida',
  quienAltura: f.inicioPorNombre ?? '—',
  picking: f.desvioPicking ? `${f.pickingSugerido ?? '—'} → ${f.pickingUsado ?? '—'}` : (f.pickingUsado ? 'Usó el sugerido' : 'Aún no se ubica'),
  quienPicking: f.cierrePorNombre ?? '—',
})))
</script>

<template>
  <div class="ub" :class="{ recargando: cargando }">
    <ListSkeleton v-if="!filas" />
    <EmptyState
      v-else-if="!visibles.length" title="Todos usaron lo sugerido"
      description="En estas fechas no hay pendientes en los que se usara otra altura u otro picking que el sugerido por el teórico."
    />
    <template v-else>
      <div class="tiles">
        <article class="tile card">
          <span class="tile-lbl"><MapPinOff :size="14" /> Otra altura</span>
          <b class="tile-valor tnum">{{ totalAltura }}</b>
          <span class="tile-hint">pendientes sacados de una altura distinta a la sugerida</span>
        </article>
        <article class="tile card">
          <span class="tile-lbl"><MapPinOff :size="14" /> Otro picking</span>
          <b class="tile-valor tnum">{{ totalPicking }}</b>
          <span class="tile-hint">pendientes ubicados en un picking distinto al sugerido</span>
        </article>
      </div>
      <section class="card bloque">
        <header class="cab">
          <h3 class="titulo">Pendientes fuera de la sugerencia</h3>
          <p class="sub">La sugerencia sale del teórico vigente al asignar. Cuenta en el día en que se empezó el pendiente.</p>
        </header>
        <div class="scroll">
          <IndicadoresTabla :columnas="columnas" :filas="tabla" principal="plu" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ub { display: flex; flex-direction: column; gap: 16px; transition: opacity .2s; }
.ub.recargando { opacity: .6; }
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
