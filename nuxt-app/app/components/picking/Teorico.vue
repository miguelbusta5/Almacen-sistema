<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PickingResultado, SemaforoPicking } from '../../../server/utils/pickingCalc'
type Preview = { carga: { id: string; nombre: string; montajeId: string | null }; filas: PickingResultado[] }
const preview = ref<Preview | null>(null), cargas = ref<{ id: string; nombre: string }[]>([]), operarios = ref<{ id: string; nombre: string }[]>([])
const operarioId = ref(''), busy = ref(false), error = ref(''), archivo = ref<File | null>(null)

// ── Semaforo y seleccion ──
// Cada picking lleva su semaforo (lo que tiene hoy sobre su capacidad). Solo se
// genera el resurtido de los marcados; los rojos vienen marcados de entrada.
const elegidos = ref<string[]>([])
const SEMAFORO_LABEL: Record<SemaforoPicking, string> = { ROJO: 'Rojo', AMARILLO: 'Amarillo', VERDE: 'Verde' }
const conTareas = (r: PickingResultado) => r.tareas.length > 0
const ORDEN_SEMAFORO: Record<string, number> = { ROJO: 0, AMARILLO: 1, VERDE: 2 }
// Los mas vacios primero: es donde urge resurtir.
const filasOrdenadas = computed(() => [...(preview.value?.filas ?? [])].sort((a, z) =>
  (ORDEN_SEMAFORO[a.semaforo ?? ''] ?? 3) - (ORDEN_SEMAFORO[z.semaforo ?? ''] ?? 3)
  || (a.porcentaje ?? 999) - (z.porcentaje ?? 999) || a.plu.localeCompare(z.plu)))
const conteo = computed(() => {
  const c = { ROJO: 0, AMARILLO: 0, VERDE: 0 }
  for (const r of preview.value?.filas ?? []) if (r.semaforo) c[r.semaforo]++
  return c
})
const cajasElegidas = computed(() => (preview.value?.filas ?? []).filter(r => elegidos.value.includes(r.plu)).reduce((a, r) => a + r.tareas.length, 0))
function alternar(plu: string) {
  elegidos.value = elegidos.value.includes(plu) ? elegidos.value.filter(p => p !== plu) : [...elegidos.value, plu]
}
function marcarColor(color: SemaforoPicking) {
  const plus = (preview.value?.filas ?? []).filter(r => r.semaforo === color && conTareas(r)).map(r => r.plu)
  elegidos.value = [...new Set([...elegidos.value, ...plus])]
}
function marcarTodos() { elegidos.value = (preview.value?.filas ?? []).filter(conTareas).map(r => r.plu) }
function marcarNinguno() { elegidos.value = [] }
// Al traer otro calculo: se conservan los marcados que siguen teniendo tareas;
// si es un teorico distinto, se marcan los rojos.
function aplicarPreview(p: Preview) {
  const mismo = preview.value?.carga.id === p.carga.id
  preview.value = p
  const validos = new Set(p.filas.filter(conTareas).map(r => r.plu))
  elegidos.value = mismo
    ? elegidos.value.filter(plu => validos.has(plu))
    : p.filas.filter(r => r.semaforo === 'ROJO' && conTareas(r)).map(r => r.plu)
}

