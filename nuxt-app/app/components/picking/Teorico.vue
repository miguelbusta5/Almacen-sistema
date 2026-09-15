<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { PickingResultado } from '../../../server/utils/pickingCalc'
type Preview = { carga: { id: string; nombre: string; montajeId: string | null }; filas: PickingResultado[] }
const preview = ref<Preview | null>(null), cargas = ref<{ id: string; nombre: string }[]>([]), operarios = ref<{ id: string; nombre: string }[]>([])
const operarioId = ref(''), busy = ref(false), error = ref(''), archivo = ref<File | null>(null)
async function ejecutar(fn: () => Promise<void>) { busy.value = true; error.value = ''; try { await fn() } catch (e: any) { error.value = e.data?.statusMessage ?? 'No se pudo completar. Intenta de nuevo.' } finally { busy.value = false } }
async function cargar(id: string) { await ejecutar(async () => { preview.value = await $fetch<Preview>('/api/picking-teorico', { query: { id } }) }) }
async function subir() { if (!archivo.value) return; await ejecutar(async () => { const fd = new FormData(); fd.append('archivo', archivo.value!); preview.value = await $fetch<Preview>('/api/picking-teorico', { method: 'POST', body: fd }); cargas.value = (await $fetch<{ cargas: typeof cargas.value }>('/api/picking-teorico')).cargas }) }
async function accion(accion: string, fila?: PickingResultado) {
  await ejecutar(async () => { preview.value = await $fetch<Preview>('/api/picking-teorico/accion', { method: 'POST', body: { accion, id: preview.value?.carga.id, plu: fila?.plu, ubicacion: fila?.ubicacion, operarioId: operarioId.value, firma: JSON.stringify(preview.value?.filas) } }) })
}
onMounted(() => ejecutar(async () => {
  const [c, o] = await Promise.all([$fetch<{ cargas: typeof cargas.value }>('/api/picking-teorico'), $fetch<{ data: typeof operarios.value }>('/api/montaje-resurtido/operarios')]); cargas.value = c.cargas; operarios.value = o.data
}))
</script>
<template><section class="picking-page">
  <header class="picking-heading"><div><span class="eyebrow">RESURTIDO POR CAPACIDAD</span><h1>Del espacio disponible a la tarea</h1><p>Carga el teórico, valida los picking y asigna las cajas que hacen falta.</p></div></header>
  <p v-if="error" class="picking-error" role="alert">{{ error }}</p>
  <article class="picking-card"><h2>Inventario teórico</h2><p>Excel con Artículo, Número de depósito, Disponible y WMS Aisle. Cantidades en unidades.</p><div class="picking-actions"><input aria-label="Archivo de inventario teórico" type="file" accept=".xlsx" :disabled="busy" @change="archivo = ($event.target as HTMLInputElement).files?.[0] ?? null"><button class="btn primary" :disabled="busy || !archivo" @click="subir">Cargar y calcular</button><select aria-label="Consultar carga anterior" :disabled="busy" @change="cargar(($event.target as HTMLSelectElement).value)"><option value="" disabled selected>Cargas anteriores</option><option v-for="c in cargas" :key="c.id" :value="c.id">{{ c.nombre }} · {{ c.id.slice(-6) }}</option></select></div></article>
  <template v-if="preview">
    <div class="picking-heading"><h2>{{ preview.carga.nombre }}</h2><button class="btn" :disabled="busy" @click="cargar(preview.carga.id)">Actualizar cálculo</button></div>
    <p v-if="preview.carga.montajeId" class="picking-pending">Resurtido generado. Consulta sus tareas en Montaje Resurtido. Para otro cálculo, carga un teórico actualizado.</p>
    <article v-for="r in preview.filas.filter(f => f.aviso.includes('doble picking'))" :key="r.plu" class="picking-card picking-pending"><h2>• Pendiente por validar · PLU {{ r.plu }}</h2><p>Se encontraron varias ubicaciones: {{ r.ubicaciones.join(', ') }}.</p><p>Picking registrado: <strong>{{ r.ubicacion }}</strong></p><button class="btn" :disabled="busy || !!preview.carga.montajeId || !r.ubicaciones.includes(r.ubicacion)" @click="accion('validar', r)">Confirmar {{ r.ubicacion }} y marcar solucionado</button></article>
    <article class="picking-card"><h2>Revisión del resurtido</h2><p>Solo se generan cajas master completas. Los PLU con trabajo pendiente quedan bloqueados.</p><p v-if="!preview.filas.length">Aún no hay capacidades publicadas. Finaliza un informe en Capacidad picking.</p><div class="picking-table-wrap"><table><thead><tr><th>PLU / picking</th><th>Capacidad / disponible (un.)</th><th>Cajas requeridas</th><th>Origen y unidades a bajar</th><th>Faltante (cajas)</th><th>Estado</th></tr></thead><tbody><tr v-for="r in preview.filas" :key="r.plu"><td>{{ r.plu }}<br>{{ r.ubicacion }}</td><td>{{ r.capacidad }} / {{ r.disponible ?? 'Sin dato' }}</td><td>{{ r.cajasSolicitadas }}</td><td><div v-for="t in r.tareas" :key="t.altura">{{ t.altura }} · {{ t.unidadesSolicitadas }} un.</div></td><td>{{ r.faltantes }}</td><td>{{ r.aviso || (r.doble ? 'Picking validado' : 'Listo') }}</td></tr></tbody></table></div>
    <div v-if="!preview.carga.montajeId" class="picking-actions"><label>Asignar a<select v-model="operarioId" :disabled="busy"><option value="">Seleccionar operario</option><option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option></select></label><button class="btn primary" :disabled="busy || !operarioId || !preview.filas.some(f => f.tareas.length)" @click="accion('generar')">Confirmar y generar resurtido</button></div></article>
  </template>
</section></template>
<style src="./picking.css"></style>
