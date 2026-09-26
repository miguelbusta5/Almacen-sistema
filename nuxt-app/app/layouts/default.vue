<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  Store, GitMerge, ScanLine, Forklift, PackageOpen, Tags, Globe, FileText, Truck,
  Users, ScrollText, Search, Bell, CheckCircle2, TriangleAlert, Container,
  Menu, X, LogOut, KeyRound, CornerDownLeft, Inbox, ClipboardList, PackageSearch, BellRing,
  ChartColumnIncreasing, Hammer, ClipboardCheck, SlidersHorizontal,
  Warehouse, UtensilsCrossed, Sofa, LayoutDashboard, ChevronDown,
} from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToastState } from '~/composables/useToast'
import { canSeeModule, type ModuleKey } from '~/utils/modulePermissions'
import { puedeUsarMontacargas } from '~/utils/montacargas'
import { avisarDatosCambiaron, hayActividadReciente } from '~/composables/useAutoRefresh'
import { useVersionNueva } from '~/composables/useVersionNueva'

const route = useRoute()
const { pausa: pausaOperativa, cargada: pausaCargada } = usePausaOperativa()
const muestraPausa = computed(() => ['control-montacargas', 'resurtido', 'recepcion-contenedores', 'montaje-resurtido', 'picking-muebles'].some(key => route.path.endsWith('/' + key) && canSeeModule(me.value?.role, key as ModuleKey)))
const { me, sessionLoaded, sessionInvalid } = useSessionState()
const toast = useToastState()
// Versión nueva desplegada mientras la persona estaba a mitad de algo.
const hayVersionNueva = useVersionNueva()
function actualizarVersion() { window.location.reload() }

onMounted(() => { ensureSession() })

// Sesión caducada: la app Nuxt vive detrás del rewrite de Next.js, así que el
// middleware de Next solo comprueba la cookie en la navegación inicial. Si la
// cookie expira estando dentro, la barra lateral se quedaba con un único "Inicio"
// y el usuario quedaba encerrado en el módulo sin ningún mensaje. Devolvemos al
// login de Next.js (recarga completa: es otro stack).
watch(sessionInvalid, (invalid) => {
  if (!invalid || typeof window === 'undefined') return
  const callbackUrl = encodeURIComponent(window.location.pathname)
  window.location.href = `/login?callbackUrl=${callbackUrl}`
})

// Enlaces reales: al ser un rewrite bajo el mismo dominio, los módulos sin
// migrar navegan de vuelta a la app Next.js con recarga completa (no hay SPA
// compartida entre stacks). `key` identifica el nombre de ruta interno de Nuxt
// para resaltar el ítem activo en los módulos ya migrados a Nuxt; en el resto
// queda en null porque esta barra solo se monta en páginas ya migradas.
// Mismo listado y agrupación que src/components/common/Sidebar.tsx (Next.js) —
// mantener ambos en sync.
interface NavItem { icon: unknown; label: string; href: string; key: string | null; moduleKey: ModuleKey | null }
/**
 * Menu por AREAS (25-09): va en una barra arriba, no en una columna a la
 * izquierda, para dejarle todo el ancho al contenido. Cada area es un boton con
 * su desplegable; un area con un solo modulo visible entra directo. En el
 * celular las mismas areas salen como secciones del cajon.
 *
 * Integracion Pedidos esta en Gourmet y en Muebles a proposito (lo usan las
 * dos); el buscador lo muestra una sola vez. Un area cuyos modulos no pueda ver
 * el rol no aparece.
 */
