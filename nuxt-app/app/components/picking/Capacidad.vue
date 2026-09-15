<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { canSeeModule } from '~/utils/modulePermissions'
// Descripcion, unidad de empaque y unidades vienen del maestro vigente (solo lectura).
type Linea = { plu: string; ubicacion: string; cajas: number; tipo: string; descripcion?: string | null; unidadesPorCaja?: number | null; unidades?: number | null }
type Informe = { id: string; autorId: string; autorNombre: string; estado: string; inicio: string; fin: string | null; pausaInicio: string | null; pausaMotivo: string | null; pausaSegundos: number; revision: number; lineas: Linea[] }
const { me } = useSessionState()
const permitido = computed(() => canSeeModule(me.value?.role, 'capacidad-picking') && me.value?.can.capacidadPicking)
const informes = ref<Informe[]>([]), capacidades = ref<Linea[]>([]), actual = ref<Informe | null>(null), detalle = ref<Informe | null>(null)
const busy = ref(false), error = ref(''), estadoGuardado = ref(''), ahora = ref(Date.now())
const plu = ref(''), ubicacion = ref(''), cajas = ref<number | null>(null), tipo = ref('SENCILLO')
// Lo que dice el maestro del PLU que se esta digitando.
const producto = ref<{ plu: string; descripcion: string | null; unidadesPorCaja: number | null } | null>(null)
const productoError = ref(''), buscandoProducto = ref(false)
let buscarTimer: ReturnType<typeof setTimeout> | undefined
const totalUnidades = computed(() => {
  const u = producto.value?.unidadesPorCaja
  return u && Number.isInteger(cajas.value) && Number(cajas.value) >= 0 ? Number(cajas.value) * u : null
})
async function buscarProducto(valor: string) {
  const codigo = valor.trim().toUpperCase()
  if (!codigo) { producto.value = null; productoError.value = ''; return }
  buscandoProducto.value = true
  try {
    const r = await $fetch<{ plu: string; descripcion: string | null; unidadesPorCaja: number | null }>('/api/capacidad-picking/producto', { query: { plu: codigo } })
    if (plu.value.trim().toUpperCase() === r.plu) { producto.value = r; productoError.value = '' }
  } catch (e: any) {
    if (plu.value.trim().toUpperCase() === codigo) { producto.value = null; productoError.value = e.data?.statusMessage ?? 'No se pudo consultar el maestro' }
  } finally { buscandoProducto.value = false }
}
watch(plu, (v) => {
  if (buscarTimer) clearTimeout(buscarTimer)
  if (!v.trim()) { producto.value = null; productoError.value = ''; return }
  buscarTimer = setTimeout(() => { void buscarProducto(v) }, 350)
})
const fmtUnd = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('es-CO')
let reloj: ReturnType<typeof setInterval>, autosave: ReturnType<typeof setTimeout> | undefined
const editable = computed(() => actual.value?.estado === 'ABIERTO' && !actual.value.pausaInicio)
const valido = computed(() => plu.value.trim() && ubicacion.value.trim() && Number.isInteger(cajas.value) && Number(cajas.value) > 0)
const yaGuardado = computed(() => actual.value?.lineas.some(l => l.plu === plu.value.trim().toUpperCase() && l.ubicacion === ubicacion.value.trim().toUpperCase() && l.cajas === cajas.value && l.tipo === tipo.value))
const tiempo = (r: Informe) => {
  const fin = new Date(r.fin ?? r.pausaInicio ?? ahora.value).getTime()
  const segundos = Math.max(0, Math.floor((fin - new Date(r.inicio).getTime()) / 1000 - r.pausaSegundos))
  return `${Math.floor(segundos / 3600)}h ${Math.floor(segundos % 3600 / 60)}m ${segundos % 60}s`
}
async function cargar() {
  try {
    const data = await $fetch<{ informes: Informe[]; capacidades: Linea[] }>('/api/capacidad-picking')
    informes.value = data.informes; capacidades.value = data.capacidades
    actual.value = data.informes.find(r => r.autorId === me.value?.id && r.estado === 'ABIERTO') ?? null
  } catch (e: any) { error.value = e.data?.statusMessage ?? 'No se pudo cargar. Intenta actualizar.' }
}
async function accion(accion: string, extra: Record<string, unknown> = {}) {
  if (busy.value) return false
  if (autosave) clearTimeout(autosave)
  busy.value = true; error.value = ''
  try {
    actual.value = await $fetch<Informe>('/api/capacidad-picking', { method: 'POST', body: { accion, id: actual.value?.id, revision: actual.value?.revision, ...extra } })
    if (accion === 'quitar' && extra.plu === plu.value.trim().toUpperCase()) limpiar()
    if (accion === 'finalizar') { limpiar(); await cargar() }
    return true
  } catch (e: any) { error.value = e.data?.statusMessage ?? 'No se pudo guardar. Conservamos tus datos para reintentar.'; return false }
  finally { busy.value = false }
}
async function guardar() {
  if (!valido.value || !editable.value) return false
  const ok = await accion('linea', { plu: plu.value, ubicacion: ubicacion.value, cajas: Number(cajas.value), tipo: tipo.value })
  estadoGuardado.value = ok ? 'Guardado en el informe' : 'Sin guardar: revisa el mensaje'
  return ok
}
function limpiar() { plu.value = ''; ubicacion.value = ''; cajas.value = null; estadoGuardado.value = '' }
async function siguiente() { if (await guardar()) limpiar() }
async function terminar() {
  if (plu.value || ubicacion.value || cajas.value !== null) { if (!valido.value) { error.value = 'Completa o limpia el registro antes de finalizar'; return }; if (!await guardar()) return }
  await accion('finalizar')
}
watch([plu, ubicacion, cajas, tipo], () => {
  estadoGuardado.value = yaGuardado.value ? 'Guardado en el informe' : plu.value || ubicacion.value || cajas.value !== null ? 'Cambios sin guardar' : ''
  if (autosave) clearTimeout(autosave)
  if (import.meta.client) { try { localStorage.setItem(`picking-borrador-${me.value?.id}`, JSON.stringify({ plu: plu.value, ubicacion: ubicacion.value, cajas: cajas.value, tipo: tipo.value })) } catch { /* El guardado principal permanece en el servidor. */ } }
  if (valido.value && editable.value && !yaGuardado.value) autosave = setTimeout(() => { void guardar() }, 900)
})
function editar(l: Linea) { plu.value = l.plu; ubicacion.value = l.ubicacion; cajas.value = l.cajas; tipo.value = l.tipo }
onMounted(async () => {
  await ensureSession()
  if (permitido.value) { await cargar(); try { const draft = JSON.parse(localStorage.getItem(`picking-borrador-${me.value?.id}`) ?? 'null'); if (draft) editar(draft) } catch {} }
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { clearInterval(reloj); if (autosave) clearTimeout(autosave); if (buscarTimer) clearTimeout(buscarTimer) })
</script>
<template>
  <section class="picking-page">
    <header class="picking-heading"><div><span class="eyebrow">CENTRO DE DISTRIBUCIÓN</span><h1>Capacidad picking</h1><p>Registra el espacio real de cada producto y prepara resurtidos precisos.</p></div><button class="btn" :disabled="busy" @click="cargar">Actualizar</button></header>
    <p v-if="!permitido" role="status">Este módulo requiere permiso individual.</p>
    <template v-else>
      <p v-if="error" class="picking-error" role="alert">{{ error }}</p>
      <div class="picking-summary"><div><strong>{{ capacidades.length }}</strong><span>Picking registrados</span></div><div><strong>{{ informes.filter(r => r.estado === 'FINALIZADO').length }}</strong><span>Informes finalizados (últimos 100)</span></div><div><strong>{{ actual ? tiempo(actual) : '—' }}</strong><span>Tiempo efectivo del informe</span></div></div>
      <article class="picking-card">
        <template v-if="!actual"><h2>Un nuevo recorrido</h2><p>El tiempo comienza al crear el informe. Tus capacidades se publican al finalizarlo.</p><button class="btn primary" :disabled="busy" @click="accion('crear')">Crear nuevo informe</button></template>
        <template v-else>
          <div class="picking-heading"><div><h2>Informe en curso</h2><p>{{ actual.lineas.length }} PLU registrados · {{ tiempo(actual) }}</p></div><div class="picking-actions">
            <template v-if="actual.pausaInicio"><span class="picking-pending">En pausa: {{ actual.pausaMotivo === 'FIN_TURNO' ? 'fin de turno' : 'alimentación' }}</span><button class="btn primary" :disabled="busy" @click="accion('reanudar')">Reanudar informe</button></template>
            <template v-else><button class="btn" :disabled="busy" @click="accion('pausar', { motivo: 'ALIMENTACION' })">Alimentación</button><button class="btn" :disabled="busy" @click="accion('pausar', { motivo: 'FIN_TURNO' })">Finalizar turno</button></template>
          </div></div>
          <fieldset :disabled="!editable || busy" class="picking-form"><label>PLU<input v-model="plu" maxlength="100" autocomplete="off"></label><label>Ubicación<input v-model="ubicacion" maxlength="120" autocomplete="off"></label><label>Capacidad en cajas master<input v-model.number="cajas" type="number" min="1" max="100000" step="1"></label><label>Tipo de picking<select v-model="tipo"><option value="SENCILLO">Sencillo</option><option value="DOBLE">Doble profundidad</option></select></label></fieldset>
          <div v-if="plu.trim()" class="picking-producto" aria-live="polite">
            <span v-if="buscandoProducto && !producto">Buscando en el maestro…</span>
            <span v-else-if="productoError" class="picking-producto-error">{{ productoError }}</span>
            <template v-else-if="producto">
              <strong>{{ producto.descripcion ?? 'Sin descripción en el maestro' }}</strong>
              <span v-if="producto.unidadesPorCaja">{{ fmtUnd(producto.unidadesPorCaja) }} und/caja</span>
              <span v-else class="picking-producto-aviso">Sin unidad de empaque en el maestro</span>
              <span class="picking-producto-total">Total: <b>{{ fmtUnd(totalUnidades) }}</b> unidades</span>
            </template>
          </div>
          <div class="picking-actions"><button class="btn" :disabled="!editable || busy || !valido" @click="siguiente">Guardar y siguiente PLU</button><button class="btn" :disabled="busy" @click="limpiar">Limpiar campos</button><span aria-live="polite">{{ estadoGuardado }}</span></div>
          <div class="picking-table-wrap"><table><thead><tr><th>PLU</th><th>Descripción</th><th>Ubicación</th><th>Cajas master</th><th>Und/caja</th><th>Unidades</th><th>Tipo</th><th>Acciones</th></tr></thead><tbody><tr v-for="l in actual.lineas" :key="l.plu"><td>{{ l.plu }}</td><td class="picking-desc">{{ l.descripcion ?? '—' }}</td><td>{{ l.ubicacion }}</td><td>{{ l.cajas }}</td><td><span v-if="l.unidadesPorCaja">{{ fmtUnd(l.unidadesPorCaja) }}</span><span v-else class="picking-producto-aviso">Sin dato</span></td><td>{{ fmtUnd(l.unidades) }}</td><td>{{ l.tipo === 'DOBLE' ? 'Doble profundidad' : 'Sencillo' }}</td><td><button class="btn" :disabled="!editable || busy" @click="editar(l)">Editar</button> <button class="btn" :disabled="!editable || busy" @click="accion('quitar', { plu: l.plu })">Quitar</button></td></tr></tbody></table></div>
          <button class="btn primary" :disabled="!editable || busy || !actual.lineas.length" @click="terminar">Finalizar informe y publicar capacidades</button>
        </template>
      </article>
      <article class="picking-card"><h2>Capacidades vigentes</h2><p>Para corregir una capacidad, inclúyela en un nuevo informe. Se conserva su historial.</p><div class="picking-table-wrap"><table><thead><tr><th>PLU</th><th>Descripción</th><th>Ubicación</th><th>Cajas master</th><th>Und/caja</th><th>Unidades</th><th>Tipo</th></tr></thead><tbody><tr v-for="c in capacidades" :key="c.plu"><td>{{ c.plu }}</td><td class="picking-desc">{{ c.descripcion ?? '—' }}</td><td>{{ c.ubicacion }}</td><td>{{ c.cajas }}</td><td><span v-if="c.unidadesPorCaja">{{ fmtUnd(c.unidadesPorCaja) }}</span><span v-else class="picking-producto-aviso">Sin dato</span></td><td>{{ fmtUnd(c.unidades) }}</td><td>{{ c.tipo === 'DOBLE' ? 'Doble profundidad' : 'Sencillo' }}</td></tr></tbody></table></div></article>
      <article class="picking-card"><h2>Historial de informes</h2><div class="picking-history" v-for="r in informes" :key="r.id"><span>{{ r.autorNombre }} · {{ new Date(r.inicio).toLocaleString('es-CO') }} · {{ r.estado }} · {{ tiempo(r) }}</span><button class="btn" @click="detalle = detalle?.id === r.id ? null : r">{{ detalle?.id === r.id ? 'Ocultar' : 'Ver registros' }}</button><ul v-if="detalle?.id === r.id"><li v-for="l in r.lineas" :key="l.plu">{{ l.plu }} · {{ l.descripcion ?? 'Sin descripción' }} · {{ l.ubicacion }} · {{ l.cajas }} cajas · {{ l.unidadesPorCaja ? `${fmtUnd(l.unidadesPorCaja)} und/caja · ${fmtUnd(l.unidades)} unidades` : 'sin unidad de empaque en el maestro' }} · {{ l.tipo }}</li></ul></div></article>
    </template>
  </section>
</template>
<style src="./picking.css"></style>
