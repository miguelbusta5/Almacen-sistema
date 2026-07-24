<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { AlertTriangle, Camera, CheckCircle2, RefreshCw, Save, Truck, XCircle } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import {
  PREOP_ESTADO_LABEL, PREOP_ESTADO_TONE, PREOP_RESULTADO_LABEL, estadoEstimado,
  type ConductorData, type FormItem, type ResultadoInspeccion,
} from '~/utils/preoperacional'

const { show: showToast } = useToast()

const data = ref<ConductorData | null>(null)
const loading = ref(true)
const items = ref<FormItem[]>([])
const kilometraje = ref('')
const observaciones = ref('')
const saving = ref(false)
const refreshing = ref(false)

function apiErr(e: any, fallback: string) {
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || fallback
}

async function load() {
  try {
    const res = await $fetch<ConductorData>('/api/preoperacional')
    data.value = res
    items.value = (res.checklist ?? []).map((i) => ({ ...i, resultado: 'CONFORME' as ResultadoInspeccion, observacion: '', fotoUrl: null }))
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar preoperacional'), true)
  }
}

onMounted(async () => { loading.value = true; await load(); loading.value = false })

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  await load()
  refreshing.value = false
}

const resumen = computed(() => {
  const noConformes = items.value.filter((i) => i.resultado === 'NO_CONFORME')
  return {
    estado: estadoEstimado(items.value),
    noConformes: noConformes.length,
    criticos: noConformes.filter((i) => i.esCritico).length,
  }
})

function updateItem(index: number, patch: Partial<FormItem>) {
  const cur = items.value[index]
  if (!cur) return
  items.value[index] = { ...cur, ...patch }
}

async function uploadFoto(index: number, file: File | null) {
  if (!file) return
  updateItem(index, { uploading: true })
  try {
    const fd = new FormData()
    fd.append('foto', file)
    const res = await $fetch<{ url: string }>('/api/uploads/foto', { method: 'POST', body: fd })
    updateItem(index, { fotoUrl: res.url })
    showToast('Foto cargada')
  } catch (e) {
    showToast(apiErr(e, 'Error cargando foto'), true)
  } finally {
    updateItem(index, { uploading: false })
  }
}

