<script setup lang="ts">
// Tabla en escritorio, cards por debajo de 760px (sin scroll horizontal).
import { useMediaQuery } from '@vueuse/core'
import {
  ESTADO_LABEL, ESTADO_TONE, fmtFechaSol, PRIORIDAD_LABEL, PRIORIDAD_TONE,
  SEMAFORO_LABEL, SEMAFORO_TONE, type Solicitud,
} from '~/utils/solicitudesTransporte'

defineProps<{ items: Solicitud[]; hasFilters: boolean }>()
const emit = defineEmits<{ (e: 'open', item: Solicitud): void }>()

const esCompacto = useMediaQuery('(max-width: 760px)')
</script>

<template>
  <div class="card table-card">
    <!-- Escritorio -->
    <table v-if="!esCompacto" class="table">
      <thead>
        <tr>
          <th>Solicitud</th><th>Origen</th><th>Destino</th><th>Cajas</th>
          <th>Promesa</th><th>Estado</th><th>Semáforo</th><th>Gestión</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items" :key="item.id" class="row" role="button" tabindex="0"
          :style="{ '--tone': SEMAFORO_TONE[item.semaforo] }"
          @click="emit('open', item)"
          @keydown.enter.prevent="emit('open', item)"
          @keydown.space.prevent="emit('open', item)"
        >
          <td class="c-sol">
            <span class="pedido">{{ item.numeroPedido || 'Sin pedido' }}</span>
            <span class="sub">{{ item.solicitanteNombre }} · {{ item.areaSolicitante }}</span>
          </td>
          <td class="muted">{{ item.ciudadOrigen }}</td>
          <td class="muted">{{ item.ciudadEntrega }}</td>
          <td class="tnum">{{ item.cantidadCajas ?? '—' }}</td>
          <td>
            <span class="muted">{{ fmtFechaSol(item.fechaPromesaEntrega) }}</span>
            <span v-if="item.prioridad" class="prio" :style="{ '--p': PRIORIDAD_TONE[item.prioridad] }">
              {{ PRIORIDAD_LABEL[item.prioridad] }}
            </span>
          </td>
          <td><Badge :label="ESTADO_LABEL[item.estado]" :tone="ESTADO_TONE[item.estado]" /></td>
          <td><Badge :label="SEMAFORO_LABEL[item.semaforo]" :tone="SEMAFORO_TONE[item.semaforo]" /></td>
          <td class="muted gest">{{ item.transportadora || item.gestionadoPorNombre || '—' }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Móvil -->
    <div v-else class="cards">
      <article
        v-for="item in items" :key="item.id" class="rowcard" role="button" tabindex="0"
        :style="{ '--tone': SEMAFORO_TONE[item.semaforo] }"
        @click="emit('open', item)" @keydown.enter.prevent="emit('open', item)"
      >
        <header class="rc-top">
          <span class="pedido">{{ item.numeroPedido || 'Sin pedido' }}</span>
          <Badge :label="ESTADO_LABEL[item.estado]" :tone="ESTADO_TONE[item.estado]" />
        </header>
        <p class="rc-ruta">{{ item.ciudadOrigen }} → {{ item.ciudadEntrega }}</p>
        <dl class="rc-meta">
          <div><dt>Cajas</dt><dd class="tnum">{{ item.cantidadCajas ?? '—' }}</dd></div>
          <div><dt>Promesa</dt><dd>{{ fmtFechaSol(item.fechaPromesaEntrega) }}</dd></div>
          <div>
            <dt>Semáforo</dt>
            <dd><Badge :label="SEMAFORO_LABEL[item.semaforo]" :tone="SEMAFORO_TONE[item.semaforo]" /></dd>
          </div>
          <div><dt>Gestión</dt><dd>{{ item.transportadora || item.gestionadoPorNombre || '—' }}</dd></div>
        </dl>
      </article>
    </div>

    <EmptyState
      v-if="items.length === 0"
      title="Sin solicitudes"
      :description="hasFilters
        ? 'Ningún resultado con estos filtros.'
        : 'Crea la primera solicitud de transporte interna.'"
    />
  </div>
</template>

<style scoped>
.table-card { overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 12px 14px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.table td { padding: 11px 14px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); vertical-align: top; }
.row { cursor: pointer; transition: background .12s; }
.row:hover { background: var(--surface-2); }
.row:focus-visible { outline: none; background: var(--surface-2); box-shadow: inset 0 0 0 2px var(--brand); }
.row:last-child td { border-bottom: none; }
/* El rail marca la URGENCIA (semáforo); el estado ya tiene su propio badge. */
.row td:first-child { box-shadow: inset 3px 0 0 var(--tone); }
.c-sol { display: flex; flex-direction: column; gap: 2px; max-width: 230px; }
.pedido { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--muted); }
.gest { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prio { display: block; margin-top: 3px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--p); }

.cards { display: flex; flex-direction: column; }
.rowcard { padding: 13px 14px; border-bottom: 1px solid var(--border); cursor: pointer; box-shadow: inset 3px 0 0 var(--tone); }
.rowcard:last-child { border-bottom: none; }
.rowcard:focus-visible { outline: none; background: var(--surface-2); }
.rc-top { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
.rc-ruta { margin: 7px 0 9px; font-size: 13px; color: var(--ink-2); }
.rc-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px 14px; margin: 0; }
.rc-meta dt { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--faint); }
.rc-meta dd { margin: 2px 0 0; font-size: 13px; color: var(--ink-2); }
</style>
