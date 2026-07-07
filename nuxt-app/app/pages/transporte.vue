<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, Download, Plus, Calendar } from '@lucide/vue'
import { tieneAlerta, todayISO, parseEntrega, type Guardado, type ContactoGuardado } from '~/utils/guardado'
import { SAMPLE_GUARDADOS, SAMPLE_CONTACTOS, SAMPLE_PENDIENTES, type PendienteTienda } from '~/utils/sampleData'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'

definePageMeta({ title: 'Guardados Transporte' })

const { me } = useSessionState()
const { toast, show: showToast } = useToast()

const guardados = ref<Guardado[]>([])
const pendientes = ref<PendienteTienda[]>([])
// demo = la carga de datos reales de ESTE modulo fallo -> datos de ejemplo.
// (la sesion/permisos son compartidos via useSessionState, no dependen de esto)
const demo = ref(false)
const canEdit = computed(() => demo.value || !!me.value?.can.edit)
const canDelete = computed(() => demo.value || !!me.value?.can.delete)
const canCreate = computed(() => demo.value || !!me.value?.can.create)

// filtros
const q = ref('')
const fEstado = ref('')
const fTipo = ref('')
const fAlerta = ref(false)
const density = ref<'comodo' | 'compacto'>('comodo')
const loading = ref(true)
const refreshKey = ref(0)
const refreshing = ref(false)

async function loadAll() {
  try {
    const [gRes, pRes] = await Promise.all([
      $fetch<{ data: Guardado[] }>('/api/transporte?pageSize=500'),
      $fetch<{ data: any[] }>('/api/transporte/pendientes-tienda').catch(() => ({ data: [] as any[] })),
    ])
    guardados.value = gRes.data
    pendientes.value = (pRes.data ?? []).map((p: any) => ({
      id: p.id, numeroDocumento: p.despacho.numeroDocumento, clienteNombre: p.despacho.clienteNombre,
      centroCostos: p.despacho.centroCostos, numeroCajas: p.despacho.numeroCajas, nota: p.nota,
    }))
    demo.value = false
  } catch {
    // Sin sesión/credenciales o error real -> modo demo con datos de ejemplo.
    demo.value = true
    guardados.value = [...SAMPLE_GUARDADOS]
    pendientes.value = [...SAMPLE_PENDIENTES]
  }
}

onMounted(async () => { ensureSession(); await loadAll(); loading.value = false })

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  loading.value = true
  await loadAll()
  await new Promise((r) => setTimeout(r, 350))
  loading.value = false; refreshing.value = false; refreshKey.value++
  showToast(demo.value ? 'Modo demo · datos de ejemplo' : 'Datos actualizados ✓')
}

const filtered = computed(() => {
  const query = q.value.toLowerCase()
  return guardados.value.filter((g) => {
    if (query && !g.documento.toLowerCase().includes(query) && !g.ubicacion.toLowerCase().includes(query)) return false
    if (fEstado.value && g.estado !== fEstado.value) return false
    if (fTipo.value && g.tipo !== fTipo.value) return false
    if (fAlerta.value && !tieneAlerta(g)) return false
    return true
  })
})
const hasFilters = computed(() => !!(q.value || fEstado.value || fTipo.value || fAlerta.value))
function clearFilters() { q.value = ''; fEstado.value = ''; fTipo.value = ''; fAlerta.value = false }

