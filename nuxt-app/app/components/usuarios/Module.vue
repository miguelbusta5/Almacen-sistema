<script setup lang="ts">
// Gestión de usuarios y flota. Solo ADMIN: todos los endpoints de /api/users/*
// exigen ese rol y la matriz de módulos dice lo mismo.
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, Plus, Users as UsersIcon, Search, X } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { canSeeModule } from '~/utils/modulePermissions'
import {
  labelRol, USER_ROLES,
  type TransportistaOperativo, type Usuario, type VehiculoOperativo,
} from '~/utils/usuarios'

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const puedeVer = computed(() => canSeeModule(me.value?.role, 'usuarios'))
const selfId = computed(() => me.value?.id)

const vista = ref<'usuarios' | 'flota'>('usuarios')

const usuarios = ref<Usuario[]>([])
const vehiculos = ref<VehiculoOperativo[]>([])
const transportistas = ref<TransportistaOperativo[]>([])
const loading = ref(true)
const loadingFlota = ref(false)
const refreshing = ref(false)

const q = ref('')
const fRol = ref('')
const fEstado = ref('')
const hasFilters = computed(() => !!(q.value || fRol.value || fEstado.value))

// Filtrado en cliente: la lista completa de cuentas es pequeña (decenas) y el
// endpoint la devuelve entera, así que no hay nada que ganar filtrando en servidor.
const filtrados = computed(() => {
  const term = q.value.trim().toLowerCase()
  return usuarios.value.filter((u) => {
    if (fRol.value && u.role !== fRol.value) return false
    if (fEstado.value === 'activos' && !u.active) return false
    if (fEstado.value === 'inactivos' && u.active) return false
    if (!term) return true
    return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
  })
})

async function loadUsuarios() {
  try {
    const res = await $fetch<{ data: Usuario[] }>('/api/users')
    usuarios.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los usuarios'), true)
  }
}

async function loadFlota() {
  loadingFlota.value = true
  try {
    const [v, t] = await Promise.all([
      $fetch<{ data: VehiculoOperativo[] }>('/api/users/vehiculos'),
      $fetch<{ data: TransportistaOperativo[] }>('/api/users/transportistas-operativos'),
    ])
    vehiculos.value = v.data
    transportistas.value = t.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar la flota'), true)
  } finally {
    loadingFlota.value = false
  }
}

onMounted(async () => {
  await ensureSession()
  if (!puedeVer.value) { loading.value = false; return }
  loading.value = true
  await loadUsuarios()
  loading.value = false
})

async function irAFlota() {
  vista.value = 'flota'
  if (!vehiculos.value.length && !transportistas.value.length) await loadFlota()
}

async function refrescar() {
  if (refreshing.value) return
  refreshing.value = true
  await (vista.value === 'usuarios' ? loadUsuarios() : loadFlota())
  refreshing.value = false
}

const showModal = ref(false)
const editando = ref<Usuario | null>(null)

function nuevo() { editando.value = null; showModal.value = true }
function editar(u: Usuario) { editando.value = u; showModal.value = true }

async function onGuardado(msg: string) {
  showModal.value = false
  editando.value = null
  showToast(msg)
  await loadUsuarios()
  // Vincular una cuenta a un conductor cambia la flota, así que se refresca si ya
  // estaba cargada.
  if (vehiculos.value.length || transportistas.value.length) await loadFlota()
}

const activos = computed(() => usuarios.value.filter((u) => u.active).length)
</script>

<template>
  <div class="mod">
    <section class="hero fade-in">
      <div>
        <div class="hero-kicker">
          <span class="hero-ic"><UsersIcon :size="13" /></span> Administración
        </div>
        <h1 class="hero-title">Usuarios</h1>
        <p class="hero-desc">
          {{ loading ? 'Cargando…' : `${usuarios.length} cuenta${usuarios.length !== 1 ? 's' : ''} · ${activos} activa${activos !== 1 ? 's' : ''}` }}
        </p>
      </div>
      <div v-if="puedeVer" class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refrescar">
          <RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}
        </button>
        <button class="btn btn-primary btn-sm" @click="nuevo"><Plus :size="14" /> Nuevo usuario</button>
      </div>
    </section>

    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="La gestión de usuarios está disponible solo para administradores."
    />

    <template v-else>
      <div class="tabs">
        <button class="tab" :class="{ on: vista === 'usuarios' }" @click="vista = 'usuarios'">Cuentas</button>
        <button class="tab" :class="{ on: vista === 'flota' }" @click="irAFlota">Flota y conductores</button>
      </div>

      <template v-if="vista === 'usuarios'">
        <div class="filtros">
          <div class="search-wrap">
            <Search :size="14" class="search-ic" />
            <input v-model="q" class="field" placeholder="Buscar por nombre o correo…">
            <button v-if="q" class="search-clear" aria-label="Borrar búsqueda" @click="q = ''"><X :size="14" /></button>
          </div>
          <select v-model="fRol" class="field sel">
            <option value="">Todos los roles</option>
            <option v-for="r in USER_ROLES" :key="r" :value="r">{{ labelRol(r) }}</option>
          </select>
          <select v-model="fEstado" class="field sel">
            <option value="">Activos e inactivos</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
          </select>
          <button v-if="hasFilters" class="btn-link" @click="q = ''; fRol = ''; fEstado = ''">Limpiar</button>
        </div>

        <ListSkeleton v-if="loading" />
        <UsuariosTabla v-else :items="filtrados" :self-id="selfId" :has-filters="hasFilters" @editar="editar" />
      </template>

      <UsuariosFlotaPanel
        v-else :vehiculos="vehiculos" :transportistas="transportistas" :loading="loadingFlota"
        @reload="loadFlota" @toast="(m, e) => showToast(m, e)"
      />
    </template>

    <UsuariosUsuarioModal
      v-if="showModal && puedeVer" :initial="editando" :self-id="selfId"
      @close="showModal = false; editando = null" @saved="onGuardado"
    />
  </div>
</template>

<style scoped>
.mod { --modulo: var(--brand); }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; color: var(--modulo); background: color-mix(in srgb, var(--modulo) 13%, transparent); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 6px 0 0; }
.hero-title::after { content: ''; display: block; width: 42px; height: 3px; border-radius: 2px; background: var(--modulo); margin-top: 7px; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 7px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
.tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 9px 14px; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; margin-bottom: -1px; }
.tab:hover { color: var(--ink-2); }
.tab.on { color: var(--modulo); border-bottom-color: var(--modulo); }

.filtros { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
.search-wrap { position: relative; flex: 1 1 220px; min-width: 170px; }
.search-wrap .field { padding-left: 32px; padding-right: 32px; width: 100%; }
.search-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; display: grid; place-items: center; border: none; background: none; color: var(--muted); cursor: pointer; border-radius: var(--r-xs); }
.search-clear:hover { background: var(--surface-3); }
.sel { width: auto; }
.btn-link { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 8px 10px; }
.btn-link:hover { color: var(--ink-2); }
.fade-in { animation: auroraFade .3s cubic-bezier(.16,1,.3,1) both; }
@media (max-width: 760px) { .hero { margin-bottom: 16px; } .hero-title { font-size: 23px; } }
</style>
