<script setup lang="ts">
// Cola de faltantes que reportan los inspectores. Nacen sin dueno y aqui se les
// asigna un operario: quien esta libre lo sabe el supervisor, no el inspector.
import { onMounted, ref } from 'vue'
import { Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { API_ADMIN_MUEBLES, fmtMin, mensajeError, type Pendiente } from '~/utils/muebles'

const { show } = useToast()
const pendientes = ref<Pendiente[]>([])
const operarios = ref<Array<{ id: string; nombre: string }>>([])
const cargando = ref(true)
const guardandoId = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{ data: { pendientes: Pendiente[]; operarios: Array<{ id: string; nombre: string }> } }>(
      `${API_ADMIN_MUEBLES}/pendientes`,
    )
    pendientes.value = res.data.pendientes
    operarios.value = res.data.operarios
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar los pendientes'), true)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

async function asignar(p: Pendiente, operarioId: string) {
  if (!operarioId) return
  guardandoId.value = p.id
  try {
    const res = await $fetch<{ data: Pendiente }>(`${API_ADMIN_MUEBLES}/pendientes/${p.id}/asignar`, {
      method: 'POST', body: { operarioId },
    })
    Object.assign(p, res.data)
    show(`PLU ${p.plu} asignado a ${res.data.asignadoA?.nombre}`)
  } catch (e) {
    show(mensajeError(e, 'No se pudo asignar'), true)
    cargar()
  } finally {
    guardandoId.value = null
  }
}
</script>

<template>
  <section>
    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>
    <p v-else-if="pendientes.length === 0" class="vacio">No hay faltantes pendientes.</p>

    <ul v-else class="lista">
      <li v-for="p in pendientes" :key="p.id" class="fila" :class="{ asignado: p.estado === 'ASIGNADO' }">
        <div class="info">
          <strong>{{ p.plu }}</strong> · {{ p.unidades }} unid.
          <span v-if="p.orden" class="orden">{{ p.orden.codigo }}</span>
          <p v-if="p.observacion" class="obs">{{ p.observacion }}</p>
          <p class="meta">
            Esperando {{ fmtMin(p.esperaMin) }}
            <template v-if="p.creadoPorInspector"> · reportó {{ p.creadoPorInspector.nombre }}</template>
          </p>
        </div>

        <div class="accion">
          <Loader2 v-if="guardandoId === p.id" :size="15" class="spin" />
          <select
            class="input" :value="p.asignadoA?.id ?? ''" :disabled="guardandoId === p.id"
            @change="asignar(p, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Sin asignar</option>
            <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          </select>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fila { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 12px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); box-shadow: inset 3px 0 0 var(--u-aviso); }
.fila.asignado { box-shadow: inset 3px 0 0 var(--u-ok); }
.info { flex: 1 1 260px; min-width: 0; font-size: 13.5px; color: var(--ink); }
.info strong { font-size: 14.5px; font-weight: 700; }
.orden { margin-left: 8px; font-size: 11.5px; color: var(--muted); }
.obs { margin: 3px 0 0; font-size: 12px; color: var(--ink-2); }
.meta { margin: 3px 0 0; font-size: 11.5px; color: var(--muted); }
.accion { display: flex; align-items: center; gap: 8px; }
.accion .input { min-width: 190px; }
.cargando { display: flex; align-items: center; gap: 9px; padding: 24px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 26px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
</style>
