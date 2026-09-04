<script setup lang="ts">
// Tabla en escritorio, lista de cards por debajo de 760px (sin scroll horizontal).
// Mismas columnas que la planilla de montacargas, para que quien viene del
// Google Sheet reconozca la vista.
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Pencil, Trash2, TriangleAlert } from '@lucide/vue'
import {
  ESTADO_ESTIBA_LABEL, esUbicacionCanonica, fmtDuracion, fmtHoraEstiba, type Estiba,
} from '~/utils/estibas'

const props = defineProps<{
  items: Estiba[]
  canManage: boolean
  userId?: string
}>()
const emit = defineEmits<{
  (e: 'editar', item: Estiba): void
  (e: 'borrar', item: Estiba): void
}>()

const esCompacto = useMediaQuery('(max-width: 760px)')

// Editar: gestores cualquiera, el resto solo lo propio (espejo del gate de servidor).
function puedeEditar(item: Estiba) {
  return props.canManage || item.creadoPorId === props.userId
}

function badge(item: Estiba) {
  return {
    label: ESTADO_ESTIBA_LABEL[item.estado],
    tone: item.estado === 'EN_CURSO' ? 'var(--info)' : 'var(--u-ok)',
  }
}

// Ubicación fuera del formato canónico: se marca para que supervisión pueda
// revisarla, no para bloquearla (INSPECCION, MUEBLES… son legítimas).
const libres = computed(
  () => new Set(props.items.filter((i) => i.ubicacion && !esUbicacionCanonica(i.ubicacion)).map((i) => i.id)),
)

function fmtFecha(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}
</script>

<template>
  <div class="card table-card">
    <!-- Escritorio -->
    <table v-if="!esCompacto" class="table">
      <thead>
        <tr>
          <th>Fecha</th><th>Montacarguista</th><th>Pedido</th><th>PLU</th><th>Descripción</th>
          <th>Cajas</th><th>Und/caja</th><th>Total</th><th>Depósito final</th>
          <th>Inicio</th><th>Estado</th><th>Tiempo</th><th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td class="muted">{{ fmtFecha(item.fecha) }}</td>
          <td class="op">{{ item.creadoPorNombre ?? '—' }}</td>
          <td class="mono strong">{{ item.pedido }}</td>
          <td class="mono">{{ item.plu }}</td>
          <td class="desc" :title="item.descripcion">{{ item.descripcion }}</td>
          <td class="tnum">{{ item.cajas }}</td>
          <td class="tnum">
            {{ item.unidadesPorCaja }}
            <span v-if="item.unidadesManuales" class="manual" title="Escrita a mano: el maestro no la tenía">·M</span>
          </td>
          <td class="tnum strong">{{ item.cantidadTotal }}</td>
          <td class="mono">
            <template v-if="item.ubicacion">
              {{ item.ubicacion }}
              <TriangleAlert
                v-if="libres.has(item.id)" :size="11" class="ub-libre"
                aria-label="Ubicación fuera del formato canónico"
              />
            </template>
            <span v-else class="muted">—</span>
          </td>
          <td class="muted tnum">{{ fmtHoraEstiba(item.horaInicio) }}</td>
          <td>
            <Badge v-bind="badge(item)" />
            <span v-if="item.horaFinalizacion" class="fin tnum">{{ fmtHoraEstiba(item.horaFinalizacion) }}</span>
          </td>
          <td class="tnum">{{ fmtDuracion(item.duracionMinutos) }}</td>
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
      <article v-for="item in items" :key="item.id" class="rowcard">
        <header class="rc-top">
          <span class="mono strong">{{ item.pedido }}</span>
          <Badge v-bind="badge(item)" />
        </header>
        <p class="rc-desc"><span class="mono">{{ item.plu }}</span> · {{ item.descripcion }}</p>
        <dl class="rc-meta">
          <div><dt>Fecha</dt><dd>{{ fmtFecha(item.fecha) }}</dd></div>
          <div><dt>Cajas</dt><dd class="tnum">{{ item.cajas }} × {{ item.unidadesPorCaja }}</dd></div>
          <div><dt>Total</dt><dd class="tnum strong">{{ item.cantidadTotal }}</dd></div>
          <div><dt>Depósito</dt><dd class="mono">{{ item.ubicacion ?? '—' }}</dd></div>
          <div><dt>Inicio</dt><dd class="tnum">{{ fmtHoraEstiba(item.horaInicio) }}</dd></div>
          <div><dt>Tiempo</dt><dd class="tnum">{{ fmtDuracion(item.duracionMinutos) }}</dd></div>
        </dl>
        <footer v-if="puedeEditar(item) || canManage" class="rc-acc">
          <button v-if="puedeEditar(item)" class="btn-icon" @click="emit('editar', item)"><Pencil :size="13" /> Editar</button>
          <button v-if="canManage" class="btn-icon danger" @click="emit('borrar', item)"><Trash2 :size="13" /> Borrar</button>
        </footer>
      </article>
    </div>

    <EmptyState
      v-if="items.length === 0"
      title="Sin estibas" description="No hay estibas que coincidan con los filtros."
    />
  </div>
</template>

<style scoped>
.table-card { overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 12px 14px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.table td { padding: 11px 14px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); }
.table tr:last-child td { border-bottom: none; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--muted); }
.op { font-size: 12.5px; }
.desc { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fin { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.manual { font-size: 10px; font-weight: 700; color: var(--u-aviso); }
.ub-libre { color: var(--u-aviso); vertical-align: -1px; }
.acciones { display: flex; gap: 6px; }
.btn-icon { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: var(--r-xs); border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; font-size: 12px; }
.btn-icon:hover { background: var(--surface-3); color: var(--ink); }
.btn-icon.danger:hover { color: var(--u-critico); border-color: color-mix(in srgb, var(--u-critico) 40%, transparent); }

.cards { display: flex; flex-direction: column; }
.rowcard { padding: 13px 14px; border-bottom: 1px solid var(--border); }
.rowcard:last-child { border-bottom: none; }
.rc-top { display: flex; align-items: center; gap: 9px; }
.rc-top .strong { font-size: 14px; }
.rc-desc { margin: 7px 0 10px; font-size: 12.5px; color: var(--ink-2); }
.rc-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px 12px; margin: 0; }
.rc-meta dt { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); }
.rc-meta dd { margin: 1px 0 0; font-size: 12.5px; color: var(--ink-2); }
.rc-acc { display: flex; gap: 8px; margin-top: 11px; }
</style>
