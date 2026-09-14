<script setup lang="ts">
// Admin Muebles — la configuración del área.
//
// Cinco cosas que solo toca supervisión, en pestañas porque son tareas de ritmo
// muy distinto: la asignación es diaria, los equipos e inspectores se tocan una
// vez y ya, los tipos se revisan cuando se carga el maestro, y los pendientes
// según vayan apareciendo.
//
// La asignación va primera a propósito: es lo primero de la mañana y lo único
// que bloquea al área entera si falta.
import { computed, onMounted, ref } from 'vue'
import { SlidersHorizontal, CalendarDays, Forklift, UserCheck, Tags, PackageSearch } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { canSeeModule } from '~/utils/modulePermissions'

const { me } = useSessionState()
const puedeVer = computed(() => canSeeModule(me.value?.role, 'admin-muebles'))

type Pestana = 'asignacion' | 'equipos' | 'inspectores' | 'tipos' | 'pendientes'
const activa = ref<Pestana>('asignacion')

const pestanas = [
  { key: 'asignacion' as const, label: 'Asignación del día', icon: CalendarDays },
  { key: 'equipos' as const, label: 'Equipos', icon: Forklift },
  { key: 'inspectores' as const, label: 'Inspectores', icon: UserCheck },
  { key: 'tipos' as const, label: 'Tipos de PLU', icon: Tags },
  { key: 'pendientes' as const, label: 'Pendientes', icon: PackageSearch },
]

onMounted(ensureSession)
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><SlidersHorizontal :size="13" /></span>
          CEDI · Muebles
        </span>
        <h1 class="hero-title">Admin Muebles</h1>
        <p class="hero-desc">Equipos, asignación del día, inspectores y tipos de mercancía.</p>
      </div>
    </section>

    <p v-if="!puedeVer" class="vacio">Esta pantalla es para supervisión del área.</p>

    <template v-else>
      <nav class="tabs" role="tablist">
        <button
          v-for="p in pestanas" :key="p.key" class="tab" role="tab"
          :class="{ on: activa === p.key }" :aria-selected="activa === p.key"
          @click="activa = p.key"
        >
          <component :is="p.icon" :size="14" /> {{ p.label }}
        </button>
      </nav>

      <AdminMueblesAsignacion v-if="activa === 'asignacion'" />
      <AdminMueblesEquipos v-else-if="activa === 'equipos'" />
      <AdminMueblesInspectores v-else-if="activa === 'inspectores'" />
      <AdminMueblesTipos v-else-if="activa === 'tipos'" />
      <AdminMueblesPendientes v-else />
    </template>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 20px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }

.tabs { display: flex; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--border); overflow-x: auto; }
.tab {
  display: inline-flex; align-items: center; gap: 7px; padding: 10px 15px; white-space: nowrap;
  background: none; border: none; border-bottom: 2px solid transparent;
  font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer;
  transition: color .14s, border-color .14s;
}
.tab:hover { color: var(--ink-2); }
.tab.on { color: var(--brand); border-bottom-color: var(--brand); }
.tab:focus-visible { outline: none; box-shadow: var(--ring); border-radius: var(--r-xs); }

.vacio { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }

@media (max-width: 720px) {
  .hero-title { font-size: 24px; }
  .tab { padding: 11px 12px; font-size: 12.5px; }
}
</style>
