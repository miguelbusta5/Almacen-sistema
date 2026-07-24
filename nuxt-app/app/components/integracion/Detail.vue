<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, CheckCircle2, Pencil, Trash2 } from '@lucide/vue'
import {
  areaContraria as areaContrariaOf, integFmtFecha, integFmtFechaHora,
  INTEG_ESTADO_LABEL, INTEG_ESTADO_TONE, type Integracion,
} from '~/utils/integracion'

const props = defineProps<{
  item: Integracion
  canEdit: boolean
  canCompleteArea2: boolean
  canTransport: boolean
  isAdmin: boolean
  deleting: boolean
}>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'editar'): void
  (e: 'completar'): void
  (e: 'recibido'): void
  (e: 'deleteStart'): void
  (e: 'deleteConfirm'): void
  (e: 'deleteCancel'): void
}>()

const areaContraria = computed(() => areaContrariaOf(props.item.areaIniciadora))
const detalle = computed(() => [
  { label: 'Fecha', value: integFmtFecha(props.item.fecha) },
  { label: 'Área iniciadora', value: props.item.areaIniciadora },
  { label: 'Tipo documento', value: props.item.tipoDocumento },
  { label: 'Creado por', value: props.item.creadoPorNombre ?? '—' },
  { label: 'Creado el', value: integFmtFechaHora(props.item.creadoAt) },
  { label: `Cajas Área ${props.item.areaIniciadora}`, value: props.item.numeroCajasArea1 ?? '—' },
  ...(props.item.completadoPorNombre ? [{ label: 'Completado por (Área 2)', value: props.item.completadoPorNombre }] : []),
  ...(props.item.completadoAt ? [{ label: 'Completado el', value: integFmtFechaHora(props.item.completadoAt) }] : []),
  ...(props.item.marcadoCompletadoAt ? [{ label: 'Recibido transporte', value: integFmtFechaHora(props.item.marcadoCompletadoAt) }] : []),
  { label: `Cajas Área ${areaContraria.value}`, value: props.item.numeroCajasArea2 ?? '—' },
])
const areas = computed(() => [props.item.areaIniciadora, areaContraria.value])
function plinesDe(area: string) { return props.item.plines.filter((p) => p.area === area) }
</script>

<template>
  <div class="detail fade-in">
    <button class="btn btn-ghost btn-sm back" @click="emit('back')"><ArrowLeft :size="15" /> Volver a la lista</button>

    <header class="dhead card">
      <div class="dtitle-row">
        <h1>{{ item.tipoDocumento }} {{ item.numeroDocumento }}</h1>
        <Badge :label="INTEG_ESTADO_LABEL[item.estado]" :tone="INTEG_ESTADO_TONE[item.estado]" solid />
      </div>
      <div class="dactions">
        <button v-if="canEdit" class="btn btn-sm" @click="emit('editar')"><Pencil :size="14" /> Editar</button>
        <button v-if="canCompleteArea2" class="btn btn-primary btn-sm" @click="emit('completar')">Completar Área 2</button>
        <button v-else-if="canTransport && item.estado === 'LISTA_TRANSPORTE'" class="btn btn-sm ok-btn" @click="emit('recibido')">
          <CheckCircle2 :size="14" /> Confirmar recepción
        </button>
      </div>
    </header>

    <div class="card sec">
      <h3>Información general</h3>
      <div class="dgrid">
        <div v-for="d in detalle" :key="d.label" class="ditem">
          <span class="dlabel">{{ d.label }}</span>
          <span class="dvalue">{{ d.value }}</span>
        </div>
      </div>
    </div>

    <div v-if="item.observaciones" class="card sec">
      <h3>Observaciones</h3>
      <p class="obs">{{ item.observaciones }}</p>
    </div>

    <div v-for="area in areas" :key="area" class="card sec">
      <h3>PLUs — Área {{ area }}<span v-if="area === item.areaIniciadora"> (iniciadora)</span></h3>
      <p v-if="plinesDe(area).length === 0" class="empty-plu">Pendiente de completar</p>
      <table v-else class="ref-table">
        <thead><tr><th>PLU</th><th>Descripción</th><th>Uds</th></tr></thead>
        <tbody>
          <tr v-for="p in plinesDe(area)" :key="p.id">
            <td class="mono">{{ p.plu }}</td>
            <td class="muted">{{ p.descripcion ?? '—' }}</td>
            <td>{{ p.unidades }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="isAdmin" class="card sec admin-zone">
      <h3>Zona de administración</h3>
      <div class="admin-row">
        <p class="admin-hint">Eliminar esta integración permanentemente</p>
        <div v-if="deleting" class="admin-confirm">
          <button class="btn btn-danger btn-sm" @click="emit('deleteConfirm')">Confirmar eliminación</button>
          <button class="btn btn-ghost btn-sm" @click="emit('deleteCancel')">Cancelar</button>
        </div>
        <button v-else class="btn btn-danger btn-sm" @click="emit('deleteStart')"><Trash2 :size="13" /> Eliminar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.back { margin-bottom: 14px; }
.dhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; margin-bottom: 16px; flex-wrap: wrap; }
.dtitle-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dhead h1 { font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
.dactions { display: flex; gap: 8px; flex-wrap: wrap; }
.ok-btn { color: var(--u-ok); border-color: color-mix(in srgb, var(--u-ok) 35%, transparent); }

.sec { padding: 16px 18px; margin-bottom: 16px; }
.sec h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 12px; }
.dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.ditem { display: flex; flex-direction: column; gap: 3px; }
.dlabel { font-size: 11px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.dvalue { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.obs { font-size: 13px; color: var(--ink); background: var(--surface-2); border-radius: var(--r-sm); padding: 10px 12px; margin: 0; }

.empty-plu { font-size: 13px; color: var(--muted); font-style: italic; margin: 0; }
.ref-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ref-table th { text-align: left; padding: 6px 10px; font-size: 11px; color: var(--muted); font-weight: 500; background: var(--surface-2); }
.ref-table td { padding: 7px 10px; border-top: 1px solid var(--border); }
.ref-table .mono { font-family: var(--mono); }
.ref-table .muted { color: var(--muted); }

.admin-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.admin-hint { font-size: 12px; color: var(--muted); margin: 0; }
.admin-confirm { display: flex; gap: 8px; }
@media (max-width: 720px) { .dgrid { grid-template-columns: 1fr; } }
</style>
