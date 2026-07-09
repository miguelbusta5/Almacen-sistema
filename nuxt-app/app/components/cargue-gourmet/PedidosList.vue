<script setup lang="ts">
import { ref, computed } from 'vue'
import { Package, MapPin, ChevronUp, ChevronDown, ChevronsUpDown } from '@lucide/vue'
import { ESTADO_LABEL, ESTADO_TONE, fmtFechaHora, horasDesde, type PedidoGourmet } from '~/utils/gourmet'

const props = defineProps<{ items: PedidoGourmet[]; hasFilters: boolean; density?: 'comodo' | 'compacto' }>()
const emit = defineEmits<{ (e: 'open', p: PedidoGourmet): void; (e: 'clear'): void; (e: 'new'): void }>()

type SortKey = 'estado' | 'orden' | 'tienda' | 'ciudad' | 'ubicaciones' | 'tipo' | 'creacion'
const columns: { key: SortKey; label: string; w: string }[] = [
  { key: 'estado', label: 'Estado', w: '11%' },
  { key: 'orden', label: 'Orden', w: '15%' },
  { key: 'tienda', label: 'Tienda', w: '19%' },
  { key: 'ciudad', label: 'Destino', w: '11%' },
  { key: 'ubicaciones', label: 'Ubicación', w: '15%' },
  { key: 'tipo', label: 'Tipo', w: '10%' },
  { key: 'creacion', label: 'Creado', w: '19%' },
]
const sortKey = ref<SortKey>('creacion')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = k; sortDir.value = k === 'creacion' ? 'desc' : 'asc' }
}

function sortVal(p: PedidoGourmet, k: SortKey): number | string {
  switch (k) {
    case 'estado': return p.estado
    case 'orden': return p.orden
    case 'tienda': return p.nombreTienda
    case 'ciudad': return p.ciudadDestino
    case 'ubicaciones': return p.ubicaciones ?? ''
    case 'tipo': return p.tipoPedido
    case 'creacion': return p.createdAt
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

function urgente(p: PedidoGourmet) {
  return p.estado === 'BORRADOR' && horasDesde(p.createdAt) >= 24
}
</script>

<template>
  <div class="panel card" :class="`d-${density ?? 'comodo'}`">
    <table class="tbl">
      <thead>
        <tr>
          <th
            v-for="c in columns" :key="c.key" :style="{ width: c.w }"
            :aria-sort="sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'"
          >
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
          v-for="(p, i) in sorted" :key="p.id" class="row"
          tabindex="0" role="button" :aria-label="`Ver pedido ${p.orden}`"
          :style="{ '--rail': urgente(p) ? 'var(--u-critico)' : ESTADO_TONE[p.estado], '--d': `${Math.min(i, 12) * 32}ms` }"
          @click="emit('open', p)" @keydown.enter="emit('open', p)" @keydown.space.prevent="emit('open', p)"
        >
          <td><Badge :label="ESTADO_LABEL[p.estado]" :tone="ESTADO_TONE[p.estado]" /></td>
          <td>
            <div class="doc mono">{{ p.orden }}</div>
            <div class="sub">{{ p.cajasEsperadas }} caja(s) · {{ p.estibasEsperadas }} estiba(s)</div>
          </td>
          <td><div class="cli" :title="p.nombreTienda">{{ p.nombreTienda }}</div></td>
          <td><div class="sub city"><MapPin :size="11" />{{ p.ciudadDestino || '—' }}</div></td>
          <td><div class="ubic" :title="p.ubicaciones">{{ p.ubicaciones || '—' }}</div></td>
          <td>
            <Badge :label="p.tipoPedido === 'MUEBLES' ? 'Muebles' : 'Gourmet'" :tone="p.tipoPedido === 'MUEBLES' ? 'var(--u-aviso)' : 'var(--brand)'">
              <MapPin :size="11" />
            </Badge>
          </td>
          <td>
            <div class="mono">{{ fmtFechaHora(p.createdAt) }}</div>
            <div v-if="urgente(p)" class="sub urg">{{ horasDesde(p.createdAt) }}h sin ubicar</div>
          </td>
        </tr>
      </TransitionGroup>
    </table>

    <div v-if="!items.length" class="empty">
      <span class="empty-ic"><Package :size="26" /></span>
      <div class="empty-title">Sin pedidos</div>
      <div class="empty-sub">{{ hasFilters ? 'No hay resultados para estos filtros.' : 'Los pedidos Gourmet aparecerán aquí.' }}</div>
      <button class="btn btn-primary btn-sm" @click="hasFilters ? emit('clear') : emit('new')">
        {{ hasFilters ? 'Limpiar filtros' : 'Nuevo pedido' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel { overflow-x: auto; overflow-y: hidden; }
.tbl { width: 100%; min-width: 960px; border-collapse: collapse; }
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
.row:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
.row td { padding: 15px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; transition: background .14s; }
.row td:first-child { position: relative; }
.row td:first-child::before {
  content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--rail), color-mix(in srgb, var(--rail) 45%, transparent));
}
.row:last-child td { border-bottom: none; }
.row:hover td { background: color-mix(in srgb, var(--rail) 5%, var(--surface)); }
.row:hover td:first-child::before { top: 4px; bottom: 4px; box-shadow: 0 0 10px color-mix(in srgb, var(--rail) 45%, transparent); }
.d-compacto .row td { padding: 8px 16px; }
.d-compacto .sub { margin-top: 1px; }

.doc { font-size: 13px; font-weight: 700; color: var(--ink); }
.cli { font-size: 13px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.ubic { font-size: 13px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
.city { display: inline-flex; align-items: center; gap: 3px; }
.city svg { color: var(--faint); }
.urg { color: var(--u-critico); font-weight: 700; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 56px 20px; text-align: center; }
.empty-ic { width: 56px; height: 56px; border-radius: 50%; background: var(--surface-3); display: grid; place-items: center; color: var(--faint); margin-bottom: 6px; }
.empty-title { font-family: var(--display); font-size: 16px; font-weight: 700; }
.empty-sub { font-size: 13px; color: var(--muted); margin-bottom: 8px; }

.row-move { transition: transform .42s cubic-bezier(.22,1,.36,1); }
.row-enter-active { transition: opacity .4s ease, transform .4s cubic-bezier(.22,1,.36,1); transition-delay: var(--d, 0ms); }
.row-enter-from { opacity: 0; transform: translateY(8px); }
.row-leave-active { transition: opacity .2s ease; position: absolute; width: 100%; }
.row-leave-to { opacity: 0; }
</style>
