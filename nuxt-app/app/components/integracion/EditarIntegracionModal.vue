<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { areaContraria as areaContrariaOf, emptyPlu, type Integracion, type PluRow, type TipoDocumento } from '~/utils/integracion'

const props = defineProps<{ integracion: Integracion }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const areaContraria = computed(() => areaContrariaOf(props.integracion.areaIniciadora))

const f = reactive({
  tipoDocumento: props.integracion.tipoDocumento as TipoDocumento,
  numeroDocumento: props.integracion.numeroDocumento,
  fecha: props.integracion.fecha,
  numeroCajasArea1: props.integracion.numeroCajasArea1 != null ? String(props.integracion.numeroCajasArea1) : '',
  numeroCajasArea2: props.integracion.numeroCajasArea2 != null ? String(props.integracion.numeroCajasArea2) : '',
  observaciones: props.integracion.observaciones ?? '',
})

function toPluRows(area: string): PluRow[] {
  const rows = props.integracion.plines.filter((p) => p.area === area).map((p) => ({ plu: p.plu, descripcion: p.descripcion ?? '', unidades: p.unidades }))
  return rows.length > 0 ? rows : [emptyPlu()]
}
const plinesIniciadora = ref<PluRow[]>(toPluRows(props.integracion.areaIniciadora))
const plinesContraria = ref<PluRow[]>(toPluRows(areaContraria.value))

const touched = ref(false)
const saving = ref(false)
const error = ref('')
const missing = computed(() => !f.numeroDocumento.trim())

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

async function submit() {
  touched.value = true
  error.value = ''
  const validIniciadora = plinesIniciadora.value.filter((p) => p.plu.trim())
  const validContraria = plinesContraria.value.filter((p) => p.plu.trim())
  if (!f.numeroDocumento.trim()) return
  if (validIniciadora.length === 0 && validContraria.length === 0) { error.value = 'Agrega al menos un PLU'; return }

  saving.value = true
  try {
    await $fetch(`/api/integracion/${props.integracion.id}` as string, {
      method: 'PUT',
      body: {
        accion: 'EDITAR',
        numeroDocumento: f.numeroDocumento.trim(),
        tipoDocumento: f.tipoDocumento,
        fecha: f.fecha,
        numeroCajasArea1: f.numeroCajasArea1 ? Number(f.numeroCajasArea1) : undefined,
        numeroCajasArea2: f.numeroCajasArea2 ? Number(f.numeroCajasArea2) : undefined,
        observaciones: f.observaciones.trim() || undefined,
        plines: [
          ...validIniciadora.map((p) => ({ area: props.integracion.areaIniciadora, plu: p.plu.trim(), descripcion: p.descripcion.trim() || undefined, unidades: p.unidades })),
          ...validContraria.map((p) => ({ area: areaContraria.value, plu: p.plu.trim(), descripcion: p.descripcion.trim() || undefined, unidades: p.unidades })),
        ],
      },
    })
    emit('saved')
  } catch (e: any) {
    error.value = apiErr(e, 'Error al guardar')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell :title="`Editar — ${integracion.tipoDocumento} ${integracion.numeroDocumento}`" sub="Edición completa (ADMIN/GERENTE)" wide @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <div class="g2">
        <label class="fw">
          <span class="fl">Tipo doc.</span>
          <select v-model="f.tipoDocumento" class="field"><option value="OVDM">OVDM</option><option value="TSDM">TSDM</option></select>
        </label>
        <label class="fw">
          <span class="fl">N° documento <b>*</b></span>
          <input v-model="f.numeroDocumento" class="field" :class="{ err: touched && !f.numeroDocumento.trim() }">
          <span v-if="touched && !f.numeroDocumento.trim()" class="fe">El número de documento es obligatorio</span>
        </label>
      </div>
      <div class="g3">
        <label class="fw"><span class="fl">Fecha</span><input v-model="f.fecha" type="date" class="field"></label>
        <label class="fw"><span class="fl">Cajas Área {{ integracion.areaIniciadora }}</span><input v-model="f.numeroCajasArea1" type="number" min="1" class="field" placeholder="Opcional"></label>
        <label class="fw"><span class="fl">Cajas Área {{ areaContraria }}</span><input v-model="f.numeroCajasArea2" type="number" min="1" class="field" placeholder="Opcional"></label>
      </div>

      <section class="fsec">
        <PluRows v-model="plinesIniciadora" :label="`PLUs — Área ${integracion.areaIniciadora} (iniciadora)`" />
      </section>
      <section class="fsec">
        <PluRows v-model="plinesContraria" :label="`PLUs — Área ${areaContraria}`" />
      </section>

      <label class="fw">
        <span class="fl">Observaciones</span>
        <textarea v-model="f.observaciones" rows="2" class="field" placeholder="Opcional" />
      </label>

      <span v-if="error" class="fe">{{ error }}</span>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving || (touched && missing)">
          <Spinner v-if="saving" />{{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.fsec { display: flex; flex-direction: column; gap: 11px; padding: 14px 14px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
.g2 { display: grid; grid-template-columns: 120px 1fr; gap: 11px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 11px; }
.fw { display: flex; flex-direction: column; gap: 5px; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.fl b { color: var(--u-critico); font-weight: 700; }
.fe { font-size: 11px; font-weight: 600; color: var(--u-critico); }
.field.err { border-color: var(--u-critico); box-shadow: 0 0 0 3px var(--u-critico-tint); }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
@media (max-width: 640px) { .g2, .g3 { grid-template-columns: 1fr; } }
</style>