async function submit() {
  const faltanObs = items.value.some((i) => i.resultado === 'NO_CONFORME' && !i.observacion.trim())
  if (faltanObs) { showToast('Describe cada item no conforme', true); return }

  saving.value = true
  try {
    await $fetch('/api/preoperacional', {
      method: 'POST',
      body: {
        kilometraje: kilometraje.value ? Number(kilometraje.value) : null,
        observaciones: observaciones.value.trim() || null,
        items: items.value.map((i) => ({
          item: i.item,
          resultado: i.resultado,
          observacion: i.observacion.trim() || null,
          fotoUrl: i.fotoUrl,
        })),
      },
    })
    showToast('Preoperacional registrado')
    kilometraje.value = ''
    observaciones.value = ''
    await load()
  } catch (e) {
    showToast(apiErr(e, 'Error guardando'), true)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fade-in">
    <section class="hero">
      <div class="hero-left">
        <div class="hero-kicker">Checklist vehicular</div>
        <h1 class="hero-title">Preoperacional</h1>
        <p v-if="data?.transportista && data.vehiculo" class="hero-desc">
          {{ data.transportista.nombre }} · {{ data.vehiculo.placa }} · {{ data.vehiculo.tipo }}
        </p>
      </div>
      <button class="btn btn-sm refresh" :class="{ spin: refreshing }" @click="refresh"><RefreshCw :size="14" /> {{ refreshing ? 'Actualizando…' : 'Actualizar' }}</button>
    </section>

    <ListSkeleton v-if="loading" />

    <EmptyState
      v-else-if="!data?.transportista || !data.vehiculo"
      title="Sin vehículo asignado"
      description="Tu usuario debe estar vinculado a un transportista activo y a un vehículo antes de registrar el preoperacional."
    >
      <template #icon><Truck :size="20" /></template>
    </EmptyState>

    <template v-else>
      <div class="stats">
        <div class="stat"><span class="stat-value" :style="{ color: data.inspeccionHoy ? 'var(--u-ok)' : 'var(--u-aviso)' }">{{ data.inspeccionHoy ? 'Sí' : 'No' }}</span><span class="stat-label">Registrado hoy</span></div>
        <div class="stat"><span class="stat-value" :style="{ color: PREOP_ESTADO_TONE[resumen.estado] }">{{ PREOP_ESTADO_LABEL[resumen.estado] }}</span><span class="stat-label">Resultado estimado</span></div>
        <div class="stat"><span class="stat-value" :style="{ color: resumen.noConformes > 0 ? 'var(--u-aviso)' : 'var(--u-ok)' }">{{ resumen.noConformes }}</span><span class="stat-label">No conformes</span></div>
        <div class="stat"><span class="stat-value" :style="{ color: resumen.criticos > 0 ? 'var(--u-critico)' : 'var(--u-ok)' }">{{ resumen.criticos }}</span><span class="stat-label">Críticos</span></div>
      </div>

      <div v-if="data.inspeccionHoy" class="banner" :style="{ '--c': PREOP_ESTADO_TONE[data.inspeccionHoy.estado] }">
        <XCircle v-if="data.inspeccionHoy.estado === 'BLOQUEADA'" :size="16" color="var(--u-critico)" />
        <CheckCircle2 v-else :size="16" :color="PREOP_ESTADO_TONE[data.inspeccionHoy.estado]" />
        <span>Ya registraste una inspección hoy: {{ PREOP_ESTADO_LABEL[data.inspeccionHoy.estado] }}</span>
      </div>

      <div class="card form-card">
        <div class="g2">
          <label class="fw"><span class="fl">Kilometraje</span><input v-model="kilometraje" type="number" min="0" class="field"></label>
          <label class="fw"><span class="fl">Observaciones generales</span><input v-model="observaciones" class="field" placeholder="Sin observaciones"></label>
        </div>

        <div class="checklist">
          <div v-for="(item, index) in items" :key="item.item" class="citem" :class="{ bad: item.resultado === 'NO_CONFORME' }">
            <div class="cinfo">
              <div class="cname">{{ item.item }}</div>
              <div class="cmeta">
                <span class="ccat">{{ item.categoria }}</span>
                <Badge v-if="item.esCritico" label="Crítico" tone="var(--u-critico)" />
              </div>
            </div>
            <select :value="item.resultado" class="field csel" @change="updateItem(index, { resultado: ($event.target as HTMLSelectElement).value as ResultadoInspeccion })">
              <option v-for="(label, value) in PREOP_RESULTADO_LABEL" :key="value" :value="value">{{ label }}</option>
            </select>
            <input
              :value="item.observacion" class="field cobs"
              :placeholder="item.resultado === 'NO_CONFORME' ? 'Describe la novedad' : 'Observación'"
              @input="updateItem(index, { observacion: ($event.target as HTMLInputElement).value })"
            >
            <label class="btn btn-ghost btn-sm cfoto">
              <Camera :size="13" />{{ item.uploading ? 'Subiendo' : item.fotoUrl ? 'Cargada' : 'Foto' }}
              <input type="file" accept="image/*" style="display:none" @change="uploadFoto(index, ($event.target as HTMLInputElement).files?.[0] ?? null)">
            </label>
          </div>
        </div>

        <div class="form-footer">
          <div class="resultado-tag" :style="{ color: PREOP_ESTADO_TONE[resumen.estado] }">
            <AlertTriangle v-if="resumen.estado === 'BLOQUEADA'" :size="14" />
            Resultado: {{ PREOP_ESTADO_LABEL[resumen.estado] }}
          </div>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <Spinner v-if="saving" /><Save v-else :size="14" />{{ saving ? 'Guardando…' : 'Guardar inspección' }}
          </button>
        </div>
      </div>

      <div class="card hist-card">
        <div class="hist-title">Historial reciente</div>
        <div v-if="data.historial.length === 0" class="hist-empty">Aún no hay inspecciones registradas.</div>
        <div v-else class="hist-list">
          <div v-for="h in data.historial" :key="h.id" class="hist-row">
            <div>
              <div class="hist-fecha">{{ h.fecha }}</div>
              <div class="hist-km">{{ h.kilometraje != null ? `${h.kilometraje} km` : 'Sin kilometraje' }}</div>
            </div>
            <Badge :label="PREOP_ESTADO_LABEL[h.estado]" :tone="PREOP_ESTADO_TONE[h.estado]" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand-deep); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 4px 0 0; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 5px 0 0; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 18px; margin-bottom: 22px; }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat-value { font-family: var(--display); font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
.stat-label { font-size: 12px; color: var(--muted); font-weight: 600; }

.banner { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--r-sm); margin-bottom: 18px; font-size: 13px; font-weight: 600; color: var(--ink); border: 1px solid color-mix(in srgb, var(--c) 30%, transparent); background: color-mix(in srgb, var(--c) 10%, transparent); flex-wrap: wrap; }

.form-card { padding: 18px; margin-bottom: 22px; display: flex; flex-direction: column; gap: 16px; }
.g2 { display: grid; grid-template-columns: 160px 1fr; gap: 12px; }
.fw { display: flex; flex-direction: column; gap: 6px; }
.fl { font-size: 12px; font-weight: 600; color: var(--muted); }

.checklist { display: flex; flex-direction: column; gap: 8px; }
.citem { display: grid; grid-template-columns: 1fr 150px 220px 120px; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); }
.citem.bad { background: color-mix(in srgb, var(--u-critico) 4%, var(--surface)); }
.cname { font-size: 13px; font-weight: 700; color: var(--ink); }
.cmeta { display: flex; gap: 8px; align-items: center; margin-top: 3px; }
.ccat { font-size: 11px; color: var(--muted); text-transform: capitalize; }
.cfoto { justify-content: center; }

.form-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.resultado-tag { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; }

.hist-card { padding: 18px; }
.hist-title { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
.hist-empty { font-size: 12px; color: var(--muted); }
.hist-list { display: flex; flex-direction: column; gap: 8px; }
.hist-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.hist-row:last-child { border-bottom: none; }
.hist-fecha { font-size: 13px; font-weight: 700; color: var(--ink); }
.hist-km { font-size: 11px; color: var(--muted); }

@media (max-width: 720px) {
  .g2 { grid-template-columns: 1fr; }
  .citem { grid-template-columns: 1fr; }
}
</style>
