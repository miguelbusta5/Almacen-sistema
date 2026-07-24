<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Home, ShieldCheck, Store, GitMerge, ScanLine, Tags, Globe, FileText, Truck,
  BarChart3, Map, Users, ScrollText, Search, Bell, CheckCircle2, TriangleAlert,
  Menu, X,
} from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToastState } from '~/composables/useToast'
import { canSeeModule, type ModuleKey } from '~/utils/modulePermissions'

const route = useRoute()
const { me, sessionLoaded, sessionInvalid } = useSessionState()
const toast = useToastState()

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
const NAV_GROUPS: NavItem[][] = [
  [
    { icon: Home, label: 'Inicio', href: '/dashboard', key: null, moduleKey: null },
    { icon: ShieldCheck, label: 'Preoperacional', href: '/dashboard/preoperacional', key: 'preoperacional', moduleKey: 'preoperacional' },
  ],
  [
    { icon: Store, label: 'Facturas Contado', href: '/dashboard/tienda', key: 'tienda', moduleKey: 'tienda' },
    { icon: GitMerge, label: 'Integración Pedidos', href: '/dashboard/integracion', key: 'integracion', moduleKey: 'integracion' },
    { icon: ScanLine, label: 'Cargue Gourmet', href: '/dashboard/cargue-gourmet', key: 'cargue-gourmet', moduleKey: 'cargue-gourmet' },
    { icon: Tags, label: 'Exportaciones Ecuador', href: '/dashboard/exportaciones', key: null, moduleKey: 'exportaciones' },
    { icon: Globe, label: 'Exportaciones México', href: '/dashboard/exportaciones-mexico', key: null, moduleKey: 'exportaciones-mexico' },
    { icon: Globe, label: 'Exportaciones EE.UU', href: '/dashboard/exportaciones-eeuu', key: null, moduleKey: 'exportaciones-eeuu' },
    { icon: FileText, label: 'Solicitudes Transporte', href: '/dashboard/solicitudes-transporte', key: null, moduleKey: 'solicitudes-transporte' },
    { icon: Truck, label: 'Guardados', href: '/dashboard/transporte', key: 'transporte', moduleKey: 'transporte' },
  ],
  [
    { icon: BarChart3, label: 'Centro de Control', href: '/dashboard/centro-control', key: null, moduleKey: 'centro-control' },
    { icon: Map, label: 'Mapa de Ciudades', href: '/dashboard/mapa-ciudades', key: null, moduleKey: 'mapa-ciudades' },
  ],
  [
    { icon: Users, label: 'Usuarios', href: '/dashboard/usuarios', key: null, moduleKey: 'usuarios' },
    { icon: ScrollText, label: 'Auditoría', href: '/dashboard/auditoria', key: null, moduleKey: 'auditoria' },
  ],
]
const visibleGroups = computed(() => NAV_GROUPS
  .map((group) => group.filter((item) => item.moduleKey === null || canSeeModule(me.value?.role, item.moduleKey)))
  .filter((group) => group.length > 0))
function isActive(key: string | null) {
  return !!key && route.name?.toString().startsWith(key)
}

// Menú móvil: bajo 860px la barra lateral sale del flujo y se abre como cajón.
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
      <nav class="nav">
        <!-- Sin esto la barra parpadea con solo "Inicio" hasta que /api/me responde. -->
        <div v-if="!sessionLoaded" class="nav-group">
          <span v-for="i in 5" :key="i" class="nav-skel" />
        </div>
        <div v-for="(group, gi) in visibleGroups" v-else :key="gi" class="nav-group">
          <a v-for="n in group" :key="n.label" :href="n.href" class="nav-item" :class="{ active: isActive(n.key) }">
            <component :is="n.icon" :size="17" />
            <span>{{ n.label }}</span>
          </a>
        </div>
      </nav>
    </aside>

    <!-- Main -->
    <div class="main">
      <header class="topbar">
        <button class="menu-btn" aria-label="Abrir menú" @click="navOpen = true"><Menu :size="18" /></button>
        <div class="crumbs"><span>Dashboard</span><span class="sep">/</span><b>{{ pageTitle }}</b></div>
        <div class="top-right">
          <button class="icon-btn"><Search :size="17" /></button>
          <button class="icon-btn"><Bell :size="17" /><span class="dot" /></button>
          <div class="user"><span class="avatar">{{ userInitials }}</span></div>
        </div>
      </header>

      <main class="content">
        <slot />
      </main>
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
.app { display: grid; grid-template-columns: var(--sidebar-w) 1fr; min-height: 100vh; }

