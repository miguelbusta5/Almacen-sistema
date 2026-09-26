<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSessionState, ensureSession } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh, enRefrescoSilencioso } from '~/composables/useAutoRefresh'
import { canSeeModule } from '~/utils/modulePermissions'

type Tipo = 'INSPECCION' | 'ENTREGA_TRANSPORTE' | 'ANALISIS_CASO' | 'OTRAS'
interface Tarea { id: string; usuarioId: string; operario: string; tipo: Tipo; numeroCaso: string | null; observacion: string | null; plu: string; descripcion: string; proveedor: string; estado: string; horaInicio?: string; horaFin?: string | null; minutos?: number | null }
const OPCIONES: { valor: Tipo; texto: string }[] = [
  { valor: 'INSPECCION', texto: 'Inspección' }, { valor: 'ENTREGA_TRANSPORTE', texto: 'Entrega a transporte' },
  { valor: 'ANALISIS_CASO', texto: 'Análisis de caso' }, { valor: 'OTRAS', texto: 'Otras tareas' },
]
const etiqueta = (tipo: Tipo) => OPCIONES.find((x) => x.valor === tipo)?.texto ?? tipo
const { me } = useSessionState()
const { show } = useToast()
const permitido = computed(() => canSeeModule(me.value?.role, 'garantias'))
const gestor = computed(() => ['ADMIN', 'GERENTE'].includes(me.value?.role ?? ''))
const tareas = ref<Tarea[]>([])
const historico = ref(false)
const cargando = ref(false)
const guardando = ref(false)
const form = ref<{ tipo: Tipo; numeroCaso: string; observacion: string; plu: string; descripcion: string }>({ tipo: 'INSPECCION', numeroCaso: '', observacion: '', plu: '', descripcion: '' })
const productoEncontrado = ref(false)
const buscando = ref(false)
const proveedor = ref('')
const corrigiendo = ref<Tarea | null>(null)
const correccion = ref({ inicio: '', fin: '', motivo: '' })
const mensaje = (e: any) => e?.data?.statusMessage ?? 'No se pudo completar la acción'

async function cargar() {
  if (!permitido.value) return
  if (!enRefrescoSilencioso()) cargando.value = true
  try {
    const r = await $fetch<{ data: Tarea[] }>('/api/garantias', { query: historico.value ? { historico: '1' } : {} })
    tareas.value = r.data
  } catch (e) { show(mensaje(e), true) }
  finally { cargando.value = false }
}
async function buscarProducto() {
  const codigo = form.value.plu.trim()
  productoEncontrado.value = false
  proveedor.value = ''
  if (!codigo) return
  buscando.value = true
  try {
    const r = await $fetch<{ data: { plu: string; descripcion: string | null; fabricante: string | null } }>('/api/productos-maestro/buscar', { query: { codigo } })
    form.value.plu = r.data.plu
    form.value.descripcion = r.data.descripcion ?? ''
    proveedor.value = r.data.fabricante?.trim() || 'Sin proveedor'
    productoEncontrado.value = !!r.data.descripcion?.trim()
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.response?.status === 404) {
      form.value.descripcion = ''
      proveedor.value = 'Sin proveedor'
    } else show(mensaje(e), true)
  } finally { buscando.value = false }
}
const valido = computed(() => !!form.value.plu.trim() && !!form.value.descripcion.trim()
  && (form.value.tipo === 'OTRAS' ? !!form.value.observacion.trim() : !!form.value.numeroCaso.trim()))
