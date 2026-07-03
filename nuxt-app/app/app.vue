<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  Truck, Boxes, Store, ClipboardCheck, Users, RefreshCw, Download, Plus,
  Search, Bell, Calendar, LayoutGrid, CheckCircle2, TriangleAlert,
} from '@lucide/vue'
import { tieneAlerta, todayISO, parseEntrega, type Guardado, type ContactoGuardado } from '~/utils/guardado'
import { SAMPLE_GUARDADOS, SAMPLE_CONTACTOS, SAMPLE_PENDIENTES, type PendienteTienda } from '~/utils/sampleData'

const guardados = ref<Guardado[]>([])
const pendientes = ref<PendienteTienda[]>([])
// demo = sin sesión/DB → usa datos de ejemplo. real = conectado a la API Nitro.
const demo = ref(false)
const me = ref<{ role: string; name: string; can: { create: boolean; edit: boolean; delete: boolean } } | null>(null)
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
    const [gRes, pRes, meRes] = await Promise.all([
      $fetch<{ data: Guardado[] }>('/api/transporte?pageSize=500'),
      $fetch<{ data: any[] }>('/api/transporte/pendientes-tienda').catch(() => ({ data: [] as any[] })),
      $fetch<any>('/api/me').catch(() => ({ authenticated: false })),
    ])
    guardados.value = gRes.data
    pendientes.value = (pRes.data ?? []).map((p: any) => ({
      id: p.id, numeroDocumento: p.despacho.numeroDocumento, clienteNombre: p.despacho.clienteNombre,
      centroCostos: p.despacho.centroCostos, numeroCajas: p.despacho.numeroCajas, nota: p.nota,
    }))
    me.value = meRes.authenticated ? meRes.user : null
    demo.value = false
  } catch {
    // Sin sesión/credenciales → modo demo con datos de ejemplo.
    demo.value = true
    guardados.value = [...SAMPLE_GUARDADOS]
    pendientes.value = [...SAMPLE_PENDIENTES]
    me.value = null
  }
}

onMounted(async () => { await loadAll(); loading.value = false })

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

// toast
const toast = ref<{ msg: string; err?: boolean } | null>(null)
let toastT: any
function showToast(msg: string, err = false) {
  toast.value = { msg, err }
  clearTimeout(toastT); toastT = setTimeout(() => (toast.value = null), 3200)
}

function onKpiFilter(key: string) {
  if (key === 'alerta') { fAlerta.value = true; return }
  fEstado.value = key
}
function openDetail(g: Guardado) { panelItem.value = g }

function apiErr(e: any, fallback: string) {
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || fallback
}

async function despachar() {
  const g = panelItem.value
  if (!g) return
  if (demo.value) { g.estado = 'DESPACHADO'; g.fechaDespacho = todayISO(); showToast('Marcado como enviado ✓'); return }
  try {
    await $fetch(`/api/transporte/${encodeURIComponent(g.clientId)}/acciones`, { method: 'POST', body: { tipo: 'despachar' } })
    g.estado = 'DESPACHADO'; g.fechaDespacho = todayISO()
    await loadAll(); showToast('Marcado como enviado ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo despachar'), true) }
}

async function revertir() {
  const g = panelItem.value
  if (!g) return
  if (demo.value) { g.estado = 'PENDIENTE DESPACHO'; g.fechaDespacho = null; showToast('Revertido a Pendiente Despacho ✓'); return }
  try {
    await $fetch(`/api/transporte/${encodeURIComponent(g.clientId)}`, { method: 'PUT', body: { estado: 'PENDIENTE DESPACHO' } })
    g.estado = 'PENDIENTE DESPACHO'; g.fechaDespacho = null
    await loadAll(); showToast('Revertido a Pendiente Despacho ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo revertir'), true) }
}

async function delGuardado() {
  const g = panelItem.value
  if (!g) return
  if (demo.value) { guardados.value = guardados.value.filter(x => x.clientId !== g.clientId); panelItem.value = null; showToast('Eliminado'); return }
  try {
    await $fetch(`/api/transporte/${encodeURIComponent(g.clientId)}`, { method: 'DELETE' })
    panelItem.value = null; await loadAll(); showToast('Eliminado')
  } catch (e) { showToast(apiErr(e, 'No se pudo eliminar'), true) }
}

function openEdit() { editing.value = panelItem.value; showForm.value = true }

async function onSaved(payload: Partial<Guardado>) {
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
}