interface NavGroup { titulo: string; icon: unknown; items: NavItem[] }
const INTEGRACION: NavItem = { icon: GitMerge, label: 'Integración Pedidos', href: '/dashboard/integracion', key: 'integracion', moduleKey: 'integracion' }
const NAV_GROUPS: NavGroup[] = [
  // Sin ítem "Inicio": /dashboard ya no es una página, redirige al primer módulo
  // visible del rol (src/app/(dashboard)/dashboard/page.tsx).
  {
    titulo: 'Almacenamiento',
    icon: Warehouse,
    items: [
      { icon: Container, label: 'Recepción Contenedores', href: '/dashboard/recepcion-contenedores', key: 'recepcion-contenedores', moduleKey: 'recepcion-contenedores' },
      { icon: Forklift, label: 'Control Montacargas', href: '/dashboard/control-montacargas', key: 'control-montacargas', moduleKey: 'control-montacargas' },
      { icon: PackageOpen, label: 'Resurtido', href: '/dashboard/resurtido', key: 'resurtido', moduleKey: 'resurtido' },
      { icon: ClipboardList, label: 'Montaje Resurtido', href: '/dashboard/montaje-resurtido', key: 'montaje-resurtido', moduleKey: 'montaje-resurtido' },
      { icon: PackageSearch, label: 'Pendientes', href: '/dashboard/pendientes', key: 'pendientes', moduleKey: 'pendientes' },
      { icon: ClipboardList, label: 'Tareas generales', href: '/dashboard/tareas-generales', key: 'tareas-generales', moduleKey: 'tareas-generales' },
      { icon: PackageSearch, label: 'Capacidad picking', href: '/dashboard/capacidad-picking', key: 'capacidad-picking', moduleKey: 'capacidad-picking' },
      { icon: PackageOpen, label: 'Stretch film', href: '/dashboard/stretch-film', key: 'stretch-film', moduleKey: 'stretch-film' },
      { icon: Tags, label: 'Exportaciones Ecuador', href: '/dashboard/exportaciones', key: 'exportaciones', moduleKey: 'exportaciones' },
      { icon: Globe, label: 'Exportaciones México', href: '/dashboard/exportaciones-mexico', key: 'exportaciones-mexico', moduleKey: 'exportaciones-mexico' },
      { icon: Globe, label: 'Exportaciones EE.UU', href: '/dashboard/exportaciones-eeuu', key: 'exportaciones-eeuu', moduleKey: 'exportaciones-eeuu' },
    ],
  },
  {
    titulo: 'Inventarios',
    icon: ClipboardCheck,
    items: [
      { icon: ClipboardCheck, label: 'Inventarios', href: '/dashboard/inventarios', key: 'inventarios', moduleKey: 'inventarios' },
    ],
  },
  {
    titulo: 'Gourmet',
    icon: UtensilsCrossed,
    items: [
      { icon: ScanLine, label: 'Cargue Gourmet', href: '/dashboard/cargue-gourmet', key: 'cargue-gourmet', moduleKey: 'cargue-gourmet' },
      INTEGRACION,
    ],
  },
  {
    titulo: 'Muebles',
    icon: Sofa,
    items: [
      { icon: Hammer, label: 'Picking Muebles', href: '/dashboard/picking-muebles', key: 'picking-muebles', moduleKey: 'picking-muebles' },
      { icon: ClipboardCheck, label: 'Inspección Muebles', href: '/dashboard/inspeccion-muebles', key: 'inspeccion-muebles', moduleKey: 'inspeccion-muebles' },
      { icon: Truck, label: 'Entrega a Transporte', href: '/dashboard/entrega-muebles', key: 'entrega-muebles', moduleKey: 'entrega-muebles' },
      { icon: ScrollText, label: 'Historial Muebles', href: '/dashboard/historial-muebles', key: 'historial-muebles', moduleKey: 'historial-muebles' },
      { icon: SlidersHorizontal, label: 'Admin Muebles', href: '/dashboard/admin-muebles', key: 'admin-muebles', moduleKey: 'admin-muebles' },
      INTEGRACION,
    ],
  },
  {
    titulo: 'Transporte',
    icon: Truck,
    items: [
      { icon: Truck, label: 'Cargue de camiones', href: '/dashboard/cargue-camiones', key: 'cargue-camiones', moduleKey: 'cargue-camiones' },
      { icon: Truck, label: 'Guardados', href: '/dashboard/transporte', key: 'transporte', moduleKey: 'transporte' },
      { icon: FileText, label: 'Solicitudes Transporte', href: '/dashboard/solicitudes-transporte', key: 'solicitudes-transporte', moduleKey: 'solicitudes-transporte' },
      { icon: Store, label: 'Facturas Contado', href: '/dashboard/tienda', key: 'tienda', moduleKey: 'tienda' },
      // Quien no ve Indicadores (supervision de transporte) entra directo a su area.
      { icon: ChartColumnIncreasing, label: 'Indicadores Transporte', href: '/dashboard/indicadores?area=transporte', key: 'indicadores-transporte', moduleKey: 'indicadores-transporte' },
    ],
  },
  {
    titulo: 'Gestión',
    icon: LayoutDashboard,
    items: [
      { icon: ChartColumnIncreasing, label: 'Indicadores', href: '/dashboard/indicadores', key: 'indicadores', moduleKey: 'indicadores' },
      { icon: Users, label: 'Usuarios', href: '/dashboard/usuarios', key: 'usuarios', moduleKey: 'usuarios' },
      { icon: ScrollText, label: 'Auditoría', href: '/dashboard/auditoria', key: 'auditoria', moduleKey: 'auditoria' },
    ],
  },
]
const navSearch = ref('')
const collapsed = ref<Record<string, boolean>>({})
const normalizeNav = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
function visibleItem(item: NavItem): boolean {
  return (item.moduleKey === null || canSeeModule(me.value?.role, item.moduleKey))
    && (item.moduleKey !== 'indicadores-transporte' || !canSeeModule(me.value?.role, 'indicadores'))
    && (item.moduleKey !== 'capacidad-picking' || !!me.value?.can.capacidadPicking)
    && (item.moduleKey !== 'inventarios' || !!me.value?.can.gestionarInventarios || !!me.value?.can.contarInventarios)
    && (item.moduleKey !== 'stretch-film' || !!me.value?.can.stretch?.gestionar || !!me.value?.can.stretch?.solicitar)
}
const visibleGroups = computed(() => NAV_GROUPS
  .map((g) => ({
    titulo: g.titulo,
    icon: g.icon,
    items: g.items.filter((item) => visibleItem(item) && normalizeNav(item.label).includes(normalizeNav(navSearch.value))),
  }))
  .filter((g) => g.items.length > 0))
