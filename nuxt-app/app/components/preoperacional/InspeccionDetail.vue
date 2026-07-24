<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft, Trash2 } from '@lucide/vue'
import { PREOP_ESTADO_LABEL, PREOP_ESTADO_TONE, PREOP_RESULTADO_LABEL, type HistorialRow, type InspeccionDetalle } from '~/utils/preoperacional'

const props = defineProps<{ row: HistorialRow; role: string }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'delete'): void }>()

const detail = ref<InspeccionDetalle | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await $fetch<{ data: InspeccionDetalle }>(`/api/preoperacional/${props.row.id}`)
    detail.value = res.data
  } catch { detail.value = null }
  loading.value = false
})

const categorias = computed(() => detail.value ? Array.from(new Set(detail.value.items.map((i) => i.categoria))) : [])
function itemsDe(cat: string) { return detail.value?.items.filter((i) => i.categoria === cat) ?? [] }
</script>

<template>
  <div class="detail fade-in">
    <button class="btn btn-ghost btn-sm back" @click="emit('back')"><ArrowLeft :size="15" /> Volver a la lista</button>

    <header class="dhead card">
      <div class="dhead-main">
        <div class="dtitle-row">
          <h1>{{ row.conductor?.nombre ?? 'Inspector' }} — {{ row.fecha }}</h1>
          <Badge :label="PREOP_ESTADO_LABEL[row.estado]" :tone="PREOP_ESTADO_TONE[row.estado]" solid />
        </div>
      </div>
    </header>

    <div class="card sec">
      <h3>Información general</h3>
      <div class="dgrid">
        <div class="ditem"><span class="dlabel">Fecha</span><span class="dvalue">{{ row.fecha }}</span></div>
        <div class="ditem"><span class="dlabel">Conductor</span><span class="dvalue">{{ row.conductor?.nombre ?? '—' }}</span></div>
        <div class="ditem"><span class="dlabel">Vehículo</span><span class="dvalue">{{ row.vehiculo?.placa ?? '—' }} · {{ row.vehiculo?.tipo ?? '' }}</span></div>
        <div class="ditem"><span class="dlabel">Kilometraje</span><span class="dvalue">{{ row.kilometraje != null ? `${row.kilometraje.toLocaleString()} km` : '—' }}</span></div>
        <div class="ditem"><span class="dlabel">Estado</span><span class="dvalue">{{ PREOP_ESTADO_LABEL[row.estado] }}</span></div>
        <div class="ditem"><span class="dlabel">Ítems evaluados</span><span class="dvalue">{{ row.itemsCount }}</span></div>
        <div class="ditem"><span class="dlabel">No conformes</span><span class="dvalue">{{ row.noConformes }}</span></div>
        <div class="ditem"><span class="dlabel">Críticos</span><span class="dvalue">{{ row.criticos }}</span></div>
        <div v-if="detail?.observaciones" class="ditem"><span class="dlabel">Observaciones</span><span class="dvalue">{{ detail.observaciones }}</span></div>
      </div>
    </div>

    <p v-if="loading" class="loading-hint">Cargando ítems…</p>

    <div v-for="cat in categorias" :key="cat" class="card sec">
      <h3>Checklist — {{ cat }}</h3>
      <div class="items">
        <div v-for="itm in itemsDe(cat)" :key="itm.id" class="item" :class="{ bad: itm.resultado === 'NO_CONFORME' }">
          <div class="iinfo">
            <div class="iname">{{ itm.item }} <Badge v-if="itm.esCritico" label="Crítico" tone="var(--u-critico)" /></div>
            <div v-if="itm.observacion" class="iobs">{{ itm.observacion }}</div>
            <a v-if="itm.fotoUrl" :href="itm.fotoUrl" target="_blank" rel="noreferrer" class="ifoto">Ver foto →</a>
          </div>
          <span
            class="iresult"
            :style="{ color: itm.resultado === 'CONFORME' ? 'var(--u-ok)' : itm.resultado === 'NO_CONFORME' ? 'var(--u-critico)' : 'var(--muted)' }"
          >{{ PREOP_RESULTADO_LABEL[itm.resultado] }}</span>
        </div>
      </div>
    </div>

    <div v-if="role === 'ADMIN'" class="card sec admin-zone">
      <h3>Zona de administración</h3>
      <div class="admin-row">
        <p class="admin-hint">Eliminar esta inspección permanentemente</p>
        <button class="btn btn-danger btn-sm" @click="emit('delete')"><Trash2 :size="13" /> Eliminar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.back { margin-bottom: 14px; }
.dhead { padding: 18px 20px; margin-bottom: 16px; }
.dtitle-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dhead h1 { font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
.sec { padding: 16px 18px; margin-bottom: 16px; }
.sec h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 12px; }
.dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.ditem { display: flex; flex-direction: column; gap: 3px; }
.dlabel { font-size: 11px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.dvalue { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.loading-hint { font-size: 13px; color: var(--muted); margin: 0 0 16px; }

.items { display: flex; flex-direction: column; gap: 6px; }
.item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-2); }
.item.bad { background: color-mix(in srgb, var(--u-critico) 4%, var(--surface-2)); }
.iinfo { flex: 1; min-width: 0; }
.iname { font-size: 13px; font-weight: 600; color: var(--ink); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.iobs { font-size: 12px; color: var(--muted); margin-top: 3px; }
.ifoto { font-size: 11px; color: var(--brand); margin-top: 3px; display: block; }
.iresult { font-size: 11px; font-weight: 600; white-space: nowrap; }

.admin-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.admin-hint { font-size: 12px; color: var(--muted); margin: 0; }
@media (max-width: 720px) { .dgrid { grid-template-columns: 1fr; } }
</style>
