<script setup lang="ts">
// Vista de tabla de cualquier grafico: las mismas cifras, sin depender del color.
import { inject, onBeforeUnmount, ref, watchEffect } from 'vue'
import type { ColumnaTabla } from '~/utils/indicadores'
import { CLAVE_COLECTOR, CLAVE_TARJETA } from '~/utils/exportarDashboard'

const props = defineProps<{
  columnas: ColumnaTabla[]
  filas: Record<string, string | number>[]
  /** Columna que identifica la fila (va en negrita). */
  principal?: string
}>()

// Al exportar el dashboard, la tabla se anota con sus datos tal cual (el Excel
// los recibe como números) y con el título de su tarjeta.
const colector = inject(CLAVE_COLECTOR, null)
const tarjeta = inject(CLAVE_TARJETA, null)
const raiz = ref<HTMLElement | null>(null)
const id = Symbol('tabla')
watchEffect(() => {
  if (!colector?.activo.value || !raiz.value) return
  colector.tablas.set(id, { el: raiz.value, titulo: tarjeta?.titulo() ?? '', columnas: props.columnas, filas: props.filas })
})
onBeforeUnmount(() => colector?.tablas.delete(id))
</script>

<template>
  <table ref="raiz" class="table">
    <thead>
      <tr>
        <th v-for="c in columnas" :key="c.key" :class="{ num: c.num }">{{ c.label }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(f, i) in filas" :key="i">
        <td
          v-for="c in columnas" :key="c.key"
          :class="{ tnum: c.num, nom: c.key === principal }"
        >
          {{ f[c.key] }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.table { width: 100%; border-collapse: separate; border-spacing: 0; }
.table th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--muted); padding: 10px 14px; white-space: nowrap;
  background: var(--surface-2);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border-strong);
}
.table th.num { text-align: right; }
.table td {
  padding: 9px 14px; font-size: 13px; color: var(--ink-2); white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.table td.tnum { text-align: right; }
.table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--surface-2) 55%, transparent); }
.table tbody tr:hover td { background: var(--brand-tint); }
.table tbody tr:last-child td { border-bottom: none; }
.nom { font-weight: 600; color: var(--ink); }
</style>