// panel + modales
const panelItem = ref<Guardado | null>(null)
const contactosPanel = ref<ContactoGuardado[]>([])
watch(panelItem, async (g) => {
  if (!g) { contactosPanel.value = []; return }
  if (demo.value) { contactosPanel.value = SAMPLE_CONTACTOS[g.clientId] ?? []; return }
  try {
    const res = await $fetch<{ data: ContactoGuardado[] }>(`/api/transporte/${encodeURIComponent(g.clientId)}/contactos`)
    contactosPanel.value = res.data
  } catch { contactosPanel.value = [] }
})
const showForm = ref(false)
const editing = ref<Guardado | null>(null)
const showFecha = ref(false)
const showContacto = ref(false)
// Formulario de contacto (modal)
const cTipo = ref('LLAMADA')
const cResultado = ref('NO_CONTESTA')
const cFecha = ref('')
const cNota = ref('')
const cShowCompromiso = computed(() => cResultado.value === 'CONFIRMO_FECHA')
function abrirContacto() { cTipo.value = 'LLAMADA'; cResultado.value = 'NO_CONTESTA'; cFecha.value = ''; cNota.value = ''; showContacto.value = true }
const TIPO_OPTS = [
  { v: 'LLAMADA', t: 'Llamada telefónica' }, { v: 'MENSAJE', t: 'Mensaje (WhatsApp/SMS)' },
  { v: 'EMAIL', t: 'Correo electrónico' }, { v: 'VISITA', t: 'Visita presencial' }, { v: 'ESCALACION', t: 'Escalación interna' },
]
const RES_OPTS = [
  { v: 'NO_CONTESTA', t: 'No contestó' }, { v: 'CONFIRMO_FECHA', t: 'Confirmó fecha de recogida' },
  { v: 'CANCELO', t: 'Canceló / Rechazó' }, { v: 'ESCALADO', t: 'Se escaló a otra área' }, { v: 'OTRO', t: 'Otro resultado' },
]

function onKpiFilter(key: string) {
  if (key === 'alerta') { fAlerta.value = true; return }
  fEstado.value = key
}
function openDetail(g: Guardado) { panelItem.value = g }

function apiErr(e: any, fallback: string) {
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || fallback
}

// ── Feedback async: una sola acción de escritura a la vez ──────────────────
// `busy` guarda la clave de la acción en curso; los botones muestran spinner
// cuando su clave coincide y todos quedan deshabilitados mientras haya una.
const busy = ref<string | null>(null)
async function run(key: string, fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = key
  try { await fn() } finally { busy.value = null }
}

function despachar() {
  return run('despachar', async () => {
    const g = panelItem.value
    if (!g) return
    if (demo.value) { g.estado = 'DESPACHADO'; g.fechaDespacho = todayISO(); showToast('Marcado como enviado ✓'); return }
    try {
      await $fetch(`/api/transporte/${encodeURIComponent(g.clientId)}/acciones`, { method: 'POST', body: { tipo: 'despachar' } })
      g.estado = 'DESPACHADO'; g.fechaDespacho = todayISO()
      await loadAll(); showToast('Marcado como enviado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo despachar'), true) }
  })
}

const showConfirmRevertir = ref(false)
function revertir() {
  return run('revertir', async () => {
    const g = panelItem.value
    if (!g) return
    if (demo.value) { g.estado = 'PENDIENTE DESPACHO'; g.fechaDespacho = null; showConfirmRevertir.value = false; showToast('Revertido a Pendiente Despacho ✓'); return }
    try {
      await $fetch(`/api/transporte/${encodeURIComponent(g.clientId)}`, { method: 'PUT', body: { estado: 'PENDIENTE DESPACHO' } })
      g.estado = 'PENDIENTE DESPACHO'; g.fechaDespacho = null
      showConfirmRevertir.value = false
      await loadAll(); showToast('Revertido a Pendiente Despacho ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo revertir'), true) }
  })
}

const showConfirmDel = ref(false)
function delGuardado() {
  return run('del', async () => {
    const g = panelItem.value
    if (!g) return
    if (demo.value) { guardados.value = guardados.value.filter(x => x.clientId !== g.clientId); panelItem.value = null; showConfirmDel.value = false; showToast('Eliminado'); return }
    try {
      await $fetch(`/api/transporte/${encodeURIComponent(g.clientId)}`, { method: 'DELETE' })
      showConfirmDel.value = false
      panelItem.value = null; await loadAll(); showToast('Eliminado')
    } catch (e) { showToast(apiErr(e, 'No se pudo eliminar'), true) }
  })
}

function openEdit() { editing.value = panelItem.value; showForm.value = true }

