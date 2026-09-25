<script setup lang="ts">
// Indicadores del CEDI: un solo módulo con dos áreas (23-09).
// - Almacenamiento: los procesos (recepción, movimientos, pendientes, resurtido,
//   tareas generales) y lo de las personas (tiempo trabajado, muertos, turnos…).
//   La lógica vive en components/indicadores/Module.vue.
// - Muebles: picking, inspección y órdenes. components/indicadores-muebles/Module.vue.
// - Transporte (25-09): el Cargue de camiones. components/indicadores-transporte/Module.vue.
// El área va en la URL (?area=muebles) para poder enlazarla y volver a ella.
import { computed } from 'vue'
import { Warehouse, Sofa, Truck } from '@lucide/vue'
import { useSessionState } from '~/composables/useSession'
import { canSeeModule } from '~/utils/modulePermissions'

definePageMeta({ title: 'Indicadores' })

const route = useRoute()
const router = useRouter()
const { me } = useSessionState()

const areas = computed(() => [
  { key: 'almacenamiento', label: 'Almacenamiento', icono: Warehouse, ve: canSeeModule(me.value?.role, 'indicadores') },
  { key: 'muebles', label: 'Muebles', icono: Sofa, ve: canSeeModule(me.value?.role, 'indicadores-muebles') },
  { key: 'transporte', label: 'Transporte', icono: Truck, ve: canSeeModule(me.value?.role, 'indicadores-transporte') },
].filter((a) => a.ve))

const area = computed(() => {
  const pedida = route.query.area === 'muebles' || route.query.area === 'transporte' ? String(route.query.area) : 'almacenamiento'
  return areas.value.some((a) => a.key === pedida) ? pedida : (areas.value[0]?.key ?? 'almacenamiento')
})

function elegir(key: string) {
  router.replace({ query: { ...route.query, area: key === 'almacenamiento' ? undefined : key } })
}
</script>

<template>
  <div>
    <nav v-if="areas.length > 1" class="areas" role="tablist" aria-label="Área">
      <button
        v-for="a in areas" :key="a.key" type="button" class="area" role="tab"
        :class="{ on: area === a.key }" :aria-selected="area === a.key" @click="elegir(a.key)"
      >
        <component :is="a.icono" :size="15" /> {{ a.label }}
      </button>
    </nav>
    <IndicadoresMueblesModule v-if="area === 'muebles'" />
    <IndicadoresTransporteModule v-else-if="area === 'transporte'" />
    <IndicadoresModule v-else-if="area === 'almacenamiento'" />
  </div>
</template>

<style scoped>
.areas { display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 18px; border: 1px solid var(--border); border-radius: var(--r-pill); background: var(--surface); }
.area { display: inline-flex; align-items: center; gap: 7px; padding: 8px 16px; border: none; border-radius: var(--r-pill); background: none; font-size: 13px; font-weight: 700; color: var(--muted); cursor: pointer; }
.area:hover:not(.on) { color: var(--ink-2); background: var(--surface-2); }
.area.on { color: var(--on-brand); background: var(--brand); }
.area:focus-visible { outline: none; box-shadow: var(--ring); }
</style>
