<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { FileText, Package } from '@lucide/vue'
import { areaFromRole, emptyPlu, type Area, type Integracion, type PluRow, type TipoDocumento } from '~/utils/integracion'

const props = defineProps<{ role: string; saving?: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
  (e: 'needCompleteArea2', integracion: Integracion): void
}>()

const areaRol = areaFromRole(props.role)
const isAdminLike = areaRol === null

const f = reactive({
  tipoDocumento: 'OVDM' as TipoDocumento,
  numeroDocumento: '',
  fecha: new Date().toISOString().slice(0, 10),
  areaIniciadora: (areaRol ?? 'MUEBLES') as Area,
  numeroCajas: '',
  observaciones: '',
})
const area = computed(() => areaRol ?? f.areaIniciadora)
const plines = ref<PluRow[]>([emptyPlu()])

const touched = ref(false)
const saving = ref(false)
const error = ref('')
const missing = computed(() => !f.numeroDocumento.trim() || !plines.value.some((p) => p.plu.trim()))

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

async function submit() {
  touched.value = true
  error.value = ''
  const validPlines = plines.value.filter((p) => p.plu.trim())
  if (!f.numeroDocumento.trim()) return
  if (validPlines.length === 0) { error.value = 'Agrega al menos un PLU'; return }

  saving.value = true
  try {
    await $fetch('/api/integracion', {
      method: 'POST',
      body: {
        tipoDocumento: f.tipoDocumento,
        numeroDocumento: f.numeroDocumento.trim(),
        fecha: f.fecha,
        areaIniciadora: area.value,
        numeroCajas: f.numeroCajas ? Number(f.numeroCajas) : undefined,
        plines: validPlines.map((p) => ({ plu: p.plu.trim(), descripcion: p.descripcion.trim() || undefined, unidades: p.unidades })),
        observaciones: f.observaciones.trim() || undefined,
      },
    })
    emit('created')
  } catch (e: any) {
    if (e?.data?.pendiente && e?.data?.integracion) {
      emit('needCompleteArea2', e.data.integracion)
      return
    }
    error.value = apiErr(e, 'Error al crear la integración')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell title="Nueva integración de pedido" sub="Área que crea la solicitud" wide @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><FileText :size="13" /></span> Datos del documento</div>
        <label v-if="isAdminLike" class="fw">
          <span class="fl">Área que crea la solicitud</span>
          <select v-model="f.areaIniciadora" class="field">
            <option value="MUEBLES">Operaciones Muebles</option>
            <option value="GOURMET">Operaciones Gourmet</option>
          </select>
        </label>
        <div class="g2">
          <label class="fw">
            <span class="fl">Tipo doc.</span>
            <select v-model="f.tipoDocumento" class="field"><option value="OVDM">OVDM</option><option value="TSDM">TSDM</option></select>
          </label>
          <label class="fw">
            <span class="fl">N° documento <b>*</b></span>
            <input v-model="f.numeroDocumento" class="field" :class="{ err: touched && !f.numeroDocumento.trim() }" placeholder="Ej. 1234567">
            <span v-if="touched && !f.numeroDocumento.trim()" class="fe">El número de documento es obligatorio</span>
          </label>
        </div>
        <div class="g2">
          <label class="fw"><span class="fl">Fecha</span><input v-model="f.fecha" type="date" class="field"></label>
          <label class="fw"><span class="fl">N° cajas</span><input v-model="f.numeroCajas" type="number" min="1" class="field" placeholder="Opcional"></label>
        </div>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><Package :size="13" /></span> PLUs — Área {{ area }}</div>
        <PluRows v-model="plines" label="" />
        <span v-if="error" class="fe">{{ error }}</span>
      </section>

      <label class="fw">
        <span class="fl">Observaciones</span>
        <textarea v-model="f.observaciones" rows="2" class="field" placeholder="Opcional" />
      </label>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving || (touched && missing)">
          <Spinner v-if="saving" />{{ saving ? 'Creando…' : 'Crear integración' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.fsec { display: flex; flex-direction: column; gap: 11px; padding: 14px 14px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
.fsec-title { display: flex; align-items: center; gap: 9px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
.fsec-ic { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; background: var(--brand-tint); color: var(--brand-deep); }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.fw { display: flex; flex-direction: column; gap: 5px; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.fl b { color: var(--u-critico); font-weight: 700; }
.fe { font-size: 11px; font-weight: 600; color: var(--u-critico); }
.field.err { border-color: var(--u-critico); box-shadow: 0 0 0 3px var(--u-critico-tint); }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
@media (max-width: 560px) { .g2 { grid-template-columns: 1fr; } }
</style>