async function registrarPendiente(p: PendienteTienda) {
  if (demo.value) { pendientes.value = pendientes.value.filter(x => x.id !== p.id); showToast('Guardado creado desde despacho tienda ✓'); return }
  const ubicacion = window.prompt(`Ubicación para guardar ${p.numeroDocumento}:`)
  if (!ubicacion || !ubicacion.trim()) return
  try {
    await $fetch('/api/transporte/pendientes-tienda', { method: 'POST', body: { pendienteId: p.id, ubicacion: ubicacion.trim(), nota: null } })
    await loadAll(); showToast('Guardado creado desde despacho tienda ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo convertir'), true) }
}

// Registrar contacto (modal)
async function guardarContacto() {
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
}

// Editar fecha de entrega (modal)
const fechaEntrega = ref('')
function openFecha() {
  if (!panelItem.value) return
  fechaEntrega.value = parseEntrega(panelItem.value.nota) ?? todayISO()
  showFecha.value = true
}
async function guardarFecha() {
  const g = panelItem.value
  if (!g) return
  if (demo.value) { showFecha.value = false; showToast('Fecha de entrega actualizada ✓'); return }
  try {
    const res = await $fetch<{ nota: string }>(`/api/transporte/${encodeURIComponent(g.clientId)}/acciones`, { method: 'POST', body: { tipo: 'fecha_entrega', fecha: fechaEntrega.value } })
    g.nota = res.nota
    showFecha.value = false; showToast('Fecha de entrega actualizada ✓')
  } catch (e) { showToast(apiErr(e, 'No se pudo actualizar'), true) }
}

const nav = [
  { icon: Store, label: 'Despachos Tienda' },
  { icon: Boxes, label: 'Novedades Inventario' },
  { icon: Truck, label: 'Guardados Transporte', active: true },
  { icon: ClipboardCheck, label: 'Preoperacional' },
  { icon: Users, label: 'Usuarios' },
]

const pendCount = computed(() => guardados.value.filter(g => g.estado === 'PENDIENTE DESPACHO').length)
const userInitials = computed(() => {
  const n = me.value?.name?.trim()
  if (!n) return 'GA'
  const parts = n.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'GA'
})
</script>

