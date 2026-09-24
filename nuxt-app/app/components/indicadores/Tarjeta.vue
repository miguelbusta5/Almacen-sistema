<script setup lang="ts">
// Marco de cada grafico: titulo, que mide y el cambio a tabla.
//
// La tabla no es un extra: es donde vive cada cifra que el grafico no rotula, y
// la unica forma de leer los colores claros (aqua, amarillo, magenta) sin
// depender del color.
import { computed, inject, provide, ref } from 'vue'
import { BarChart3, Table2 } from '@lucide/vue'
import { CLAVE_COLECTOR, CLAVE_TARJETA } from '~/utils/exportarDashboard'

const props = defineProps<{ titulo: string; subtitulo?: string }>()
const verTabla = ref(false)
// Al exportar el dashboard se monta también la tabla (oculta): así sus datos
// llegan al Excel aunque en pantalla se vea el gráfico.
const colector = inject(CLAVE_COLECTOR, null)
const exportando = computed(() => colector?.activo.value ?? false)
provide(CLAVE_TARJETA, { id: Symbol('tarjeta'), titulo: () => props.titulo, subtitulo: () => props.subtitulo ?? '' })
</script>

<template>
  <section class="tj card">
    <header class="tj-head">
      <div>
        <h3 class="tj-titulo">{{ titulo }}</h3>
        <p v-if="subtitulo" class="tj-sub">{{ subtitulo }}</p>
      </div>
      <button
        class="btn btn-sm btn-ghost" type="button" :aria-pressed="verTabla"
        @click="verTabla = !verTabla"
      >
        <BarChart3 v-if="verTabla" :size="14" /><Table2 v-else :size="14" />
        {{ verTabla ? 'Ver gráfico' : 'Ver tabla' }}
      </button>
    </header>
    <slot v-if="!verTabla" name="leyenda" />
    <div v-if="verTabla" class="tj-tabla"><slot name="tabla" /></div>
    <slot v-else />
    <div v-if="exportando && !verTabla" class="tj-solo-export" data-export-omitir><slot name="tabla" /></div>
  </section>
</template>

<style scoped>
.tj { padding: 16px 18px 18px; min-width: 0; }
.tj-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.tj-titulo { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.tj-sub { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
.tj-tabla { overflow-x: auto; margin: 0 -18px -18px; }
.tj-solo-export { display: none; }
</style>
