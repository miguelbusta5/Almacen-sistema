<script setup lang="ts">
// Resurtido: tres cosas distintas que el operario hace desde la misma pantalla,
// separadas en pestañas porque son flujos con reglas propias.
//
// - Resurtido: tareas que le montaron desde un archivo, en orden de posición.
//   El reloj arranca al escanear la ubicación.
// - Movimientos: traslado libre entre ubicaciones. El reloj arranca con el PLU.
// - Pendientes: lo que pidió gourmet y le asignó almacenamiento. También por PLU.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { PackageOpen, Boxes, PackageSearch } from '@lucide/vue'
import { useSessionState } from '~/composables/useSession'
import { FLUJOS } from '~/utils/montacargas'
import { esEjecutor } from '~/utils/resurtidoTareas'

definePageMeta({ title: 'Resurtido' })

const { me } = useSessionState()
const ejecuta = computed(() => esEjecutor(me.value?.role ?? ''))

type Pestana = 'resurtido' | 'movimientos' | 'pendientes'
const activa = ref<Pestana>('resurtido')

// Reloj compartido: un intervalo para toda la pantalla en vez de uno por tarjeta.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => { tick = setInterval(() => { ahora.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const pestanas = [
  { key: 'resurtido' as const, label: 'Resurtido', icon: PackageOpen },
  { key: 'movimientos' as const, label: 'Movimientos', icon: Boxes },
  { key: 'pendientes' as const, label: 'Pendientes', icon: PackageSearch },
]
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><PackageOpen :size="13" /></span>
          CEDI · Reposición
        </span>
        <h1 class="hero-title">Resurtido</h1>
        <p class="hero-desc">Tus tareas de resurtido, los movimientos de depósito y los pendientes de gourmet.</p>
      </div>
    </section>

    <nav class="tabs" role="tablist">
      <button
        v-for="p in pestanas" :key="p.key" class="tab" role="tab"
        :class="{ on: activa === p.key }" :aria-selected="activa === p.key"
        @click="activa = p.key"
      >
        <component :is="p.icon" :size="14" /> {{ p.label }}
      </button>
    </nav>

    <!-- Las tareas asignadas son para quien las ejecuta; supervisión las ve en
         Montaje Resurtido, que es donde tiene sentido mirarlas. -->
    <template v-if="activa === 'resurtido'">
      <!-- Un pendiente prioritario sale primero en esta lista, pero se hace en su
           pestaña: su flujo arranca con el PLU, no con la ubicacion. -->
      <ResurtidoTareas v-if="ejecuta" :ahora="ahora" @ir-a-pendientes="activa = 'pendientes'" />
      <EmptyState
        v-else title="Solo para operarios"
        description="Las tareas de resurtido las ejecutan los operarios. Para ver cómo van, entra a Montaje Resurtido."
      />
    </template>

    <!-- Movimientos de depósito: el módulo de siempre, sin su propia cabecera. -->
    <MontacargasModule
      v-else-if="activa === 'movimientos'"
      titulo="Movimientos de depósito"
      kicker="CEDI · Traslados"
      :flujos="[FLUJOS.MOVIMIENTO]"
      sin-hero
    />

    <template v-else>
      <ResurtidoPendientesTareas v-if="ejecuta" :ahora="ahora" />
      <EmptyState
        v-else title="Solo para operarios"
        description="Los pendientes asignados los ejecutan los operarios. Para solicitarlos o repartirlos, entra al módulo Pendientes."
      />
    </template>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 20px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }

.tabs { display: flex; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--border); }
.tab {
  display: inline-flex; align-items: center; gap: 7px; padding: 10px 15px;
  background: none; border: none; border-bottom: 2px solid transparent;
  font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer;
  transition: color .14s, border-color .14s;
}
.tab:hover { color: var(--ink-2); }
.tab.on { color: var(--brand); border-bottom-color: var(--brand); }
.tab:focus-visible { outline: none; box-shadow: var(--ring); border-radius: var(--r-xs); }

@media (max-width: 720px) {
  .hero-title { font-size: 24px; }
  .tab { flex: 1; justify-content: center; padding: 11px 6px; font-size: 12.5px; }
}
</style>
