<script setup lang="ts">
import { ref, computed } from 'vue'
import { Truck, ShoppingCart, Package, MapPin, ChevronUp, ChevronDown, ChevronsUpDown } from '@lucide/vue'
import { calcAlmacenaje } from '~/utils/almacenaje'
import {
  alertaTier, TIER_COLOR, diasEnBodega, parseEntrega, nivelEntregaColor,
  scoreGuardado, fmtFecha, fmtCOP, type Guardado,
} from '~/utils/guardado'

const ENTREGA_COLOR: Record<string, string | undefined> = {
  neutro: undefined, 'sin-fecha': 'var(--error)', vencida: 'var(--error)',
  amarillo: 'var(--warning)', azul: 'var(--info)', verde: 'var(--success)',
}

const props = defineProps<{ items: Guardado[]; hasFilters: boolean; density?: 'comodo' | 'compacto' }>()
const emit = defineEmits<{ (e: 'open', g: Guardado): void; (e: 'clear'): void; (e: 'new'): void }>()

function almOf(g: Guardado) { return calcAlmacenaje(g.fecha, g.estado === 'DESPACHADO' ? g.fechaDespacho : null) }

type SortKey = 'urgencia' | 'documento' | 'entrega' | 'ubicacion' | 'almacenaje' | 'tipo'
const columns: { key: SortKey; label: string; w: string }[] = [
  { key: 'urgencia', label: 'Urgencia', w: '20%' },
  { key: 'documento', label: 'Documento', w: '19%' },
  { key: 'entrega', label: 'Entrega', w: '14%' },
  { key: 'ubicacion', label: 'Ubicación', w: '16%' },
  { key: 'almacenaje', label: 'Almacenaje', w: '19%' },
  { key: 'tipo', label: 'Tipo', w: '12%' },
]
const sortKey = ref<SortKey>('urgencia')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = k; sortDir.value = k === 'urgencia' || k === 'almacenaje' ? 'desc' : 'asc' }
}

function sortVal(g: Guardado, k: SortKey): number | string {
  switch (k) {
    case 'urgencia': return scoreGuardado(g)
    case 'documento': return g.documento
    case 'entrega': return parseEntrega(g.nota) ?? '9999-99-99'
    case 'ubicacion': return g.ubicacion
    case 'almacenaje': return almOf(g).costoAcumulado
    case 'tipo': return g.tipo
  }
}

const sorted = computed(() => {
  const arr = [...props.items]
  const k = sortKey.value, dir = sortDir.value === 'asc' ? 1 : -1
  arr.sort((a, b) => {
    const va = sortVal(a, k), vb = sortVal(b, k)
    if (va < vb) return -1 * dir
    if (va > vb) return 1 * dir
    return 0
  })
  return arr
})

function tipoIcon(g: Guardado) { return g.tipo === 'ECOMMERCE' ? ShoppingCart : Package }
</script>