/* Sidebar */
.sidebar { background: linear-gradient(180deg, #0E1626 0%, #0A0F1C 100%); color: #C7CDD6; display: flex; flex-direction: column; padding: 16px 12px; position: sticky; top: 0; height: 100vh; border-right: 1px solid rgba(255,255,255,.05); }
.brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 18px; }
.nav-close { display: none; margin-left: auto; background: none; border: none; color: #97A1AF; cursor: pointer; padding: 4px; }
.nav-close:hover { color: #fff; }
.brand-mark { width: 30px; height: 30px; border-radius: 9px; background: var(--brand-grad); color: var(--on-brand); display: grid; place-items: center; font-family: var(--display); font-weight: 800; font-size: 13px; }
.brand-name { font-family: var(--display); font-weight: 700; font-size: 14px; color: #fff; }
.nav { display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.nav-group { display: flex; flex-direction: column; gap: 2px; }
.nav-skel { height: 37px; border-radius: var(--r-sm); background: rgba(255,255,255,.05); animation: nav-skel-pulse 1.3s ease-in-out infinite; }
@keyframes nav-skel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
.nav-item { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500; color: #97A1AF; cursor: pointer; transition: background .14s, color .14s, transform .14s; }
.nav-item :deep(svg) { transition: transform .18s cubic-bezier(.16,1,.3,1); }
.nav-item:hover { background: rgba(255,255,255,.05); color: #E7EBF0; }
.nav-item:hover:not(.active) { transform: translateX(2px); }
.nav-item:hover :deep(svg) { transform: scale(1.12); }
.nav-item.active { background: linear-gradient(90deg, color-mix(in srgb, var(--brand) 26%, transparent), color-mix(in srgb, var(--brand) 8%, transparent)); color: #fff; box-shadow: inset 3px 0 0 var(--brand-bright), 0 4px 14px -6px color-mix(in srgb, var(--brand) 60%, transparent); }
.nav-item.active :deep(svg) { color: var(--brand-bright); }

/* Topbar */
.main { display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; justify-content: space-between; height: 60px; padding: 0 26px; background: color-mix(in srgb, var(--surface) 82%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
.menu-btn { display: none; background: var(--surface); border: 1px solid var(--border); color: var(--brand); border-radius: var(--r-sm); width: 36px; height: 36px; align-items: center; justify-content: center; cursor: pointer; margin-right: 12px; flex-shrink: 0; }
.crumbs { font-size: 13px; color: var(--muted); margin-right: auto; min-width: 0; }
.crumbs b { color: var(--ink); font-weight: 700; }
.crumbs .sep { margin: 0 8px; color: var(--faint); }
.top-right { display: flex; align-items: center; gap: 10px; }
.icon-btn { position: relative; background: transparent; border: none; color: var(--muted); padding: 8px; border-radius: var(--r-sm); cursor: pointer; }
.icon-btn:hover { background: var(--surface-3); color: var(--ink); }
.icon-btn .dot { position: absolute; top: 7px; right: 7px; width: 7px; height: 7px; background: var(--u-critico); border-radius: 50%; border: 1.5px solid var(--surface); }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--brand-grad); color: var(--on-brand); display: grid; place-items: center; font-weight: 700; font-size: 12px; }

/* Content */
.content { padding: 24px 26px 60px; width: min(100%, var(--page-max)); margin: 0 auto; }

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

@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed; top: 0; left: 0; z-index: 401; width: var(--sidebar-w);
    transform: translateX(-110%); transition: transform .26s cubic-bezier(.16,1,.3,1);
  }
  .sidebar.open { transform: none; box-shadow: var(--shadow-lg); }
  .menu-btn, .nav-close { display: inline-flex; }
}
@media (min-width: 861px) { .nav-overlay { display: none; } }
</style>