// Igualdad exacta, NO startsWith: con `startsWith`, la clave 'exportaciones'
// también matchea 'exportaciones-mexico' y 'exportaciones-eeuu', y estando en
// México se resaltaban dos ítems a la vez. Ninguna ruta tiene sub-rutas, así que
// la igualdad es equivalente para el resto de módulos.
function isActive(key: string | null) {
  return !!key && route.name?.toString() === key
}
// Las areas de la barra: las mismas, sin el filtro del buscador del cajon.
const areas = computed(() => NAV_GROUPS
  .map((g) => ({ ...g, items: g.items.filter((item) => visibleItem(item)) }))
  .filter((g) => g.items.length > 0))
const areaActiva = computed(() => areas.value.find((g) => g.items.some((n) => isActive(n.key)))?.titulo ?? null)

// Menú móvil: bajo 1080px las áreas no caben arriba y el menú se abre como cajón.
// Sin esto la barra quedaba en `display: none` y el usuario se quedaba encerrado
// en el módulo Nuxt en el que aterrizó, sin forma de navegar a los demás
// (la Sidebar de Next.js sí tiene este cajón — ver src/components/common/Sidebar.tsx).
const navOpen = ref(false)
watch(() => route.fullPath, () => { navOpen.value = false })

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? '')
const userInitials = computed(() => {
  const n = me.value?.name?.trim()
  if (!n) return 'GA'
  const parts = n.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'GA'
})

// ── Paneles de la barra superior ───────────────────────────────────
// Uno a la vez: abrir el buscador con el menu de usuario abierto dejaba dos
// capas superpuestas sobre el mismo rincon de la pantalla.
type Panel = 'buscar' | 'avisos' | 'usuario' | `area:${string}` | null
const panel = ref<Panel>(null)
function abrir(p: Exclude<Panel, null>) {
  panel.value = panel.value === p ? null : p
  if (panel.value === 'buscar') {
    void nextTick(() => buscarInput.value?.focus())
  }
  if (panel.value === 'avisos') void marcarVistos()
}
function cerrarPaneles() { panel.value = null }

// ── Buscador de modulos ─────────────────────────────────────────────
// Busca entre los modulos que el usuario PUEDE ver, no entre todos: ofrecer un
// modulo al que no tiene acceso solo lleva a una pantalla de "sin permiso".
const buscarInput = ref<HTMLInputElement | null>(null)
const consulta = ref('')
const sinTildes = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const resultados = computed(() => {
  const q = sinTildes(consulta.value.trim())
  // Integracion esta en dos areas: una sola vez en el buscador.
  const todos = [...new Map(visibleGroups.value.flatMap((g) => g.items).map((n) => [n.href, n])).values()]
  if (!q) return todos
  return todos.filter((n) => sinTildes(n.label).includes(q))
})
function irA(item: { href: string }) {
  cerrarPaneles()
  window.location.href = item.href
}

// ── Avisos ──────────────────────────────────────────────────────────
// Dos cosas distintas en la misma campana: el trabajo que el usuario tiene en la
// mano ahora (sus PLUs por flujo) y los avisos que le han llegado (un pendiente
// ubicado, un resurtido terminado). El punto rojo solo se enciende si hay algo:
// uno permanente acaba significando "siempre hay algo", o sea nada.
interface Pendiente { label: string; total: number; href: string }
const pendientes = ref<Pendiente[]>([])

interface Aviso {
  id: string; tipo: string; titulo: string
  descripcion: string | null; enlace: string | null; leida: boolean; createdAt: string
}
const avisos = ref<Aviso[]>([])
const sinLeer = computed(() => avisos.value.filter((a) => !a.leida).length)

const totalPendiente = computed(
  () => pendientes.value.reduce((n, p) => n + p.total, 0) + sinLeer.value,
)

async function cargarPendientes() {
  if (!me.value || !puedeUsarMontacargas(me.value.role)) {
    pendientes.value = []
    return
  }
  try {
    // Sin prefijo: el $fetch de Nuxt ya antepone el baseURL '/dashboard/'.
    const res = await $fetch<{ data: Record<string, number> }>('/api/montacargas/mis-pendientes')
    pendientes.value = [
      { label: 'Recepcion', total: res.data.RECEPCION ?? 0, href: '/dashboard/control-montacargas' },
      { label: 'Movimientos de deposito', total: res.data.MOVIMIENTO ?? 0, href: '/dashboard/resurtido' },
      { label: 'Resurtido', total: res.data.RESURTIDO ?? 0, href: '/dashboard/resurtido' },
    ].filter((p) => p.total > 0)
  } catch {
    // Un aviso que no carga no puede tumbar la barra superior.
    pendientes.value = []
  }
}

