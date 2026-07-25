<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import {
  fmtFechaHoraLog, labelAccion, labelModulo, toneAccion, type LogItem,
} from '~/utils/auditoria'

defineProps<{ items: LogItem[]; hasFilters: boolean }>()

const esCompacto = useMediaQuery('(max-width: 760px)')
</script>

<template>
  <div class="card table-card">
    <table v-if="!esCompacto" class="table">
      <thead>
        <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Registro</th><th>Detalle</th></tr>
      </thead>
      <tbody>
        <tr v-for="l in items" :key="l.id" :style="{ '--tone': toneAccion(l.action) }">
          <td class="muted tnum nowrap">{{ fmtFechaHoraLog(l.createdAt) }}</td>
          <td class="usr">
            <span class="nom">{{ l.user?.name ?? 'Sistema' }}</span>
            <span class="mail">{{ l.user?.email ?? '—' }}</span>
          </td>
          <td><Badge :label="labelAccion(l.action)" :tone="toneAccion(l.action)" /></td>
          <td class="mod">{{ labelModulo(l.module) }}</td>
          <td class="mono rec" :title="l.recordId">{{ l.recordId }}</td>
          <td class="det" :title="l.details ?? ''">{{ l.details || '—' }}</td>
        </tr>
      </tbody>
    </table>

    <div v-else class="cards">
      <article v-for="l in items" :key="l.id" class="rowcard" :style="{ '--tone': toneAccion(l.action) }">
        <header class="rc-top">
          <Badge :label="labelAccion(l.action)" :tone="toneAccion(l.action)" />
          <span class="muted tnum">{{ fmtFechaHoraLog(l.createdAt) }}</span>
        </header>
        <p class="rc-main">{{ l.user?.name ?? 'Sistema' }} · <span class="mod">{{ labelModulo(l.module) }}</span></p>
        <p v-if="l.details" class="rc-det">{{ l.details }}</p>
        <span class="mono rc-rec">{{ l.recordId }}</span>
      </article>
    </div>

    <EmptyState
      v-if="items.length === 0"
      title="Sin movimientos"
      :description="hasFilters ? 'Ningún registro con estos filtros.' : 'Todavía no hay actividad registrada.'"
    />
  </div>
</template>

<style scoped>
.table-card { overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 12px 14px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.table td { padding: 10px 14px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); vertical-align: top; }
.table tr:last-child td { border-bottom: none; }
.table td:first-child { box-shadow: inset 3px 0 0 var(--tone); }
.nowrap { white-space: nowrap; }
.muted { color: var(--muted); }
.usr { display: flex; flex-direction: column; gap: 1px; max-width: 180px; }
.nom { color: var(--ink); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mail { font-size: 11.5px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mod { font-size: 12.5px; }
.rec { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--faint); }
.det { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cards { display: flex; flex-direction: column; }
.rowcard { padding: 12px 14px; border-bottom: 1px solid var(--border); box-shadow: inset 3px 0 0 var(--tone); }
.rowcard:last-child { border-bottom: none; }
.rc-top { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
.rc-top .tnum { font-size: 11.5px; }
.rc-main { margin: 8px 0 0; font-size: 13px; color: var(--ink); }
.rc-det { margin: 5px 0 0; font-size: 12.5px; color: var(--muted); }
.rc-rec { display: block; margin-top: 6px; font-size: 11px; color: var(--faint); }
</style>