function onSaved(payload: Partial<Guardado>) {
  return run('save', async () => {
    const wasEdit = !!editing.value
    if (demo.value) {
      showForm.value = false; editing.value = null
      showToast(wasEdit ? 'Guardado actualizado ✓' : 'Guardado registrado ✓')
      return
    }
    const body: any = { ...payload }
    if (!body.fechaDespacho) body.fechaDespacho = null
    if (body.ciudad === '') body.ciudad = null
    if (body.nota === '') body.nota = null
    try {
      if (wasEdit) {
        // Solo enviar la fecha de ingreso si realmente cambió (evita 403 no-ADMIN).
        if (body.fecha === editing.value!.fecha) delete body.fecha
        await $fetch(`/api/transporte/${encodeURIComponent(editing.value!.clientId)}`, { method: 'PUT', body })
      } else {
        await $fetch('/api/transporte', { method: 'POST', body })
      }
      showForm.value = false; editing.value = null
      await loadAll(); showToast(wasEdit ? 'Guardado actualizado ✓' : 'Guardado registrado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo guardar'), true) }
  })
}

// Modal "Ubicación para guardar" — reemplaza un window.prompt() nativo
// (bloqueante, no estilizable, sin feedback en caso de error) por un modal
// consistente con el resto de la app.
const showUbicacionPendiente = ref(false)
const pendienteActual = ref<PendienteTienda | null>(null)
const ubicacionPendiente = ref('')
function abrirUbicacionPendiente(p: PendienteTienda) {
  if (demo.value) { pendientes.value = pendientes.value.filter(x => x.id !== p.id); showToast('Guardado creado desde despacho tienda ✓'); return }
  pendienteActual.value = p
  ubicacionPendiente.value = ''
  showUbicacionPendiente.value = true
}
function confirmarUbicacionPendiente() {
  return run(`pendiente:${pendienteActual.value?.id}`, async () => {
    const p = pendienteActual.value
    const ubicacion = ubicacionPendiente.value.trim()
    if (!p || !ubicacion) return
    try {
      await $fetch('/api/transporte/pendientes-tienda', { method: 'POST', body: { pendienteId: p.id, ubicacion, nota: null } })
      showUbicacionPendiente.value = false
      await loadAll(); showToast('Guardado creado desde despacho tienda ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo convertir'), true) }
  })
}

// Registrar contacto (modal)
function guardarContacto() {
  return run('contacto', async () => {
    const g = panelItem.value
    if (!g) return
    if (demo.value) { showContacto.value = false; showToast('Contacto registrado ✓'); return }
    try {
      await $fetch(`/api/transporte/${encodeURIComponent(g.clientId)}/contactos`, {
        method: 'POST',
        body: { tipo: cTipo.value, resultado: cResultado.value, fechaCompromiso: cFecha.value || null, nota: cNota.value.trim() || null },
      })
      showContacto.value = false
      const res = await $fetch<{ data: ContactoGuardado[] }>(`/api/transporte/${encodeURIComponent(g.clientId)}/contactos`)
      contactosPanel.value = res.data
      showToast('Contacto registrado ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo registrar'), true) }
  })
}

// Editar fecha de entrega (modal)
const fechaEntrega = ref('')
function openFecha() {
  if (!panelItem.value) return
  fechaEntrega.value = parseEntrega(panelItem.value.nota) ?? todayISO()
  showFecha.value = true
}
function guardarFecha() {
  return run('fecha', async () => {
    const g = panelItem.value
    if (!g) return
    if (demo.value) { showFecha.value = false; showToast('Fecha de entrega actualizada ✓'); return }
    try {
      const res = await $fetch<{ nota: string }>(`/api/transporte/${encodeURIComponent(g.clientId)}/acciones`, { method: 'POST', body: { tipo: 'fecha_entrega', fecha: fechaEntrega.value } })
      g.nota = res.nota
      showFecha.value = false; showToast('Fecha de entrega actualizada ✓')
    } catch (e) { showToast(apiErr(e, 'No se pudo actualizar'), true) }
  })
}