let avisosCargados = false
async function cargarAvisos() {
  if (!me.value) { avisos.value = []; return }
  try {
    const antes = new Set(avisos.value.map((a) => a.id))
    const primeraCarga = !avisosCargados
    const res = await $fetch<{ data: Aviso[] }>('/api/notificaciones')
    avisos.value = res.data
    avisosCargados = true
    // Llego un aviso nuevo (te asignaron algo): la pantalla abierta vuelve a
    // traer sus datos ya, sin esperar su turno de refresco.
    if (!primeraCarga && res.data.some((a) => !a.leida && !antes.has(a.id))) avisarDatosCambiaron()
  } catch {
    avisos.value = []
  }
}

/**
 * Marca como vistos al abrir el panel.
 *
 * Abrirlo ES verlos: hasta ese momento la alerta persiste, que es justo lo que
 * hace que un aviso sirva para enterarse de algo que paso mientras no mirabas.
 */
async function marcarVistos() {
  if (sinLeer.value === 0) return
  try {
    await $fetch('/api/notificaciones/leer', { method: 'POST', body: {} })
    avisos.value = avisos.value.map((a) => ({ ...a, leida: true }))
  } catch { /* se reintenta al proximo abrir */ }
}

watch(() => me.value?.id, () => {
  void cargarPendientes()
  void cargarAvisos()
}, { immediate: true })

// Los avisos llegan solos: sin esto habria que recargar para enterarse.
let latido: ReturnType<typeof setInterval> | null = null
// Cada 60 s y solo con alguien usando la pantalla: un aviso nuevo dispara el
// refresco inmediato de la pantalla.
onMounted(() => { latido = setInterval(() => { if (document.visibilityState === 'visible' && hayActividadReciente()) void cargarAvisos() }, 60_000) })
onBeforeUnmount(() => { if (latido) clearInterval(latido) })

// ── Sesion ──────────────────────────────────────────────────────────
const cerrando = ref(false)
/**
 * Cierra la sesion contra Auth.js, que vive en la app Next.js.
 *
 * Nuxt esta detras de un rewrite del mismo dominio, asi que /api/auth/* llega a
 * Next; no se puede usar el signOut de next-auth/react porque es otro stack. El
 * flujo es el mismo que hace esa libreria por dentro: pedir el csrfToken y
 * postearlo como formulario.
 *
 * Con fetch nativo y NO con $fetch: el de Nuxt antepone el baseURL '/dashboard/'
 * y la peticion acabaria en /dashboard/api/auth/csrf, que es la propia app Nuxt
 * y no Auth.js.
 */
async function cerrarSesion() {
  if (cerrando.value) return
  cerrando.value = true
  try {
    const csrfRes = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, callbackUrl: '/login', json: 'true' }).toString(),
    })
  } catch {
    // Da igual por que fallo: se va al login igual y alli se re-evalua la
    // cookie. Quedarse dentro con el boton pulsado seria lo peor de los dos.
  }
  window.location.href = '/login'
}
</script>

