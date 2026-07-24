<script setup lang="ts">
import { ref, computed } from 'vue'
import { areaContraria as areaContrariaOf, areaFromRole, emptyPlu, type Integracion, type PluRow } from '~/utils/integracion'

const props = defineProps<{ integracion: Integracion; role: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'completed'): void }>()

const areaContraria = computed(() => areaContrariaOf(props.integracion.areaIniciadora))
const actorArea = areaFromRole(props.role)
const areaUsada = computed(() => actorArea ?? areaContraria.value)
const plines1 = computed(() => props.integracion.plines.filter((p) => p.area === props.integracion.areaIniciadora))

const numeroCajas = ref('')
const plines = ref<PluRow[]>([emptyPlu()])
const observaciones = ref(props.integracion.observaciones ?? '')
const saving = ref(false)
const error = ref('')

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

async function submit() {
  error.value = ''
  const validPlines = plines.value.filter((p) => p.plu.trim())
  if (validPlines.length === 0) { error.value = 'Agrega al menos un PLU'; return }

  saving.value = true
  try {
    await $fetch(`/api/integracion/${props.integracion.id}` as string, {
      method: 'PUT',
      body: {
        accion: 'COMPLETAR_AREA2',
        numeroCajasArea2: numeroCajas.value ? Number(numeroCajas.value) : undefined,
        plines: validPlines.map((p) => ({ plu: p.plu.trim(), descripcion: p.descripcion.trim() || undefined, unidades: p.unidades })),
        observaciones: observaciones.value.trim() || undefined,
      },
    })
    emit('completed')
  } catch (e: any) {
    error.value = apiErr(e, 'Error al completar')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell
    :title="`Completar — ${integracion.tipoDocumento} ${integracion.numeroDocumento}`"
    :sub="`Área ${integracion.areaIniciadora} ya registró su picking. Ahora completa el área ${areaUsada}.`"
    wide @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <section class="fsec ref-sec">
        <div class="fsec-title">PLUs Área {{ integracion.areaIniciadora }} (referencia)</div>
        <table class="ref-table">
          <thead><tr><th>PLU</th><th>Descripción</th><th>Uds</th></tr></thead>
          <tbody>
            <tr v-for="p in plines1" :key="p.id">
              <td class="mono">{{ p.plu }}</td>
              <td class="muted">{{ p.descripcion ?? '—' }}</td>
              <td>{{ p.unidades }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="integracion.numeroCajasArea1" class="ref-cajas">Cajas Área 1: <strong>{{ integracion.numeroCajasArea1 }}</strong></p>
      </section>

      <label class="fw">
        <span class="fl">N° cajas — Área {{ areaUsada }}</span>
        <input v-model="numeroCajas" type="number" min="1" class="field" placeholder="Opcional">
      </label>

      <section class="fsec">
        <div class="fsec-title">PLUs — Área {{ areaUsada }}</div>
        <PluRows v-model="plines" label="" />
        <span v-if="error" class="fe">{{ error }}</span>
      </section>

      <label class="fw">
        <span class="fl">Observaciones</span>
        <textarea v-model="observaciones" rows="2" class="field" placeholder="Opcional" />
      </label>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          <Spinner v-if="saving" />{{ saving ? 'Guardando…' : 'Completar picking Área 2' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.fsec { display: flex; flex-direction: column; gap: 11px; padding: 14px 14px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
.fsec-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
.ref-sec { background: var(--surface-2); }
.ref-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ref-table th { text-align: left; padding: 4px 8px; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--border); }
.ref-table td { padding: 4px 8px; }
.ref-table .mono { font-family: var(--mono); }
.ref-table .muted { color: var(--muted); }
.ref-cajas { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
.fw { display: flex; flex-direction: column; gap: 5px; }
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.fe { font-size: 11px; font-weight: 600; color: var(--u-critico); }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
</style>
