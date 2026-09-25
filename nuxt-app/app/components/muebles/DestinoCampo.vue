<script setup lang="ts">
// Tienda a la que va la orden: se elige del maestro de tiendas y la ciudad sale
// de ella. E-commerce (998) no tiene ciudad en el maestro: ahí se escribe la
// ciudad destino. Emite el destino solo cuando está completo; si no, null.
//
// Lo usan la ventana de destino de Inspección y los formularios que crean
// órdenes allí (contado, orden de tienda, orden sin crear).
import { ref, watch } from 'vue'
import { MapPin } from '@lucide/vue'
import { destinoPideCiudad, type DestinoOrden, type TiendaOpcion } from '~/utils/muebles'

defineProps<{ modelValue: DestinoOrden | null; sugeridas?: string[]; etiqueta?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: DestinoOrden | null): void }>()

const tienda = ref<TiendaOpcion | null>(null)
const ciudad = ref('')

watch([tienda, ciudad], () => {
  const t = tienda.value
  if (!t) return emit('update:modelValue', null)
  const pide = destinoPideCiudad(t)
  const c = pide ? ciudad.value.trim() : t.ciudad
  if (c.length < 3) return emit('update:modelValue', null)
  emit('update:modelValue', { tiendaCodigo: t.codigo, tiendaNombre: t.tienda, ciudad: c, ecommerce: pide })
})

</script>

<template>
  <div class="dc">
    <div class="campo">
      <span class="campo-label">{{ etiqueta ?? 'Tienda destino' }}</span>
      <MueblesTiendaBuscador v-model="tienda" />
    </div>
    <p v-if="tienda && !destinoPideCiudad(tienda)" class="dc-ciudad">
      <MapPin :size="12" /> Va a <strong>{{ tienda.ciudad }}</strong>
    </p>
    <label v-if="tienda && destinoPideCiudad(tienda)" class="campo">
      <span class="campo-label">Ciudad destino ({{ tienda.tienda }})</span>
      <input
        v-model="ciudad" class="input" type="text" autocomplete="off"
        list="dc-ciudades" placeholder="Medellín, Bogotá…"
      >
      <datalist id="dc-ciudades">
        <option v-for="c in sugeridas ?? []" :key="c" :value="c" />
      </datalist>
    </label>
  </div>
</template>

<style scoped>
.campo { display: block; margin-bottom: 12px; position: relative; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.dc-ciudad { display: flex; align-items: center; gap: 5px; margin: -6px 0 12px; font-size: 12.5px; color: var(--ink-2); }
.dc-ciudad > svg { color: var(--brand); }
</style>
