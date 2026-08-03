<script setup lang="ts">
// Tabla en escritorio, lista de cards por debajo de 760px (sin scroll horizontal).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Pencil, Trash2 } from '@lucide/vue'
import {
  estadoExport, EXPORT_ESTADO_TONE, fmtFechaExport, fmtHoraExport, objetivoPlu, type Exportacion,
} from '~/utils/exportaciones'

const props = defineProps<{
  items: Exportacion[]
  canManage: boolean
  userId?: string
  selectable: boolean
  selectedIds: string[]
  promediosPlu: Record<string, number>
  promedioGlobal: number | null
}>()
const emit = defineEmits<{
  (e: 'editar', item: Exportacion): void
  (e: 'borrar', item: Exportacion): void
  (e: 'toggleSelect', id: string): void
  (e: 'toggleSelectAll'): void
}>()

const esCompacto = useMediaQuery('(max-width: 760px)')
const ESTADO_LABEL = { 'en-curso': 'En curso', finalizado: 'Finalizado' } as const

// Editar: gestores cualquiera, el resto solo lo propio (espejo del gate de servidor).
function puedeEditar(item: Exportacion) {
  return props.canManage || item.creadoPorId === props.userId
}
const todosSeleccionados = computed(() =>
  props.items.length > 0 && props.items.every((i) => props.selectedIds.includes(i.id)),
)
function badge(item: Exportacion) {
  const e = estadoExport(item)
  return { label: ESTADO_LABEL[e], tone: EXPORT_ESTADO_TONE[e] }
}

// Reloj compartido para el cronómetro de TODAS las filas en curso — un solo
// setInterval para la tabla entera, no uno por fila. Arranca solo si hay
// filas en curso y se apaga en cuanto dejan de haberlas (paginación, filtro,
// o el auto-refresh que cierra el último registro abierto).
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
const hayEnCurso = computed(() => props.items.some((i) => i.duracionMinutos == null))
watch(
  hayEnCurso,
  (activo) => {
    if (activo && !tick) tick = setInterval(() => { ahora.value = Date.now() }, 1000)
    if (!activo && tick) { clearInterval(tick); tick = null }
  },
  { immediate: true },
)
onBeforeUnmount(() => { if (tick) clearInterval(tick) })
</script>

