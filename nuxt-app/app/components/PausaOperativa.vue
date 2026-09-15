<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Utensils, BatteryCharging, Play } from '@lucide/vue'
import { usePausaOperativa } from '~/composables/usePausaOperativa'
import { useToast } from '~/composables/useToast'
import { useSessionState } from '~/composables/useSession'
const props = defineProps<{ secundaria?: boolean }>()
const { pausa, cargada, ocupada, cargar, cambiar } = usePausaOperativa()
const { me } = useSessionState()
const { show } = useToast()
const ahora = ref(Date.now())
const error = ref(false)
const etiqueta = computed(() => pausa.value?.motivo === 'ALIMENTACION' ? 'Alimentación' : 'Cambio de baterías')
const total = computed(() => pausa.value ? pausa.value.movimientos.length + pausa.value.tareas.length + pausa.value.pendientes.length + pausa.value.recepciones.length : 0)
const tiempo = computed(() => {
  const seg = pausa.value ? Math.max(0, Math.floor((ahora.value - new Date(pausa.value.inicio).getTime()) / 1000)) : 0
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`
})
async function actualizar() {
  try { await cargar(); error.value = false } catch { error.value = true }
}
async function accion(motivo?: 'ALIMENTACION' | 'CAMBIO_BATERIAS') {
  try {
    await cambiar(motivo)
    show(motivo ? 'Pausa iniciada. Tus registros están guardados.' : 'Pausa finalizada. Puedes continuar con tus registros.')
  } catch (e: any) { show(e?.data?.statusMessage ?? 'No se pudo cambiar la pausa. Intenta de nuevo.', true) }
}
let reloj: ReturnType<typeof setInterval> | undefined
let consulta: ReturnType<typeof setInterval> | undefined
watch(() => me.value?.id, () => { if (!props.secundaria) { cargada.value = false; pausa.value = null; void actualizar() } })
onMounted(() => {
  if (props.secundaria) return
  void actualizar()
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
  consulta = setInterval(() => { if (document.visibilityState === 'visible' && !ocupada.value) void actualizar() }, 15000)
  window.addEventListener('focus', actualizar)
})
onBeforeUnmount(() => { clearInterval(reloj); clearInterval(consulta); window.removeEventListener('focus', actualizar) })
</script>

<template>
  <section class="pausa-operativa" :class="{ activa: pausa }" aria-label="Pausas de trabajo" :aria-busy="ocupada">
    <div>
      <strong>{{ pausa ? `En pausa · ${etiqueta}` : 'Pausas de trabajo' }}</strong>
      <p v-if="pausa">{{ total }} {{ total === 1 ? 'registro' : 'registros' }} en pausa · <span class="tnum">{{ tiempo }}</span>. El tiempo de trabajo está detenido.</p>
      <p v-else>Alimentación y cambio de baterías pausan tus registros activos en estos módulos.</p>
      <p v-if="error" role="alert">No se pudo consultar la pausa. <button class="btn btn-sm" @click="actualizar">Reintentar</button></p>
    </div>
    <div class="acciones">
      <button v-if="pausa" class="btn btn-primary" :disabled="ocupada || !cargada" @click="accion()"><Play :size="16" />Finalizar {{ etiqueta.toLowerCase() }} y continuar</button>
      <template v-else>
        <button class="btn" :disabled="ocupada || !cargada" @click="accion('ALIMENTACION')"><Utensils :size="16" />Tiempo de alimentación</button>
        <button class="btn" :disabled="ocupada || !cargada" @click="accion('CAMBIO_BATERIAS')"><BatteryCharging :size="16" />Cambio de baterías</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.pausa-operativa { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 16px; margin-bottom: 18px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); }
.pausa-operativa.activa { border-color: var(--brand); }
p { margin: 5px 0 0; color: var(--muted); font-size: 13px; }
.acciones { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 720px) { .acciones, .acciones .btn { width: 100%; } .acciones .btn { justify-content: center; white-space: normal; } }
</style>
