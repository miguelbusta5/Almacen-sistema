<script setup lang="ts">
// Panel de productividad por operario. Solo gestores (el servidor devuelve 403 al
// resto, así que el padre ni siquiera pide los datos).
import { computed } from 'vue'
import { BarChart3, ChevronDown } from '@lucide/vue'
import {
  calcularTotalProductividad, fmtRango, hoyBogota, sumarDias, toneProm, type Operario, type UserStat,
} from '~/utils/exportaciones'

const props = defineProps<{
  stats: UserStat[]
  loading: boolean
  desde: string
  hasta: string
  operario: string
  operarios: Operario[]
  open: boolean
  accent: string
}>()
const emit = defineEmits<{
  (e: 'update:desde', v: string): void
  (e: 'update:hasta', v: string): void
  (e: 'update:operario', v: string): void
  (e: 'update:open', v: boolean): void
  (e: 'aplicar'): void
}>()

// La fila Total solo aporta si hay más de un operario en el rango.
const filas = computed<UserStat[]>(() => {
  const visibles = props.operario ? props.stats.filter((s) => s.id === props.operario) : props.stats
  return visibles.length > 1 ? [...visibles, calcularTotalProductividad(visibles)] : visibles
})

const PRESETS = [
  { label: 'Hoy', dias: 0 },
  { label: '7 días', dias: 6 },
  { label: '30 días', dias: 29 },
]
function aplicarPreset(dias: number) {
  const hoy = hoyBogota()
  emit('update:desde', dias === 0 ? hoy : sumarDias(hoy, -dias))
  emit('update:hasta', hoy)
  emit('aplicar')
}
function presetActivo(dias: number) {
  const hoy = hoyBogota()
  return props.hasta === hoy && props.desde === (dias === 0 ? hoy : sumarDias(hoy, -dias))
}
</script>

<template>
  <section class="card prod" :style="{ '--pais': accent }">
    <button class="head" @click="emit('update:open', !open)">
      <span class="head-ic"><BarChart3 :size="16" /></span>
      <span class="head-txt">
        <b>Productividad por operario</b>
        <span class="head-sub">{{ fmtRango(desde, hasta) }}</span>
      </span>
      <ChevronDown :size="17" class="chev" :class="{ open }" />
    </button>

    <div v-if="open" class="body">
      <div class="controles">
        <div class="presets">
          <button
            v-for="p in PRESETS" :key="p.label" class="chip" :class="{ on: presetActivo(p.dias) }"
            @click="aplicarPreset(p.dias)"
          >{{ p.label }}</button>
        </div>
        <input class="field sel" type="date" :value="desde" @change="emit('update:desde', ($event.target as HTMLInputElement).value)">
        <input class="field sel" type="date" :value="hasta" @change="emit('update:hasta', ($event.target as HTMLInputElement).value)">
        <select class="field sel" :value="operario" @change="emit('update:operario', ($event.target as HTMLSelectElement).value)">
          <option value="">Todos los operarios</option>
          <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
        <button class="btn btn-sm" @click="emit('aplicar')">Aplicar</button>
      </div>

      <ListSkeleton v-if="loading" :rows="4" />
      <table v-else-if="filas.length" class="table">
        <thead>
          <tr><th>Operario</th><th>Cajas</th><th>PLUs</th><th>Unidades</th><th>Finalizadas</th><th>Tiempo</th><th>Prom. min/caja</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in filas" :key="f.id" :class="{ total: f.id === '__total__' }">
            <td class="nom">{{ f.nombre }}</td>
            <td class="tnum">{{ f.cajas }}</td>
            <td class="tnum">{{ f.id === '__total__' ? '—' : f.plusDistintos }}</td>
            <td class="tnum">{{ f.totalUnidades }}</td>
            <td class="tnum">{{ f.finalizadas }}</td>
            <td class="tnum">{{ f.duracionTotalMin }} min</td>
            <td class="tnum prom" :style="{ color: toneProm(f.promedioPorCajaMin) }">
              {{ f.promedioPorCajaMin ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="Sin actividad" description="Ningún registro en el rango seleccionado." />
    </div>
  </section>
</template>

<style scoped>
.prod { padding: 0; overflow: hidden; }
.head { display: flex; align-items: center; gap: 11px; width: 100%; padding: 14px 16px; background: none; border: none; cursor: pointer; text-align: left; }
.head:hover { background: var(--surface-2); }
.head-ic { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; color: var(--pais); background: color-mix(in srgb, var(--pais) 12%, transparent); flex-shrink: 0; }
.head-txt { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.head-txt b { font-size: 13.5px; color: var(--ink); }
.head-sub { font-size: 12px; color: var(--muted); }
.chev { color: var(--muted); transition: transform .2s; flex-shrink: 0; }
.chev.open { transform: rotate(180deg); }

.body { border-top: 1px solid var(--border); }
.controles { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 13px 16px; }
.presets { display: flex; gap: 6px; }
.chip { padding: 7px 12px; border-radius: var(--r-pill); border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; }
.chip:hover { background: var(--surface-2); color: var(--ink-2); }
.chip.on { color: var(--pais); border-color: color-mix(in srgb, var(--pais) 45%, transparent); background: color-mix(in srgb, var(--pais) 14%, transparent); }
.sel { width: auto; }

.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 11px 16px; background: var(--surface-2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.table td { padding: 11px 16px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); }
.table tr:last-child td { border-bottom: none; }
.nom { font-weight: 600; color: var(--ink); }
.prom { font-weight: 700; }
.total td { background: var(--surface-2); font-weight: 700; color: var(--ink); }
@media (max-width: 760px) { .body { overflow-x: auto; } .table { min-width: 640px; } }
</style>