<template>
  <div class="card table-card">
    <!-- Escritorio -->
    <table v-if="!esCompacto" class="table">
      <thead>
        <tr>
          <th v-if="selectable" class="th-sel">
            <input type="checkbox" :checked="todosSeleccionados" @change="emit('toggleSelectAll')">
          </th>
          <th>Fecha</th><th>Operario</th><th>Caja</th><th>PLU</th><th>Descripción</th>
          <th>Emp.</th><th>Inicio</th><th>Fin</th><th>Dur.</th><th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ sel: selectedIds.includes(item.id) }">
          <td v-if="selectable" class="td-sel">
            <input type="checkbox" :checked="selectedIds.includes(item.id)" @change="emit('toggleSelect', item.id)">
          </td>
          <td class="muted">{{ fmtFechaExport(item.fecha) }}</td>
          <td class="op">{{ item.creadoPorNombre ?? '—' }}</td>
          <td class="mono strong">{{ item.numeroCaja }}</td>
          <td class="mono">{{ item.plu }}</td>
          <td class="desc" :title="item.descripcion">{{ item.descripcion }}</td>
          <td class="tnum">{{ item.unidadEmpaque }}</td>
          <td class="muted tnum">{{ fmtHoraExport(item.horaInicio) }}</td>
          <td>
            <Badge v-bind="badge(item)" />
            <span v-if="item.horaFinalizacion" class="fin tnum">{{ fmtHoraExport(item.horaFinalizacion) }}</span>
          </td>
          <td class="tnum">
            <ExportacionesDuracionEnCurso
              v-if="item.duracionMinutos == null"
              :hora-inicio="item.horaInicio"
              :objetivo-min="objetivoPlu(item.plu, promediosPlu, promedioGlobal)"
              :ahora="ahora"
            />
            <template v-else>{{ item.duracionMinutos }}</template>
          </td>
          <td class="acciones">
            <button v-if="puedeEditar(item)" class="btn-icon" title="Editar" @click="emit('editar', item)">
              <Pencil :size="13" />
            </button>
            <button v-if="canManage" class="btn-icon danger" title="Borrar" @click="emit('borrar', item)">
              <Trash2 :size="13" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Móvil -->
    <div v-else class="cards">
      <article v-for="item in items" :key="item.id" class="rowcard" :class="{ sel: selectedIds.includes(item.id) }">
        <header class="rc-top">
          <input
            v-if="selectable" type="checkbox" :checked="selectedIds.includes(item.id)"
            @change="emit('toggleSelect', item.id)"
          >
          <span class="mono strong">Caja {{ item.numeroCaja }}</span>
          <Badge v-bind="badge(item)" />
        </header>
        <p class="rc-desc"><span class="mono">{{ item.plu }}</span> · {{ item.descripcion }}</p>
        <dl class="rc-meta">
          <div><dt>Fecha</dt><dd>{{ fmtFechaExport(item.fecha) }}</dd></div>
          <div><dt>Empaque</dt><dd class="tnum">{{ item.unidadEmpaque }}</dd></div>
          <div><dt>Inicio</dt><dd class="tnum">{{ fmtHoraExport(item.horaInicio) }}</dd></div>
          <div>
            <dt>Duración</dt>
            <dd class="tnum">
              <ExportacionesDuracionEnCurso
                v-if="item.duracionMinutos == null"
                :hora-inicio="item.horaInicio"
                :objetivo-min="objetivoPlu(item.plu, promediosPlu, promedioGlobal)"
                :ahora="ahora"
              />
              <template v-else>{{ item.duracionMinutos }} min</template>
            </dd>
          </div>
        </dl>
        <footer v-if="puedeEditar(item) || canManage" class="rc-acc">
          <button v-if="puedeEditar(item)" class="btn-icon" @click="emit('editar', item)"><Pencil :size="13" /> Editar</button>
          <button v-if="canManage" class="btn-icon danger" @click="emit('borrar', item)"><Trash2 :size="13" /> Borrar</button>
        </footer>
      </article>
    </div>

    <EmptyState
      v-if="items.length === 0"
      title="Sin registros" description="No hay rotulaciones que coincidan con los filtros."
    />
  </div>
</template>

<style scoped>
.table-card { overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 12px 14px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.table td { padding: 11px 14px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); }
.table tr:last-child td { border-bottom: none; }
.table tr.sel { background: color-mix(in srgb, var(--pais, var(--brand)) 7%, transparent); }
.th-sel, .td-sel { width: 34px; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--muted); }
.op { font-size: 12.5px; }
.desc { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fin { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.acciones { display: flex; gap: 6px; }
.btn-icon { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: var(--r-xs); border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; font-size: 12px; }
.btn-icon:hover { background: var(--surface-3); color: var(--ink); }
.btn-icon.danger:hover { color: var(--u-critico); border-color: color-mix(in srgb, var(--u-critico) 40%, transparent); }

.cards { display: flex; flex-direction: column; }
.rowcard { padding: 13px 14px; border-bottom: 1px solid var(--border); }
.rowcard:last-child { border-bottom: none; }
.rowcard.sel { background: color-mix(in srgb, var(--pais, var(--brand)) 7%, transparent); }
.rc-top { display: flex; align-items: center; gap: 9px; }
.rc-top .strong { font-size: 14px; }
.rc-desc { margin: 7px 0 9px; font-size: 13px; color: var(--ink-2); }
.rc-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px 14px; margin: 0; }
.rc-meta dt { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--faint); }
.rc-meta dd { margin: 1px 0 0; font-size: 13px; color: var(--ink-2); }
.rc-acc { display: flex; gap: 8px; margin-top: 11px; }
</style>