<template>
  <div class="app">
    <!-- Overlay del cajón móvil -->
    <div v-if="navOpen" class="nav-overlay" @click="navOpen = false" />

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: navOpen }">
      <div class="brand">
        <span class="brand-mark">GA</span>
        <span class="brand-name">Grupo Ambiente</span>
        <button class="nav-close" aria-label="Cerrar menú" @click="navOpen = false"><X :size="18" /></button>
      </div>
      <label class="nav-search"><Search :size="16" /><input v-model="navSearch" type="search" placeholder="Buscar módulo" aria-label="Buscar módulo en el menú" /></label>
      <nav class="nav" aria-label="Módulos">
        <!-- Sin esto la barra parpadea con solo "Inicio" hasta que /api/me responde. -->
        <div v-if="!sessionLoaded" class="nav-group">
          <span v-for="i in 5" :key="i" class="nav-skel" />
        </div>
        <div v-for="(group, gi) in visibleGroups" v-else :key="gi" class="nav-group">
          <button class="nav-titulo nav-toggle" :aria-expanded="!!navSearch || !collapsed[group.titulo]" @click="collapsed[group.titulo] = !collapsed[group.titulo]">{{ group.titulo }} <span aria-hidden="true">{{ collapsed[group.titulo] && !navSearch ? '+' : '−' }}</span></button>
          <a
            v-for="n in group.items" :key="n.label" :href="n.href"
            v-show="navSearch || !collapsed[group.titulo]"
            :aria-current="isActive(n.key) ? 'page' : undefined"
            class="nav-item" :class="{ active: isActive(n.key) }"
          >
            <component :is="n.icon" :size="17" />
            <span>{{ n.label }}</span>
          </a>
        </div>
      </nav>
      <p v-if="sessionLoaded && !visibleGroups.length" class="nav-empty">No hay módulos que coincidan.</p>

      <!-- Firma de autoria, al pie y discreta. -->
      <div class="firma">
        <span class="firma-txt">Powered by</span>
        <span class="firma-marca">GreenFox</span>
      </div>
    </aside>

    <!-- Main -->
    <div class="main">
      <header class="topbar">
        <!-- Cierra cualquier panel abierto (areas incluidas) al pulsar fuera. -->
        <div v-if="panel" class="panel-overlay" @click="cerrarPaneles" />
        <button class="menu-btn" aria-label="Abrir menú" @click="navOpen = true"><Menu :size="18" /></button>
        <span class="brand brand-top">
          <span class="brand-mark">GA</span>
          <span class="brand-name">Grupo Ambiente</span>
        </span>
        <div class="crumbs"><b>{{ pageTitle }}</b></div>

        <!-- Areas: un boton con su desplegable; con un solo modulo, entra directo. -->
        <nav class="areas" aria-label="Áreas">
          <template v-if="sessionLoaded">
            <div v-for="g in areas" :key="g.titulo" class="top-item">
              <a
                v-if="g.items.length === 1" :href="g.items[0]!.href" class="area-btn"
                :class="{ active: areaActiva === g.titulo }" :aria-current="areaActiva === g.titulo ? 'page' : undefined"
              >
                <component :is="g.icon" :size="16" /> {{ g.titulo }}
              </a>
              <button
                v-else class="area-btn" :class="{ active: areaActiva === g.titulo, on: panel === `area:${g.titulo}` }"
                :aria-expanded="panel === `area:${g.titulo}`" @click="abrir(`area:${g.titulo}`)"
              >
                <component :is="g.icon" :size="16" /> {{ g.titulo }} <ChevronDown :size="14" class="area-chev" />
              </button>
              <div v-if="panel === `area:${g.titulo}`" class="pop pop-area" :class="{ ancho: g.items.length > 6 }">
                <div class="pop-head">{{ g.titulo }}</div>
                <div class="area-grid">
                  <a
                    v-for="n in g.items" :key="n.href" :href="n.href" class="pop-row"
                    :class="{ actual: isActive(n.key) }" :aria-current="isActive(n.key) ? 'page' : undefined"
                  >
                    <component :is="n.icon" :size="15" />
                    <span>{{ n.label }}</span>
                  </a>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <span v-for="i in 5" :key="i" class="area-skel" />
          </template>
        </nav>

        <div class="top-right">

          <div class="top-item">
            <button
              class="icon-btn" :class="{ on: panel === 'buscar' }"
              aria-label="Buscar modulo" @click="abrir('buscar')"
            >
              <Search :size="17" />
            </button>
            <div v-if="panel === 'buscar'" class="pop pop-buscar">
              <input
                ref="buscarInput" v-model="consulta" class="pop-input"
                type="search" placeholder="Buscar modulo..." autocomplete="off"
                @keydown.esc="cerrarPaneles"
                @keydown.enter.prevent="resultados[0] && irA(resultados[0])"
              >
              <ul v-if="resultados.length" class="pop-list">
                <li v-for="r in resultados" :key="r.label">
                  <button class="pop-row" @click="irA(r)">
                    <component :is="r.icon" :size="15" />
                    <span>{{ r.label }}</span>
                    <CornerDownLeft :size="12" class="pop-key" />
                  </button>
                </li>
              </ul>
              <p v-else class="pop-vacio">Ningun modulo coincide</p>
            </div>
          </div>

          <div class="top-item">
            <button
              class="icon-btn" :class="{ on: panel === 'avisos' }"
              aria-label="Avisos" @click="abrir('avisos')"
            >
              <Bell :size="17" />
              <!-- Solo cuando hay algo: un punto permanente no avisa de nada. -->
              <span v-if="totalPendiente > 0" class="dot" />
            </button>
            <div v-if="panel === 'avisos'" class="pop pop-avisos">
              <template v-if="avisos.length">
                <div class="pop-head">Avisos</div>
                <ul class="pop-list">
                  <li v-for="a in avisos.slice(0, 8)" :key="a.id">
                    <button
                      class="pop-row aviso" :class="{ nuevo: !a.leida }"
                      @click="a.enlace ? irA({ href: a.enlace }) : cerrarPaneles()"
                    >
                      <BellRing :size="15" />
                      <span class="aviso-txt">
                        <b>{{ a.titulo }}</b>
                        <em v-if="a.descripcion">{{ a.descripcion }}</em>
                      </span>
                    </button>
                  </li>
                </ul>
              </template>

              <div class="pop-head">Pendiente por ubicar</div>
              <ul v-if="pendientes.length" class="pop-list">
                <li v-for="p in pendientes" :key="p.label">
                  <button class="pop-row" @click="irA(p)">
                    <Inbox :size="15" />
                    <span>{{ p.label }}</span>
                    <b class="pop-num tnum">{{ p.total }}</b>
                  </button>
                </li>
              </ul>
              <p v-else class="pop-vacio">Nada pendiente. Todo ubicado.</p>
            </div>
          </div>

          <div class="top-item">
            <button
              class="user" :class="{ on: panel === 'usuario' }"
              aria-label="Menu de usuario" @click="abrir('usuario')"
            >
              <span class="avatar">{{ userInitials }}</span>
            </button>
            <div v-if="panel === 'usuario'" class="pop pop-user">
              <div class="pop-user-head">
                <span class="avatar lg">{{ userInitials }}</span>
                <div class="pop-user-txt">
                  <b>{{ me?.name ?? 'Usuario' }}</b>
                  <span>{{ me?.email ?? '' }}</span>
                </div>
              </div>
              <a class="pop-row" href="/cambiar-password">
                <KeyRound :size="15" /><span>Cambiar contrasena</span>
              </a>
              <button class="pop-row danger" :disabled="cerrando" @click="cerrarSesion">
                <LogOut :size="15" />
                <span>{{ cerrando ? 'Cerrando...' : 'Cerrar sesion' }}</span>
              </button>
              <div class="firma firma-pop">
                <span class="firma-txt">Powered by</span>
                <span class="firma-marca">GreenFox</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="content">
        <!-- Alerta que PERMANECE hasta que se ve: la campana hay que mirarla, y
             un pendiente ubicado o un resurtido terminado no puede depender de
             que a alguien se le ocurra abrirla. -->
        <button v-if="sinLeer > 0" class="alerta" @click="abrir('avisos')">
          <BellRing :size="16" />
          <span>
            Tienes <b>{{ sinLeer }}</b> aviso{{ sinLeer !== 1 ? 's' : '' }} sin leer
          </span>
          <span class="alerta-cta">Ver</span>
        </button>

        <PausaOperativa v-if="muestraPausa" />
        <div :inert="muestraPausa && (!!pausaOperativa || !pausaCargada)">
          <slot />
        </div>
      </main>
    </div>

    <!-- Versión nueva: solo sale si la persona estaba escribiendo; si no, se
         actualizó sola. Al cambiar de módulo también entra con la nueva. -->
    <div v-if="hayVersionNueva" class="version-nueva" role="status">
      <span>Hay una versión nueva de la app.</span>
      <button class="btn btn-sm btn-primary" @click="actualizarVersion">Actualizar</button>
    </div>

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
.version-nueva { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 900; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; max-width: calc(100vw - 32px); padding: 10px 14px; border-radius: var(--r-md); border: 1px solid var(--brand); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; box-shadow: 0 12px 34px rgba(0,0,0,.18); }
.app { display: block; min-height: 100vh; }