<template>
  <div class="panel card" :class="`d-${density ?? 'comodo'}`">
    <table class="tbl">
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :style="{ width: c.w }">
            <button class="th-btn" :class="{ active: sortKey === c.key }" @click="toggleSort(c.key)">
              {{ c.label }}
              <ChevronUp v-if="sortKey === c.key && sortDir === 'asc'" :size="13" class="th-arrow" />
              <ChevronDown v-else-if="sortKey === c.key && sortDir === 'desc'" :size="13" class="th-arrow" />
              <ChevronsUpDown v-else :size="12" class="th-arrow idle" />
            </button>
          </th>
        </tr>
      </thead>
      <TransitionGroup tag="tbody" name="row" appear>
        <tr
          v-for="(g, i) in sorted" :key="g.clientId"
          class="row" :style="{ '--rail': g.estado === 'DESPACHADO' ? 'var(--border-strong)' : TIER_COLOR[alertaTier(g)], '--d': `${i * 32}ms` }"
          @click="emit('open', g)"
        >
          <td><UrgencyPill :g="g" /></td>
          <td>
            <div class="doc-row">
              <span class="doc-ic" :class="g.tipo === 'ECOMMERCE' ? 'ecom' : ''"><component :is="tipoIcon(g)" :size="13" /></span>
              <div>
                <div class="doc mono">{{ g.documento }}</div>
                <div class="sub mono">{{ diasEnBodega(g) }} día(s) en bodega</div>
              </div>
            </div>
          </td>
          <td>
            <template v-if="parseEntrega(g.nota)">
              <span class="mono ent" :style="{ color: ENTREGA_COLOR[nivelEntregaColor(g)] }">{{ fmtFecha(parseEntrega(g.nota)) }}</span>
            </template>
            <span v-else class="nofecha">Sin fecha</span>
          </td>
          <td>
            <div class="ubic" :title="g.ubicacion">{{ g.ubicacion }}</div>
            <div class="sub city"><MapPin :size="11" />{{ g.ciudad || '—' }}</div>
          </td>
          <td>
            <div class="alm">
              <StorageMeter :fecha="g.fecha" :end-date="g.estado === 'DESPACHADO' ? g.fechaDespacho : null" mode="mini" />
              <span class="alm-cost mono" :class="{ gracia: almOf(g).fase === 'gracia' }">
                {{ almOf(g).fase === 'gracia' ? 'En gracia' : fmtCOP(almOf(g).costoAcumulado) }}
              </span>
            </div>
          </td>
          <td><Badge :label="g.tipo === 'ECOMMERCE' ? 'Ecommerce' : 'Común'" :tone="g.tipo === 'ECOMMERCE' ? 'var(--info)' : 'var(--muted)'" /></td>
        </tr>
      </TransitionGroup>
    </table>

    <div v-if="!items.length" class="empty">
      <span class="empty-ic"><Truck :size="26" /></span>
      <div class="empty-title">Sin guardados</div>
      <div class="empty-sub">{{ hasFilters ? 'No hay resultados para estos filtros.' : 'Los guardados de transporte aparecerán aquí.' }}</div>
      <button class="btn btn-primary btn-sm" @click="hasFilters ? emit('clear') : emit('new')">
        {{ hasFilters ? 'Limpiar filtros' : 'Nuevo guardado' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel { overflow: hidden; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl thead th { text-align: left; padding: 0; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.th-btn {
  display: inline-flex; align-items: center; gap: 5px; width: 100%;
  padding: 12px 16px; background: transparent; border: none; cursor: pointer;
  font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
  color: var(--muted); transition: color .12s;
}
.th-btn:hover { color: var(--ink-2); }
.th-btn.active { color: var(--brand-deep); }
.th-arrow { transition: transform .18s; }
.th-arrow.idle { opacity: 0; transition: opacity .12s; }
.th-btn:hover .th-arrow.idle { opacity: .5; }

.row { cursor: pointer; transition: background .14s; }
.row td { padding: 15px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; transition: background .14s; }
.row td:first-child { position: relative; }
.row td:first-child::before {
  content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--rail), color-mix(in srgb, var(--rail) 45%, transparent));
}
.row:last-child td { border-bottom: none; }
.row:hover td { background: color-mix(in srgb, var(--rail) 5%, var(--surface)); }
.row:hover td:first-child::before { top: 4px; bottom: 4px; box-shadow: 0 0 10px color-mix(in srgb, var(--rail) 45%, transparent); }
/* Densidad */
.d-compacto .row td { padding: 8px 16px; }
.d-compacto .sub { margin-top: 1px; }
.d-compacto :deep(.pill) { padding: 3px 9px 3px 7px; }
.d-compacto .doc-ic { display: none; }

.doc-row { display: flex; align-items: center; gap: 10px; }
.doc-ic { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--surface-3); color: var(--muted); }
.doc-ic.ecom { background: var(--info-tint); color: var(--info); }
.doc { font-size: 13px; font-weight: 700; color: var(--ink); }
.sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
.city { display: inline-flex; align-items: center; gap: 3px; }
.city svg { color: var(--faint); }
.ent { font-size: 13px; font-weight: 700; }
.nofecha { font-size: 11px; font-weight: 600; color: var(--error); }
.ubic { font-size: 13px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.alm { display: flex; flex-direction: column; gap: 5px; }
.alm-cost { font-size: 12px; font-weight: 700; color: var(--bill-deep); }
.alm-cost.gracia { color: var(--u-ok); }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 56px 20px; text-align: center; }
.empty-ic { width: 56px; height: 56px; border-radius: 50%; background: var(--surface-3); display: grid; place-items: center; color: var(--faint); margin-bottom: 6px; }
.empty-title { font-family: var(--display); font-size: 16px; font-weight: 700; }
.empty-sub { font-size: 13px; color: var(--muted); margin-bottom: 8px; }

/* Transiciones de fila (entrada escalonada + reordenamiento FLIP) */
.row-move { transition: transform .42s cubic-bezier(.22,1,.36,1); }
.row-enter-active { transition: opacity .4s ease, transform .4s cubic-bezier(.22,1,.36,1); transition-delay: var(--d, 0ms); }
.row-enter-from { opacity: 0; transform: translateY(8px); }
.row-leave-active { transition: opacity .2s ease; position: absolute; width: 100%; }
.row-leave-to { opacity: 0; }
</style>
