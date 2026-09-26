<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSessionState, ensureSession } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import { canSeeModule } from '~/utils/modulePermissions'

interface FilaTipo { tipo: string; tareas: number; minutos: number; promedioMinutos: number }
interface FilaDia { dia: string; usuarioId: string; operario: string; minutos: number; jornadaMinutos: number | null; efectividad: number | null }
interface Reporte { equipo: { id: string; name: string }[]; tipos: FilaTipo[]; pareto: { proveedor: string; casos: number; tareas: number }[]; diario: FilaDia[] }
const ETIQUETAS: Record<string, string> = { INSPECCION: 'Inspección', ENTREGA_TRANSPORTE: 'Entrega a transporte', ANALISIS_CASO: 'Análisis de caso', OTRAS: 'Otras tareas' }
const { me } = useSessionState()
const { show } = useToast()
const permitido = computed(() => canSeeModule(me.value?.role, 'garantias') && canSeeModule(me.value?.role, 'indicadores'))
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const desde = ref(new Date(new Date(`${hoy}T12:00:00-05:00`).getTime() - 6 * 86_400_000).toISOString().slice(0, 10))
const hasta = ref(hoy)
const usuarioId = ref('')
const reporte = ref<Reporte | null>(null)
const cargando = ref(false)
async function cargar() {
  if (!permitido.value) return
  cargando.value = true
  try {
    reporte.value = await $fetch<Reporte>('/api/garantias/indicadores', { query: { desde: desde.value, hasta: hasta.value, ...(usuarioId.value ? { usuarioId: usuarioId.value } : {}) } })
  } catch (e: any) { show(e?.data?.statusMessage ?? 'No se pudieron cargar los indicadores', true) }
  finally { cargando.value = false }
}
const total = computed(() => reporte.value?.tipos.reduce((s, x) => s + x.tareas, 0) ?? 0)
const minutos = computed(() => reporte.value?.tipos.reduce((s, x) => s + x.minutos, 0) ?? 0)
onMounted(async () => { await ensureSession(); await cargar() })
useAutoRefresh({ onRefresh: cargar })
</script>

<template>
  <main v-if="permitido" class="indicadores-garantias">
    <header><h1>Indicadores de Garantías</h1><p>Actividades cerradas, minutos activos y casos por proveedor.</p></header>
    <section class="filtros">
      <label>Desde<input v-model="desde" class="field" type="date"></label>
      <label>Hasta<input v-model="hasta" class="field" type="date"></label>
      <label>Operario<select v-model="usuarioId" class="field"><option value="">Todos</option><option v-for="u in reporte?.equipo ?? []" :key="u.id" :value="u.id">{{ u.name }}</option></select></label>
      <button :disabled="cargando" @click="cargar">Aplicar filtros</button>
    </section>
    <p v-if="cargando">Cargando indicadores…</p>
    <template v-if="reporte">
      <div class="resumen"><article><strong>{{ total }}</strong><span>Tareas cerradas</span></article><article><strong>{{ minutos.toFixed(1) }}</strong><span>Minutos activos por tarea</span></article></div>
      <section><h2>Tipo de tarea</h2><p>La duración excluye las pausas. Las tareas simultáneas se muestran por separado aquí.</p><div class="tabla"><table><thead><tr><th>Tipo</th><th>Tareas</th><th>Minutos</th><th>Promedio</th></tr></thead><tbody><tr v-for="f in reporte.tipos" :key="f.tipo"><td>{{ ETIQUETAS[f.tipo] ?? f.tipo }}</td><td>{{ f.tareas }}</td><td>{{ f.minutos.toFixed(1) }}</td><td>{{ f.promedioMinutos.toFixed(1) }} min</td></tr></tbody></table></div></section>
      <section><h2>Efectividad por jornada</h2><p>Se cuentan una sola vez los minutos superpuestos dentro del turno. Sin cuadro de turnos se muestran los minutos, sin porcentaje.</p><div class="tabla"><table><thead><tr><th>Día del turno</th><th>Operario</th><th>Minutos únicos</th><th>Jornada</th><th>Efectividad</th></tr></thead><tbody><tr v-for="f in reporte.diario" :key="`${f.dia}-${f.usuarioId}`"><td>{{ f.dia }}</td><td>{{ f.operario }}</td><td>{{ f.minutos.toFixed(1) }}</td><td>{{ f.jornadaMinutos == null ? 'Sin turno' : `${f.jornadaMinutos} min` }}</td><td>{{ f.efectividad == null ? 'No calculable' : `${f.efectividad} %` }}</td></tr><tr v-if="!reporte.diario.length"><td colspan="5">Sin registros para este periodo.</td></tr></tbody></table></div></section>
      <section><h2>Pareto de proveedores</h2><p>Un caso se cuenta una vez por proveedor aunque tenga varias tareas. La otra columna muestra todas las tareas cerradas.</p><div class="tabla"><table><thead><tr><th>Proveedor</th><th>Casos únicos</th><th>Tareas</th></tr></thead><tbody><tr v-for="f in reporte.pareto" :key="f.proveedor"><td>{{ f.proveedor }}</td><td>{{ f.casos }}</td><td>{{ f.tareas }}</td></tr><tr v-if="!reporte.pareto.length"><td colspan="3">Sin registros para este periodo.</td></tr></tbody></table></div></section>
    </template>
  </main>
</template>

<style scoped>
.indicadores-garantias{max-width:1180px;margin:auto;padding:22px;color:var(--ink)}header{margin-bottom:20px}h1{font-size:32px;margin:0 0 6px}h2{font-size:20px;margin:0 0 7px}p{color:var(--muted)}.filtros{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:18px}.filtros label{display:grid;gap:5px;font-size:13px;font-weight:700}.field{background:var(--surface);border:1px solid var(--border);color:var(--ink);padding:9px;border-radius:8px;min-height:40px}.filtros button{background:var(--brand);color:var(--on-brand);border:0;border-radius:8px;padding:11px 16px;font-weight:700;cursor:pointer}.resumen{display:flex;gap:12px;flex-wrap:wrap}.resumen article,section:not(.filtros){background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:16px}.resumen article{display:grid;gap:4px;min-width:180px}.resumen strong{font-size:26px}.resumen span{font-size:13px;color:var(--muted)}
.tabla{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:580px}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}th{font-size:12px;color:var(--muted)}@media(max-width:680px){.indicadores-garantias{padding:14px}.filtros label{width:100%}.field{width:100%}}
</style>