async function ejecutar(fn: () => Promise<void>) { busy.value = true; error.value = ''; try { await fn() } catch (e: any) { error.value = e.data?.statusMessage ?? 'No se pudo completar. Intenta de nuevo.' } finally { busy.value = false } }
async function cargar(id: string) { await ejecutar(async () => { aplicarPreview(await $fetch<Preview>('/api/picking-teorico', { query: { id } })) }) }
async function subir() { if (!archivo.value) return; await ejecutar(async () => { const fd = new FormData(); fd.append('archivo', archivo.value!); aplicarPreview(await $fetch<Preview>('/api/picking-teorico', { method: 'POST', body: fd })); cargas.value = (await $fetch<{ cargas: typeof cargas.value }>('/api/picking-teorico')).cargas }) }
async function accion(accion: string, fila?: PickingResultado) {
  await ejecutar(async () => { aplicarPreview(await $fetch<Preview>('/api/picking-teorico/accion', { method: 'POST', body: { accion, id: preview.value?.carga.id, plu: fila?.plu, ubicacion: fila?.ubicacion, operarioId: operarioId.value, plus: elegidos.value, firma: JSON.stringify(preview.value?.filas) } })) })
}
onMounted(() => ejecutar(async () => {
  const [c, o] = await Promise.all([$fetch<{ cargas: typeof cargas.value }>('/api/picking-teorico'), $fetch<{ data: typeof operarios.value }>('/api/montaje-resurtido/operarios')]); cargas.value = c.cargas; operarios.value = o.data
}))
</script>
<template><section class="picking-page">
  <header class="picking-heading"><div><span class="eyebrow">RESURTIDO POR CAPACIDAD</span><h1>Del espacio disponible a la tarea</h1><p>Carga el teórico, revisa el semáforo de cada picking y resurte solo los que elijas.</p></div></header>
  <p v-if="error" class="picking-error" role="alert">{{ error }}</p>
  <article class="picking-card"><h2>Inventario teórico</h2><p>Excel con Artículo, Número de depósito, Disponible y WMS Aisle. Cantidades en unidades.</p><div class="picking-actions"><input aria-label="Archivo de inventario teórico" type="file" accept=".xlsx" :disabled="busy" @change="archivo = ($event.target as HTMLInputElement).files?.[0] ?? null"><button class="btn primary" :disabled="busy || !archivo" @click="subir">Cargar y calcular</button><select aria-label="Consultar carga anterior" :disabled="busy" @change="cargar(($event.target as HTMLSelectElement).value)"><option value="" disabled selected>Cargas anteriores</option><option v-for="c in cargas" :key="c.id" :value="c.id">{{ c.nombre }} · {{ c.id.slice(-6) }}</option></select></div></article>
  <template v-if="preview">
    <div class="picking-heading"><h2>{{ preview.carga.nombre }}</h2><button class="btn" :disabled="busy" @click="cargar(preview.carga.id)">Actualizar cálculo</button></div>
    <p v-if="preview.carga.montajeId" class="picking-pending">Resurtido generado. Consulta sus tareas en Montaje Resurtido. Para otro cálculo, carga un teórico actualizado.</p>
    <article v-for="r in preview.filas.filter(f => f.aviso.includes('doble picking'))" :key="r.plu" class="picking-card picking-pending"><h2>• Pendiente por validar · PLU {{ r.plu }}</h2><p>Se encontraron varias ubicaciones: {{ r.ubicaciones.join(', ') }}.</p><p>Picking registrado: <strong>{{ r.ubicacion }}</strong></p><button class="btn" :disabled="busy || !!preview.carga.montajeId || !r.ubicaciones.includes(r.ubicacion)" @click="accion('validar', r)">Confirmar {{ r.ubicacion }} y marcar solucionado</button></article>

    <!-- Semaforo: cuantos picking hay en cada color -->
    <div class="semaforo-resumen" aria-label="Semáforo de los picking">
      <div class="sem-caja sem-rojo"><span class="sem-dot" /><strong>{{ conteo.ROJO }}</strong><span>Rojo · 25 % o menos</span></div>
      <div class="sem-caja sem-amarillo"><span class="sem-dot" /><strong>{{ conteo.AMARILLO }}</strong><span>Amarillo · 26 % a 50 %</span></div>
      <div class="sem-caja sem-verde"><span class="sem-dot" /><strong>{{ conteo.VERDE }}</strong><span>Verde · más de 50 %</span></div>
    </div>

    <article class="picking-card"><h2>Revisión del resurtido</h2><p>El semáforo compara lo que tiene hoy cada picking (teórico) con su capacidad (informe de capacidad). Solo se generan cajas master completas de los picking marcados.</p><p v-if="!preview.filas.length">Aún no hay capacidades publicadas. Finaliza un informe en Capacidad picking.</p>
      <div v-if="!preview.carga.montajeId && preview.filas.length" class="picking-actions sem-marcar">
        <span class="sem-marcados">{{ elegidos.length }} picking marcados · {{ cajasElegidas }} tareas</span>
        <button class="btn" :disabled="busy" @click="marcarColor('ROJO')">+ Rojos</button>
        <button class="btn" :disabled="busy" @click="marcarColor('AMARILLO')">+ Amarillos</button>
        <button class="btn" :disabled="busy" @click="marcarColor('VERDE')">+ Verdes</button>
        <button class="btn" :disabled="busy" @click="marcarTodos">Todos</button>
        <button class="btn" :disabled="busy" @click="marcarNinguno">Ninguno</button>
      </div>
      <div class="picking-table-wrap"><table><thead><tr><th v-if="!preview.carga.montajeId">Resurtir</th><th>Semáforo</th><th>PLU / picking</th><th>Capacidad actual</th><th>Capacidad / disponible (un.)</th><th>Cajas requeridas</th><th>Origen y unidades a bajar</th><th>Faltante (cajas)</th><th>Estado</th></tr></thead><tbody>
        <tr v-for="r in filasOrdenadas" :key="r.plu" :class="{ 'sem-fila-on': elegidos.includes(r.plu) }">
          <td v-if="!preview.carga.montajeId"><input type="checkbox" :aria-label="`Resurtir PLU ${r.plu}`" :checked="elegidos.includes(r.plu)" :disabled="busy || !conTareas(r)" @change="alternar(r.plu)"></td>
          <td><span v-if="r.semaforo" class="sem-chip" :class="`sem-${r.semaforo.toLowerCase()}`"><span class="sem-dot" />{{ SEMAFORO_LABEL[r.semaforo] }}</span><span v-else class="sem-sin">Sin dato</span></td>
          <td>{{ r.plu }}<br>{{ r.ubicacion }}</td>
          <td><strong v-if="r.porcentaje != null" class="sem-pct">{{ r.porcentaje }} %</strong><span v-else>—</span></td>
          <td>{{ r.capacidad }} / {{ r.disponible ?? 'Sin dato' }}</td><td>{{ r.cajasSolicitadas }}</td><td><div v-for="t in r.tareas" :key="t.altura">{{ t.altura }} · {{ t.unidadesSolicitadas }} un.</div></td><td>{{ r.faltantes }}</td><td>{{ r.aviso || (r.doble ? 'Picking validado' : 'Listo') }}</td>
        </tr>
      </tbody></table></div>
    <div v-if="!preview.carga.montajeId" class="picking-actions"><label>Asignar a<select v-model="operarioId" :disabled="busy"><option value="">Seleccionar operario</option><option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option></select></label><button class="btn primary" :disabled="busy || !operarioId || !cajasElegidas" @click="accion('generar')">Generar resurtido de {{ elegidos.length }} picking</button></div></article>
  </template>
</section></template>
<style src="./picking.css"></style>
<style scoped>
.semaforo-resumen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.sem-caja { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 2px 10px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.sem-caja strong { font-size: 24px; color: var(--ink); font-variant-numeric: tabular-nums; }
.sem-caja > span:last-child { grid-column: 1 / -1; font-size: 12px; color: var(--muted); }
.sem-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--sem); flex-shrink: 0; }
.sem-rojo { --sem: var(--u-critico, #d64545); }
.sem-amarillo { --sem: var(--u-aviso, #d99a1e); }
.sem-verde { --sem: var(--u-ok, #1f9d6b); }
.sem-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--ink); background: color-mix(in srgb, var(--sem) 14%, transparent); }
.sem-sin { font-size: 12px; color: var(--muted); }
.sem-pct { font-variant-numeric: tabular-nums; }
.sem-marcar { gap: 8px; }
.sem-marcados { margin-right: auto; font-size: 13px; font-weight: 700; color: var(--ink); }
.sem-fila-on td { background: color-mix(in srgb, var(--brand) 6%, transparent); }
@media (max-width: 700px) { .semaforo-resumen { grid-template-columns: 1fr; } .sem-marcados { width: 100%; } }
</style>
