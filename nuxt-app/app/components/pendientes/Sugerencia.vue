<script setup lang="ts">
// De que altura sacar un pendiente y a que picking llevarlo, segun el teorico
// vigente al asignarlo. Es una sugerencia: el operario puede usar otra
// ubicacion, y eso queda registrado para supervision.
import { computed } from 'vue'
import { ArrowDownToLine, MapPin, TriangleAlert } from '@lucide/vue'
import type { SugerenciaPendienteDTO } from '~/utils/resurtidoTareas'

const props = defineProps<{ sugerencia: SugerenciaPendienteDTO | null; compacto?: boolean }>()

const s = computed(() => props.sugerencia)
const cargado = computed(() => {
  if (!s.value?.teoricoCreadoAt) return null
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })
    .format(new Date(s.value.teoricoCreadoAt))
})
const cantidad = (a: SugerenciaPendienteDTO['alturas'][number]) =>
  a.cajas != null ? `${a.cajas} caja${a.cajas === 1 ? '' : 's'} (${a.unidades} und)` : `${a.unidades} und`
</script>

<template>
  <div v-if="s" class="sug" :class="{ compacto }">
    <p v-if="s.alturas.length" class="sug-linea">
      <ArrowDownToLine :size="13" />
      <span>
        Saca de
        <template v-for="(a, i) in s.alturas" :key="a.ubicacion">
          <b class="mono">{{ a.ubicacion }}</b> · {{ cantidad(a) }}<template v-if="i < s.alturas.length - 1"> + </template>
        </template>
      </span>
    </p>
    <p v-if="s.picking" class="sug-linea">
      <MapPin :size="13" />
      <span>Lleva a <b class="mono">{{ s.picking }}</b><template v-if="!compacto && s.pickingOrigen === 'TEORICO'"> (del teórico)</template></span>
    </p>
    <p v-for="aviso in s.avisos" :key="aviso" class="sug-aviso">
      <TriangleAlert :size="12" /> {{ aviso }}
    </p>
    <p v-if="!compacto && cargado" class="sug-pie">Según el teórico cargado el {{ cargado }}</p>
  </div>
</template>

<style scoped>
.sug { display: flex; flex-direction: column; gap: 4px; padding: 9px 11px; border-radius: var(--r-sm); border: 1px solid color-mix(in srgb, var(--info) 30%, transparent); background: color-mix(in srgb, var(--info) 7%, transparent); }
.sug.compacto { padding: 6px 9px; gap: 2px; }
.sug-linea { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 12.5px; color: var(--ink-2); }
.sug-linea > svg { color: var(--info); flex-shrink: 0; margin-top: 2px; }
.sug-linea b { color: var(--ink); }
.sug-aviso { display: flex; align-items: center; gap: 5px; margin: 0; font-size: 11.5px; font-weight: 600; color: var(--u-aviso); }
.sug-pie { margin: 2px 0 0; font-size: 11px; color: var(--faint); }
.compacto .sug-linea { font-size: 11.5px; }
</style>