/* Sidebar */
.nav-search{display:flex;align-items:center;gap:8px;padding:10px 12px;margin:0 0 18px;border:1px solid #293344;border-radius:10px;color:#94a3b8;flex-shrink:0}
.nav-search input{min-width:0;width:100%;background:transparent;border:0;color:#e2e8f0;font:inherit;font-size:12px;outline:none}
.nav-search:focus-within{border-color:#00b88c;box-shadow:0 0 0 2px #00b88c33}
.nav-empty{font-size:12px;padding:12px;color:#94a3b8}
.sidebar .nav{overflow-x:hidden;min-height:0;scrollbar-width:thin;scrollbar-color:#465267 transparent;padding-right:3px}
.sidebar .nav-toggle{border:0;background:none;display:flex;align-items:center;justify-content:space-between;cursor:pointer;text-align:left;width:100%;color:#94a3b8;min-height:32px}
.sidebar .nav-item{text-decoration:none;min-width:0;line-height:1.4}
.sidebar .nav-item span{white-space:normal;overflow-wrap:anywhere}
.sidebar .nav-item svg{flex-shrink:0}
.sidebar .nav-item:focus-visible,.sidebar .nav-toggle:focus-visible{outline:2px solid #00b88c;outline-offset:-2px}
.sidebar { background: linear-gradient(180deg, #0E1626 0%, #0A0F1C 100%); color: #C7CDD6; display: flex; flex-direction: column; padding: 16px 12px; position: sticky; top: 0; height: 100vh; border-right: 1px solid rgba(255,255,255,.05); }
.brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 18px; }
.nav-close { display: none; margin-left: auto; background: none; border: none; color: #97A1AF; cursor: pointer; padding: 4px; }
.nav-close:hover { color: #fff; }
.brand-mark { width: 30px; height: 30px; border-radius: 9px; background: var(--brand-grad); color: var(--on-brand); display: grid; place-items: center; font-family: var(--display); font-weight: 800; font-size: 13px; }
.brand-name { font-family: var(--display); font-weight: 700; font-size: 14px; color: #fff; }
.nav { display: flex; flex-direction: column; gap: 18px; overflow-y: auto; }
.nav-group { display: flex; flex-direction: column; gap: 2px; }
/* Titulo de bloque: lo justo para cortar la lista sin competir con los enlaces.
   Por eso va en un gris apagado y a menor tamano que los propios items. */
.nav-titulo {
  padding: 0 12px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .11em;
  text-transform: uppercase;
  color: #5D6775;
}
.nav-skel { height: 37px; border-radius: var(--r-sm); background: rgba(255,255,255,.05); animation: nav-skel-pulse 1.3s ease-in-out infinite; }
@keyframes nav-skel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
.nav-item { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500; color: #97A1AF; cursor: pointer; transition: background .14s, color .14s, transform .14s; }
.nav-item :deep(svg) { transition: transform .18s cubic-bezier(.16,1,.3,1); }
.nav-item:hover { background: rgba(255,255,255,.05); color: #E7EBF0; }
.nav-item:hover:not(.active) { transform: translateX(2px); }
.nav-item:hover :deep(svg) { transform: scale(1.12); }
.nav-item.active { background: linear-gradient(90deg, color-mix(in srgb, var(--brand) 26%, transparent), color-mix(in srgb, var(--brand) 8%, transparent)); color: #fff; box-shadow: inset 3px 0 0 var(--brand-bright), 0 4px 14px -6px color-mix(in srgb, var(--brand) 60%, transparent); }
.nav-item.active :deep(svg) { color: var(--brand-bright); }

/* Topbar: marca + areas + herramientas. Sin barra lateral en escritorio. */
.main { display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; gap: 14px; height: 60px; padding: 0 22px; background: color-mix(in srgb, var(--surface) 82%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
.menu-btn { display: none; background: var(--surface); border: 1px solid var(--border); color: var(--brand); border-radius: var(--r-sm); width: 36px; height: 36px; align-items: center; justify-content: center; cursor: pointer; margin-right: 12px; flex-shrink: 0; }
.crumbs { display: none; font-size: 13px; color: var(--muted); margin-right: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.brand-top { padding: 0; margin-right: 6px; flex-shrink: 0; }
.brand-top .brand-name { color: var(--ink); white-space: nowrap; }
.areas { display: flex; align-items: center; gap: 2px; margin-right: auto; min-width: 0; }
.area-btn {
  display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 12px;
  border: none; border-radius: var(--r-sm); background: none; cursor: pointer; white-space: nowrap;
  font-size: 13px; font-weight: 600; color: var(--muted); text-decoration: none; position: relative;
  transition: background .14s, color .14s;
}
.area-btn:hover, .area-btn.on { background: var(--surface-3); color: var(--ink); }
.area-btn:focus-visible { outline: none; box-shadow: var(--ring); }
.area-btn.active { color: var(--ink); }
.area-btn.active :deep(svg:first-child) { color: var(--brand); }
/* El area donde estoy: una raya esmeralda debajo, como una pestaña. */
.area-btn.active::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: -11px; height: 2px; border-radius: 2px; background: var(--brand); }
.area-chev { color: var(--faint); transition: transform .16s; }
.area-btn.on .area-chev { transform: rotate(180deg); }
.area-skel { width: 96px; height: 14px; margin: 0 10px; border-radius: 7px; background: var(--surface-3); animation: nav-skel-pulse 1.3s ease-in-out infinite; }
.pop-area { left: 0; right: auto; width: 250px; }
.pop-area.ancho { width: 460px; }
.area-grid { display: grid; grid-template-columns: 1fr; gap: 1px; }
.pop-area.ancho .area-grid { grid-template-columns: 1fr 1fr; }
.pop-row.actual { background: var(--brand-tint); color: var(--ink); font-weight: 600; }
.pop-row.actual :deep(svg) { color: var(--brand); }
.firma-pop { margin-top: 5px; padding: 10px 11px 4px; border-top: 1px solid var(--border); }
.crumbs b { color: var(--ink); font-weight: 700; }
.crumbs .sep { margin: 0 8px; color: var(--faint); }
.top-right { display: flex; align-items: center; gap: 10px; }
.icon-btn { position: relative; background: transparent; border: none; color: var(--muted); padding: 8px; border-radius: var(--r-sm); cursor: pointer; }
.icon-btn:hover { background: var(--surface-3); color: var(--ink); }
.icon-btn .dot { position: absolute; top: 7px; right: 7px; width: 7px; height: 7px; background: var(--u-critico); border-radius: 50%; border: 1.5px solid var(--surface); }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--brand-grad); color: var(--on-brand); display: grid; place-items: center; font-weight: 700; font-size: 12px; }

/* Content */
.content { padding: 22px 26px 60px; width: min(100%, var(--page-max)); margin: 0 auto; }

/* Toast */
.toast { display: inline-flex; align-items: center; gap: 9px; position: fixed; bottom: 24px; right: 24px; z-index: 10000; background: var(--ink); color: #fff; padding: 12px 18px 12px 14px; border-radius: var(--r-sm); font-size: 13px; font-weight: 600; box-shadow: var(--shadow-lg); }
.toast-ic { display: inline-flex; color: var(--brand-bright); }
.toast.err { background: var(--u-critico); }
.toast.err .toast-ic { color: #fff; }
.toast-enter-active { transition: all .3s cubic-bezier(.34,1.56,.64,1); }
.toast-leave-active { transition: all .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(14px) scale(.96); }

/* Cajón móvil */
.nav-overlay { position: fixed; inset: 0; z-index: 400; background: rgba(10, 15, 28, .5); backdrop-filter: blur(4px); }

/* Escritorio: la barra lateral no existe; solo vive como cajon en el celular. */
@media (min-width: 1081px) { .sidebar, .nav-overlay { display: none; } }
@media (max-width: 1080px) {
  .areas, .brand-top { display: none; }
  .crumbs { display: block; }
  .sidebar {
    position: fixed; top: 0; left: 0; z-index: 401; width: var(--sidebar-w);
    transform: translateX(-110%); transition: transform .26s cubic-bezier(.16,1,.3,1);
  }
  .sidebar.open { transform: none; box-shadow: var(--shadow-lg); }
  .menu-btn, .nav-close { display: inline-flex; }
}
/* Barra superior: paneles */
.top-item { position: relative; display: flex; }
.panel-overlay { position: fixed; inset: 0; z-index: 30; }
.topbar > .top-item, .areas .top-item, .top-right .top-item { z-index: 31; }
.icon-btn.on, .user.on { background: var(--surface-3); color: var(--ink); }
.user { background: transparent; border: none; padding: 2px; border-radius: 50%; cursor: pointer; line-height: 0; }
.user:hover .avatar, .user.on .avatar { box-shadow: 0 0 0 3px var(--brand-ring); }
.avatar { transition: box-shadow .16s; }
.avatar.lg { width: 38px; height: 38px; font-size: 14px; }

.pop {
  position: absolute; top: calc(100% + 9px); right: 0; z-index: 31;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-md); box-shadow: var(--shadow-lg); padding: 6px;
  animation: popIn .16s cubic-bezier(.16,1,.3,1) both;
}
@keyframes popIn { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: none } }
.pop-buscar { width: 290px; }
.pop-avisos { width: 268px; }
.pop-user { width: 244px; }

.pop-input {
  width: 100%; height: 36px; padding: 0 11px; margin-bottom: 4px;
  border: 1px solid var(--border-strong); border-radius: var(--r-sm);
  background: var(--surface-2); color: var(--ink); font-size: 13px;
}
.pop-input:focus { outline: none; border-color: var(--brand); box-shadow: var(--ring); }
.pop-head, .pop-vacio {
  padding: 9px 11px; font-size: 11px; font-weight: 700; letter-spacing: .05em;
  text-transform: uppercase; color: var(--faint);
}
.pop-vacio { text-transform: none; letter-spacing: 0; font-weight: 500; font-size: 12.5px; color: var(--muted); }
.pop-list { list-style: none; margin: 0; padding: 0; max-height: 280px; overflow-y: auto; }
.pop-row {
  width: 100%; display: flex; align-items: center; gap: 9px; padding: 8px 11px;
  background: none; border: none; border-radius: var(--r-sm); cursor: pointer;
  font-size: 13px; color: var(--ink-2); text-align: left; text-decoration: none;
}
.pop-row:hover { background: var(--surface-3); color: var(--ink); }
.pop-row:disabled { opacity: .6; cursor: default; }
.pop-row.danger { color: var(--u-critico); }
.pop-row.danger:hover { background: color-mix(in srgb, var(--u-critico) 9%, transparent); }
.pop-row span { flex: 1 1 auto; }
.pop-key { color: var(--faint); flex-shrink: 0; }
.pop-num { color: var(--brand); font-size: 13px; flex-shrink: 0; }
.pop-user-head {
  display: flex; align-items: center; gap: 10px; padding: 10px 11px 12px;
  border-bottom: 1px solid var(--border); margin-bottom: 5px;
}
.pop-user-txt { display: flex; flex-direction: column; min-width: 0; }
.pop-user-txt b { font-size: 13px; color: var(--ink); }
.pop-user-txt span { font-size: 11px; color: var(--muted); font-family: var(--mono); overflow: hidden; text-overflow: ellipsis; }

/* Firma de autoria */
.firma {
  margin-top: auto; padding: 14px 12px 4px;
  border-top: 1px solid rgba(255,255,255,.06);
  display: flex; align-items: baseline; gap: 5px;
}
.firma-txt { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #5D6775; }
.firma-marca {
  font-family: var(--display); font-size: 12px; font-weight: 700; letter-spacing: -.01em;
  background: var(--brand-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
/* Aviso dentro del panel de la campana */
.pop-row.aviso { align-items: flex-start; }
.aviso-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.aviso-txt b { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.aviso-txt em { font-size: 11.5px; font-style: normal; color: var(--muted); }
/* Sin leer: una barra a la izquierda, que se ve sin tener que comparar. */
.pop-row.aviso.nuevo { box-shadow: inset 2px 0 0 var(--brand); background: var(--brand-tint); }

/* Alerta persistente: se queda hasta que se abre la campana. */
.alerta {
  display: flex; align-items: center; gap: 10px; width: 100%;
  margin: 0 0 18px; padding: 11px 15px; cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--brand) 40%, var(--border));
  border-radius: var(--r-md); background: var(--brand-tint);
  color: var(--ink); font-size: 13px; text-align: left;
  animation: auroraFade .3s cubic-bezier(.16,1,.3,1) both;
}
.alerta:hover { border-color: var(--brand); }
.alerta > span { flex: 1; }
.alerta b { font-weight: 700; }
.alerta :deep(svg) { color: var(--brand); flex-shrink: 0; }
.alerta-cta { flex: 0 0 auto !important; font-weight: 700; color: var(--brand); }
</style>
