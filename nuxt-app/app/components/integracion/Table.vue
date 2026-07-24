<script setup lang="ts">
import { CheckCircle2, Pencil, Trash2 } from '@lucide/vue'
import { integFmtFecha, INTEG_ESTADO_LABEL, INTEG_ESTADO_TONE, type Integracion } from '~/utils/integracion'

defineProps<{
  items: Integracion[]
  canCompleteArea2: (item: Integracion) => boolean
  canTransport: boolean
  canEdit: (item: Integracion) => boolean
  isAdmin: boolean
  deletingId: string | null
}>()
const emit = defineEmits<{
  (e: 'rowClick', item: Integracion): void
  (e: 'completar', item: Integracion): void
  (e: 'recibido', item: Integracion): void
  (e: 'editar', item: Integracion): void
  (e: 'deleteStart', id: string): void
  (e: 'deleteConfirm', id: string): void
  (e: 'deleteCancel'): void
}>()
</script>

<template>
  <div class="card table-card">
    <table class="table">
      <thead>
        <tr>
          <th>Documento</th><th>Tipo</th><th>Fecha</th><th>Área inicio</th><th>Estado</th><th>Cajas</th><th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" class="row" @click="emit('rowClick', item)">
          <td class="mono doc">{{ item.numeroDocumento }}</td>
          <td><span class="tipo-tag">{{ item.tipoDocumento }}</span></td>
          <td class="muted">{{ integFmtFecha(item.fecha) }}</td>
          <td class="area">{{ item.areaIniciadora }}</td>
          <td><Badge :label="INTEG_ESTADO_LABEL[item.estado]" :tone="INTEG_ESTADO_TONE[item.estado]" /></td>
          <td class="muted">{{ item.numeroCajasArea1 ?? '—' }} + {{ item.numeroCajasArea2 ?? '—' }}</td>
          <td class="acciones" @click.stop>
            <button v-if="canEdit(item)" class="btn-icon" title="Editar" @click="emit('editar', item)"><Pencil :size="13" /></button>
            <button v-if="canCompleteArea2(item)" class="btn-icon accent" @click="emit('completar', item)">Completar</button>
            <button v-else-if="canTransport && item.estado === 'LISTA_TRANSPORTE'" class="btn-icon ok" @click="emit('recibido', item)">
              <CheckCircle2 :size="12" /> Recibido
            </button>
            <template v-if="isAdmin">
              <template v-if="deletingId === item.id">
                <button class="btn-icon danger-solid" @click="emit('deleteConfirm', item.id)">Sí, eliminar</button>
                <button class="btn-icon" @click="emit('deleteCancel')">Cancelar</button>
              </template>
              <button v-else class="btn-icon" title="Eliminar" @click="emit('deleteStart', item.id)"><Trash2 :size="13" /></button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <EmptyState v-if="items.length === 0" title="Sin integraciones" description="Crea la primera integración de pedido." />
  </div>
</template>

<style scoped>
.table-card { overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.table td { padding: 12px 16px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); }
.row { cursor: pointer; transition: background .12s; }
.row:hover { background: var(--surface-2); }
.row:last-child td { border-bottom: none; }
.doc { font-weight: 600; color: var(--ink); }
.area { font-size: 12px; font-weight: 600; color: var(--brand-deep); }
.tipo-tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--r-xs); background: var(--brand-tint); color: var(--brand-deep); }
.acciones { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.btn-icon { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: var(--r-xs); border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; font-size: 12px; }
.btn-icon:hover { background: var(--surface-3); color: var(--ink); }
.btn-icon.accent { color: var(--brand-deep); border-color: color-mix(in srgb, var(--brand) 35%, transparent); }
.btn-icon.ok { color: var(--u-ok); border-color: color-mix(in srgb, var(--u-ok) 35%, transparent); }
.btn-icon.danger-solid { color: var(--u-critico); border-color: var(--u-critico); }
</style>