const pendCount = computed(() => guardados.value.filter(g => g.estado === 'PENDIENTE DESPACHO').length)
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="hero fade-in">
      <div class="hero-left">
        <div class="hero-kicker">Custodia y almacenaje</div>
        <h1 class="hero-title">Guardados Transporte</h1>
        <p class="hero-desc">{{ guardados.length }} registros · {{ pendCount }} pendientes despacho</p>
      </div>
      <div class="hero-actions">
        <span v-if="demo" class="demo-tag" title="Sin sesión activa: mostrando datos de ejemplo. Inicia sesión en la app principal para ver datos reales."><span class="demo-dot" /> Modo demo</span>
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refresh"><RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}</button>
        <button class="btn btn-sm"><Download :size="14" /> Excel</button>
        <button v-if="canCreate" class="btn btn-primary btn-sm" @click="editing = null; showForm = true"><Plus :size="14" /> Nuevo guardado</button>
      </div>
    </section>

    <Transition name="view" mode="out-in">
      <!-- Vista lista -->
      <div v-if="!panelItem" key="list">
        <PendientesBanner :items="pendientes" :busy="busy" class="fade-in" style="margin-bottom: 18px" @registrar="abrirUbicacionPendiente" />
        <KpiRail :key="refreshKey" :items="guardados" style="margin-bottom: 18px" @filter="onKpiFilter" />
        <Toolbar
          v-model:q="q" v-model:estado="fEstado" v-model:tipo="fTipo" v-model:alerta="fAlerta" v-model:density="density"
          :count="filtered.length" :total="guardados.length" style="margin-bottom: 14px" @clear="clearFilters"
        />
        <!-- Sin <Transition>: una transición CSS aquí queda colgada si la pestaña
             está en segundo plano (rAF congelado) y la lista nunca reemplaza al
             skeleton. Las filas ya animan su entrada escalonada por su cuenta. -->
        <ListSkeleton v-if="loading" />
        <GuardadosList v-else :items="filtered" :has-filters="hasFilters" :density="density" @open="openDetail" @clear="clearFilters" @new="showForm = true" />
      </div>

      <!-- Detalle -->
      <DetailView
        v-else key="detail" :g="panelItem" :contactos="contactosPanel" :can-edit="canEdit" :can-delete="canDelete" :busy="busy"
        @back="panelItem = null" @despachar="despachar" @edit-fecha="openFecha"
        @edit="openEdit" @del="showConfirmDel = true" @revertir="showConfirmRevertir = true" @nuevo-contacto="abrirContacto"
      />
    </Transition>

    <!-- Modales -->
    <GuardadoModal v-if="showForm" :guardado="editing" :saving="busy === 'save'" @close="showForm = false; editing = null" @saved="onSaved" />

    <ConfirmModal
      v-if="showConfirmDel && panelItem" title="Eliminar guardado"
      :message="`¿Eliminar el guardado ${panelItem.documento}? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar" confirming-label="Eliminando…" :confirming="busy === 'del'"
      @close="showConfirmDel = false" @confirm="delGuardado"
    />
    <ConfirmModal
      v-if="showConfirmRevertir && panelItem" title="Revertir a pendiente despacho"
      :message="`¿Revertir ${panelItem.documento} a Pendiente Despacho?`"
      confirm-label="Revertir" confirming-label="Revirtiendo…" :confirming="busy === 'revertir'"
      @close="showConfirmRevertir = false" @confirm="revertir"
    />

    <ModalShell v-if="showUbicacionPendiente && pendienteActual" title="Ubicación para guardar" :sub="pendienteActual.numeroDocumento" @close="showUbicacionPendiente = false">
      <div class="fecha-form">
        <label class="flabel">Ubicación</label>
        <input v-model="ubicacionPendiente" class="field" placeholder="Ej. Pasillo B - Nivel 2" @keydown.enter="confirmarUbicacionPendiente">
        <div class="fecha-actions">
          <button class="btn" :disabled="!!busy" @click="showUbicacionPendiente = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="!!busy || !ubicacionPendiente.trim()" @click="confirmarUbicacionPendiente">
            <Spinner v-if="busy?.startsWith('pendiente:')" />
            {{ busy?.startsWith('pendiente:') ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    </ModalShell>

    <ModalShell v-if="showFecha && panelItem" title="Fecha de entrega" :sub="`${panelItem.documento} · ${panelItem.ubicacion}`" @close="showFecha = false">
      <div class="fecha-form">
        <label class="flabel">Fecha comprometida</label>
        <input v-model="fechaEntrega" type="date" class="field">
        <div class="fecha-actions">
          <button class="btn" :disabled="busy === 'fecha'" @click="showFecha = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="busy === 'fecha'" @click="guardarFecha">
            <Spinner v-if="busy === 'fecha'" /><Calendar v-else :size="14" />
            {{ busy === 'fecha' ? 'Guardando…' : 'Guardar fecha' }}
          </button>
        </div>
      </div>
    </ModalShell>

    <ModalShell v-if="showContacto && panelItem" title="Registrar contacto" :sub="panelItem.documento" @close="showContacto = false">
      <div class="fecha-form">
        <div class="g2">
          <label class="field-wrap"><span class="flabel">Tipo de contacto</span>
            <select v-model="cTipo" class="field"><option v-for="o in TIPO_OPTS" :key="o.v" :value="o.v">{{ o.t }}</option></select>
          </label>
          <label class="field-wrap"><span class="flabel">Resultado</span>
            <select v-model="cResultado" class="field"><option v-for="o in RES_OPTS" :key="o.v" :value="o.v">{{ o.t }}</option></select>
          </label>
        </div>
        <label v-if="cShowCompromiso" class="field-wrap scale-in"><span class="flabel">Fecha comprometida</span>
          <input v-model="cFecha" type="date" class="field">
        </label>
        <label class="field-wrap"><span class="flabel">Observaciones</span>
          <input v-model="cNota" class="field" placeholder="Notas del contacto (opcional)…">
        </label>
        <div class="fecha-actions">
          <button class="btn" :disabled="busy === 'contacto'" @click="showContacto = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="busy === 'contacto'" @click="guardarContacto">
            <Spinner v-if="busy === 'contacto'" />
            {{ busy === 'contacto' ? 'Guardando…' : 'Registrar contacto' }}
          </button>
        </div>
      </div>
    </ModalShell>
  </div>
</template>

<style scoped>
.hero { position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero::before { content: ''; position: absolute; left: -40px; top: -30px; width: 260px; height: 120px; background: radial-gradient(closest-side, color-mix(in srgb, var(--brand) 16%, transparent), transparent); pointer-events: none; z-index: -1; }
.hero-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand-deep); }
.hero-kicker::before { content: ''; width: 14px; height: 2px; border-radius: 2px; background: var(--brand); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 4px 0 0; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 5px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.demo-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--u-aviso); background: var(--u-aviso-tint); border: 1px solid color-mix(in srgb, var(--u-aviso) 30%, transparent); padding: 5px 10px; border-radius: var(--r-pill); cursor: help; }
.demo-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--u-aviso); animation: auroraPulse 1.6s infinite; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Transición lista ↔ detalle */
.view-enter-active, .view-leave-active { transition: opacity .28s cubic-bezier(.16,1,.3,1), transform .28s cubic-bezier(.16,1,.3,1); }
.view-enter-from { opacity: 0; transform: translateY(10px); }
.view-leave-to { opacity: 0; transform: translateY(-6px); }
/* Fade skeleton ↔ tabla */
.fade-enter-active, .fade-leave-active { transition: opacity .22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Modal helpers */
.fecha-form { display: flex; flex-direction: column; gap: 12px; }
.flabel { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.field-wrap { display: flex; flex-direction: column; gap: 5px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fecha-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-top: 4px; }
.fecha-actions .btn { justify-content: center; }
</style>