<template>
  <div class="app">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">GA</span>
        <span class="brand-name">Grupo Ambiente</span>
      </div>
      <nav class="nav">
        <a v-for="n in nav" :key="n.label" class="nav-item" :class="{ active: n.active }">
          <component :is="n.icon" :size="17" />
          <span>{{ n.label }}</span>
        </a>
      </nav>
      <div class="side-foot">
        <div class="pilot-tag"><LayoutGrid :size="12" /> Piloto Aurora · Vue</div>
      </div>
    </aside>

    <!-- Main -->
    <div class="main">
      <header class="topbar">
        <div class="crumbs"><span>Dashboard</span><span class="sep">/</span><b>Guardados Transporte</b></div>
        <div class="top-right">
          <button class="icon-btn"><Search :size="17" /></button>
          <button class="icon-btn"><Bell :size="17" /><span class="dot" /></button>
          <div class="user"><span class="avatar">{{ userInitials }}</span></div>
        </div>
      </header>

      <main class="content">
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
            <PendientesBanner :items="pendientes" class="fade-in" style="margin-bottom: 18px" @registrar="registrarPendiente" />
            <KpiRail :key="refreshKey" :items="guardados" style="margin-bottom: 18px" @filter="onKpiFilter" />
            <Toolbar
              v-model:q="q" v-model:estado="fEstado" v-model:tipo="fTipo" v-model:alerta="fAlerta" v-model:density="density"
              :count="filtered.length" :total="guardados.length" style="margin-bottom: 14px" @clear="clearFilters"
            />
            <Transition name="fade" mode="out-in">
              <ListSkeleton v-if="loading" key="sk" />
              <GuardadosList v-else key="list-real" :items="filtered" :has-filters="hasFilters" :density="density" @open="openDetail" @clear="clearFilters" @new="showForm = true" />
            </Transition>
          </div>

          <!-- Detalle -->
          <DetailView
            v-else key="detail" :g="panelItem" :contactos="contactosPanel" :can-edit="canEdit" :can-delete="canDelete"
            @back="panelItem = null" @despachar="despachar" @edit-fecha="openFecha"
            @edit="openEdit" @del="delGuardado" @revertir="revertir" @nuevo-contacto="abrirContacto"
          />
        </Transition>
      </main>
    </div>

    <!-- Modales -->
    <GuardadoModal v-if="showForm" :guardado="editing" @close="showForm = false; editing = null" @saved="onSaved" />

    <ModalShell v-if="showFecha && panelItem" title="Fecha de entrega" :sub="`${panelItem.documento} · ${panelItem.ubicacion}`" @close="showFecha = false">
      <div class="fecha-form">
        <label class="flabel">Fecha comprometida</label>
        <input v-model="fechaEntrega" type="date" class="field">
        <div class="fecha-actions">
          <button class="btn" @click="showFecha = false">Cancelar</button>
          <button class="btn btn-primary" @click="guardarFecha"><Calendar :size="14" /> Guardar fecha</button>
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
          <button class="btn" @click="showContacto = false">Cancelar</button>
          <button class="btn btn-primary" @click="guardarContacto">Registrar contacto</button>
        </div>
      </div>
    </ModalShell>

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="{ err: toast.err }">
        <span class="toast-ic"><TriangleAlert v-if="toast.err" :size="16" /><CheckCircle2 v-else :size="16" /></span>
        {{ toast.msg }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app { display: grid; grid-template-columns: var(--sidebar-w) 1fr; min-height: 100vh; }

/* Sidebar */
.sidebar { background: linear-gradient(180deg, #0E1626 0%, #0A0F1C 100%); color: #C7CDD6; display: flex; flex-direction: column; padding: 16px 12px; position: sticky; top: 0; height: 100vh; border-right: 1px solid rgba(255,255,255,.05); }
.brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 18px; }
.brand-mark { width: 30px; height: 30px; border-radius: 9px; background: var(--brand-grad); color: var(--on-brand); display: grid; place-items: center; font-family: var(--display); font-weight: 800; font-size: 13px; }
.brand-name { font-family: var(--display); font-weight: 700; font-size: 14px; color: #fff; }
.nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500; color: #97A1AF; cursor: pointer; transition: background .14s, color .14s, transform .14s; }
.nav-item :deep(svg) { transition: transform .18s cubic-bezier(.16,1,.3,1); }
.nav-item:hover { background: rgba(255,255,255,.05); color: #E7EBF0; }
.nav-item:hover:not(.active) { transform: translateX(2px); }
.nav-item:hover :deep(svg) { transform: scale(1.12); }
.nav-item.active { background: linear-gradient(90deg, color-mix(in srgb, var(--brand) 26%, transparent), color-mix(in srgb, var(--brand) 8%, transparent)); color: #fff; box-shadow: inset 3px 0 0 var(--brand-bright), 0 4px 14px -6px color-mix(in srgb, var(--brand) 60%, transparent); }
.nav-item.active :deep(svg) { color: var(--brand-bright); }
.side-foot { margin-top: auto; }
.pilot-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #6B7480; padding: 8px 10px; }

/* Topbar */
.main { display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; justify-content: space-between; height: 60px; padding: 0 26px; background: color-mix(in srgb, var(--surface) 82%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
.crumbs { font-size: 13px; color: var(--muted); }
.crumbs b { color: var(--ink); font-weight: 700; }
.crumbs .sep { margin: 0 8px; color: var(--faint); }
.top-right { display: flex; align-items: center; gap: 10px; }
.icon-btn { position: relative; background: transparent; border: none; color: var(--muted); padding: 8px; border-radius: var(--r-sm); cursor: pointer; }
.icon-btn:hover { background: var(--surface-3); color: var(--ink); }
.icon-btn .dot { position: absolute; top: 7px; right: 7px; width: 7px; height: 7px; background: var(--u-critico); border-radius: 50%; border: 1.5px solid var(--surface); }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--brand-grad); color: var(--on-brand); display: grid; place-items: center; font-weight: 700; font-size: 12px; }

/* Content */
.content { padding: 24px 26px 60px; width: min(100%, var(--page-max)); margin: 0 auto; }
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

/* Toast */
.toast { display: inline-flex; align-items: center; gap: 9px; position: fixed; bottom: 24px; right: 24px; z-index: 10000; background: var(--ink); color: #fff; padding: 12px 18px 12px 14px; border-radius: var(--r-sm); font-size: 13px; font-weight: 600; box-shadow: var(--shadow-lg); }
.toast-ic { display: inline-flex; color: var(--brand-bright); }
.toast.err { background: var(--u-critico); }
.toast.err .toast-ic { color: #fff; }
.toast-enter-active { transition: all .3s cubic-bezier(.34,1.56,.64,1); }
.toast-leave-active { transition: all .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(14px) scale(.96); }

@media (max-width: 860px) { .app { grid-template-columns: 1fr; } .sidebar { display: none; } }
</style>