async function iniciar() {
  if (!valido.value || guardando.value || !productoEncontrado.value && !proveedor.value) return
  guardando.value = true
  try {
    await $fetch('/api/garantias', { method: 'POST', body: form.value })
    form.value = { tipo: 'INSPECCION', numeroCaso: '', observacion: '', plu: '', descripcion: '' }
    proveedor.value = ''; productoEncontrado.value = false
    show('Tarea iniciada')
    await cargar()
  } catch (e) { show(mensaje(e), true) }
  finally { guardando.value = false }
}
async function accion(t: Tarea, valor: 'PAUSAR' | 'REANUDAR' | 'FINALIZAR') {
  if (guardando.value) return
  guardando.value = true
  try {
    await $fetch(`/api/garantias/${t.id}/accion`, { method: 'POST', body: { accion: valor } })
    show(valor === 'PAUSAR' ? 'Tarea pausada' : valor === 'REANUDAR' ? 'Tarea reanudada' : 'Tarea finalizada')
    await cargar()
  } catch (e) { show(mensaje(e), true) }
  finally { guardando.value = false }
}
function fechaHora(iso?: string | null) {
  return iso ? new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—'
}
function valorBogota(iso: string) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '00'
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`
}
function abrirCorreccion(t: Tarea) {
  corrigiendo.value = t
  correccion.value = { inicio: valorBogota(t.horaInicio!), fin: valorBogota(t.horaFin!), motivo: '' }
}
async function corregir() {
  if (!corrigiendo.value || guardando.value) return
  guardando.value = true
  try {
    await $fetch(`/api/garantias/${corrigiendo.value.id}/corregir`, { method: 'PATCH', body: {
      horaInicio: new Date(`${correccion.value.inicio}:00-05:00`).toISOString(),
      horaFin: new Date(`${correccion.value.fin}:00-05:00`).toISOString(), motivo: correccion.value.motivo,
    } })
    corrigiendo.value = null
    show('Horario corregido')
    await cargar()
  } catch (e) { show(mensaje(e), true) }
  finally { guardando.value = false }
}
onMounted(async () => { await ensureSession(); await cargar() })
useAutoRefresh({ onRefresh: () => (guardando.value || corrigiendo.value ? undefined : cargar()) })
</script>

<template>
  <main v-if="permitido" class="garantias">
    <header class="hero"><p class="kicker">Operación diaria</p><h1>Gestión de Garantías</h1><p>Registra cada actividad y su avance.</p></header>
    <section v-if="!gestor" class="panel">
      <h2>Iniciar tarea</h2>
      <div class="grid">
        <label>Tipo de tarea<select v-model="form.tipo" class="field"><option v-for="o in OPCIONES" :key="o.valor" :value="o.valor">{{ o.texto }}</option></select></label>
        <label>Número de caso <span v-if="form.tipo === 'OTRAS'">(opcional)</span><input v-model="form.numeroCaso" class="field" maxlength="100" placeholder="Caso del sistema externo"></label>
        <label>PLU <span aria-hidden="true">*</span><input v-model="form.plu" class="field" maxlength="100" placeholder="Escribe o escanea el PLU" @change="buscarProducto" @blur="buscarProducto"></label>
        <label>Descripción <span aria-hidden="true">*</span><input v-model="form.descripcion" class="field" maxlength="500" :readonly="productoEncontrado" placeholder="Se completa desde el maestro o escríbela"></label>
        <p class="dato">Proveedor: {{ proveedor || 'Busca el PLU' }}</p>
        <label class="ancho">Observación <span v-if="form.tipo === 'OTRAS'">*</span><textarea v-model="form.observacion" class="field" maxlength="1000" rows="3" :placeholder="form.tipo === 'OTRAS' ? 'Describe qué tarea estás realizando' : 'Detalles adicionales'"></textarea></label>
      </div>
      <button class="primario" :disabled="!valido || guardando || buscando || !proveedor" @click="iniciar">Iniciar tarea</button>
    </section>
    <section class="panel">
      <div class="cabeza"><h2>{{ historico ? 'Historial' : 'Tareas abiertas' }}</h2><button class="secundario" @click="historico = !historico; cargar()">{{ historico ? 'Ver abiertas' : 'Ver historial' }}</button></div>
      <p v-if="cargando">Cargando tareas…</p><p v-else-if="!tareas.length">No hay tareas para mostrar.</p>
      <div v-else class="lista"><article v-for="t in tareas" :key="t.id" class="tarea">
        <div class="cabeza"><strong>{{ etiqueta(t.tipo) }}</strong><span class="estado">{{ t.estado === 'EN_CURSO' ? 'En curso' : t.estado === 'PAUSADA' ? 'Pausada' : 'Finalizada' }}</span></div>
        <p>{{ t.plu }} · {{ t.descripcion }} · {{ t.proveedor }}</p>
        <p v-if="t.numeroCaso">Caso {{ t.numeroCaso }}</p><p v-if="t.observacion">{{ t.observacion }}</p>
        <template v-if="gestor"><p class="dato">{{ t.operario }} · {{ fechaHora(t.horaInicio) }} → {{ fechaHora(t.horaFin) }} <span v-if="t.minutos != null">· {{ t.minutos }} min activos</span></p><button v-if="t.estado === 'FINALIZADA'" class="secundario" @click="abrirCorreccion(t)">Corregir horario</button></template>
        <div v-else-if="t.estado !== 'FINALIZADA'" class="acciones"><button v-if="t.estado === 'EN_CURSO'" class="secundario" :disabled="guardando" @click="accion(t, 'PAUSAR')">Pausar</button><button v-else class="secundario" :disabled="guardando" @click="accion(t, 'REANUDAR')">Reanudar</button><button class="primario" :disabled="guardando" @click="accion(t, 'FINALIZAR')">Finalizar</button></div>
      </article></div>
    </section>
    <section v-if="gestor" class="panel"><NuxtLink to="/dashboard/indicadores?area=garantias">Ver indicadores de Garantías →</NuxtLink></section>
    <div v-if="corrigiendo" class="fondo" role="dialog" aria-modal="true" aria-label="Corregir horario"><div class="modal"><h2>Corregir horario</h2><p>{{ corrigiendo.operario }} · {{ etiqueta(corrigiendo.tipo) }}</p><label>Inicio<input v-model="correccion.inicio" type="datetime-local" class="field"></label><label>Fin<input v-model="correccion.fin" type="datetime-local" class="field"></label><label>Motivo<textarea v-model="correccion.motivo" class="field" rows="3" maxlength="500"></textarea></label><div class="acciones"><button class="secundario" @click="corrigiendo = null">Cancelar</button><button class="primario" :disabled="guardando || correccion.motivo.trim().length < 5" @click="corregir">Guardar corrección</button></div></div></div>
  </main>
</template>

<style scoped>
.garantias{max-width:1180px;margin:auto;padding:24px;color:var(--ink)}.hero{margin-bottom:22px}.hero h1{font-size:clamp(26px,3vw,38px);margin:4px 0}.hero p{color:var(--muted)}.kicker{text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:800}.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card,16px);padding:20px;margin-bottom:16px}.panel h2{margin:0 0 14px;font-size:19px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.grid label,.modal label{display:flex;flex-direction:column;gap:7px;font-weight:650;font-size:13px}.ancho{grid-column:1/-1}.field{width:100%;min-height:42px;background:var(--surface-2);color:var(--ink);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font:inherit}.field:focus{outline:none;box-shadow:var(--ring)}.dato{color:var(--muted);font-size:13px}.primario,.secundario{border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}.primario{background:var(--brand);color:var(--on-brand);border:0}.secundario{background:var(--surface-2);color:var(--ink);border:1px solid var(--border)}button:disabled{opacity:.5;cursor:not-allowed}.panel>.primario{margin-top:16px}.cabeza,.acciones{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.lista{display:grid;gap:10px}.tarea{border:1px solid var(--border);border-radius:10px;padding:14px}.tarea p{margin:7px 0;overflow-wrap:anywhere}.estado{background:var(--surface-2);border-radius:99px;padding:4px 9px;font-size:12px;font-weight:700}.acciones{justify-content:flex-start;margin-top:12px}.fondo{position:fixed;inset:0;background:var(--modal-backdrop);display:grid;place-items:center;z-index:100}.modal{background:var(--surface);border-radius:16px;border:1px solid var(--border);padding:24px;width:min(95vw,480px);display:grid;gap:12px}@media(max-width:680px){.garantias{padding:14px}.grid{grid-template-columns:1fr}.ancho{grid-column:auto}.panel{padding:15px}}
</style>
