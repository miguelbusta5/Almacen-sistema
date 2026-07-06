<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Trash2, MapPin } from '@lucide/vue'
import type { PedidoGourmet } from '~/utils/gourmet'

interface EstibaForm { ubicacion: string; cantidadCajas: string; observacion: string }

const props = defineProps<{ p: PedidoGourmet; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', payload: Record<string, unknown>): void }>()

// Un pedido tiene "escaneo inicial" (G2+) cuando al menos una de sus cajas ya
// quedó vinculada a una estiba desde la creación — el conteo por estiba es
// un hecho real y ya no se debe volver a pedir.
const simplificado = computed(() => (props.p.estibas?.length ?? 0) > 0 && (props.p.cajas ?? []).some((c) => c.estibaId != null))

// ── Simplificado: solo ubicación por estiba, conteo real de cajas ya escaneadas ──
interface FilaSimplificada { secuencia: number; cantidadCajas: number; ubicacion: string; observacion: string }
const filasSimplificadas = ref<FilaSimplificada[]>(
  [...(props.p.estibas ?? [])].sort((a, b) => a.secuencia - b.secuencia).map((e) => ({
    secuencia: e.secuencia,
    cantidadCajas: (props.p.cajas ?? []).filter((c) => c.estibaId === e.id).length,
    ubicacion: e.ubicacion ?? '',
    observacion: e.observacion ?? '',
  }))
)

// ── Clásico (legacy): estibas con cantidad + ubicación libres ──
const CAJAS_TAG_RE = /^\[cajas:(\d+)\]\s*(?:·\s*(.*))?$/
function decodeObs(raw: string | null): { cantidadCajas: number | null; observacion: string } {
  if (!raw) return { cantidadCajas: null, observacion: '' }
  const m = raw.match(CAJAS_TAG_RE)
  if (!m) return { cantidadCajas: null, observacion: raw }
  return { cantidadCajas: parseInt(m[1]!, 10), observacion: m[2] ?? '' }
}
const estibasClasico = ref<EstibaForm[]>(
  (props.p.estibas?.length ?? 0) === 0
    ? [{ ubicacion: '', cantidadCajas: '', observacion: '' }]
    : [...(props.p.estibas ?? [])].sort((a, b) => a.secuencia - b.secuencia).map((e) => {
        const { cantidadCajas, observacion } = decodeObs(e.observacion)
        return { ubicacion: e.ubicacion ?? '', cantidadCajas: cantidadCajas != null ? String(cantidadCajas) : '', observacion }
      })
)
function addEstiba() { estibasClasico.value.push({ ubicacion: '', cantidadCajas: '', observacion: '' }) }
function removeEstiba(i: number) { estibasClasico.value.splice(i, 1) }
const totalClasico = computed(() => estibasClasico.value.reduce((s, e) => s + (parseInt(e.cantidadCajas, 10) || 0), 0))

const error = ref('')

function submit() {
  error.value = ''
  if (simplificado.value) {
    for (const row of filasSimplificadas.value) {
      if (!row.ubicacion.trim()) { error.value = `Estiba ${row.secuencia}: indica la ubicación`; return }
    }
    emit('saved', {
      estibas: filasSimplificadas.value.map((row) => ({ secuencia: row.secuencia, ubicacion: row.ubicacion.trim(), observacion: row.observacion.trim() || undefined })),
      updatedAt: props.p.updatedAt,
    })
    return
  }

  if (estibasClasico.value.length === 0) { error.value = 'Agrega al menos una estiba'; return }
  const estibasParsed: { secuencia: number; ubicacion: string; observacion?: string }[] = []
  for (let i = 0; i < estibasClasico.value.length; i++) {
    const row = estibasClasico.value[i]!
    if (!row.ubicacion.trim()) { error.value = `Estiba ${i + 1}: indica la ubicación`; return }
    const cantidad = parseInt(row.cantidadCajas, 10)
    if (!Number.isInteger(cantidad) || cantidad <= 0) { error.value = `Estiba ${i + 1}: indica la cantidad de cajas (mayor a 0)`; return }
    const obs = row.observacion.trim()
    estibasParsed.push({ secuencia: i + 1, ubicacion: row.ubicacion.trim(), observacion: obs ? `[cajas:${cantidad}] · ${obs}` : `[cajas:${cantidad}]` })
  }
  if (totalClasico.value !== props.p.cajasEsperadas) {
    error.value = `La suma de cajas por estiba (${totalClasico.value}) no coincide con las cajas esperadas del pedido (${props.p.cajasEsperadas})`
    return
  }
  emit('saved', { estibas: estibasParsed, updatedAt: props.p.updatedAt })
}
</script>

<template>
  <ModalShell
    title="Asignar ubicación"
    :sub="simplificado ? 'Las cajas ya fueron escaneadas al crear el pedido' : 'Una ubicación y cantidad de cajas por cada estiba'"
    wide @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><MapPin :size="13" /></span> Ubicación por estiba</div>
        <template v-if="simplificado">
          <div class="rows">
            <div v-for="row in filasSimplificadas" :key="row.secuencia" class="row">
              <div class="row-top">
                <span class="row-title">Estiba {{ row.secuencia }}</span>
                <span class="mono faint">{{ row.cantidadCajas }} caja{{ row.cantidadCajas !== 1 ? 's' : '' }} escaneada{{ row.cantidadCajas !== 1 ? 's' : '' }}</span>
              </div>
              <input v-model="row.ubicacion" class="field" placeholder="Ubicación (ej. Pasillo B - Nivel 2)">
              <input v-model="row.observacion" class="field small" placeholder="Observación (opcional)">
            </div>
          </div>
        </template>

        <template v-else>
          <div class="rows-head">
            <span class="fl">Estibas</span>
            <button type="button" class="btn-link" @click="addEstiba"><Plus :size="12" /> Añadir estiba</button>
          </div>
          <div class="rows">
            <div v-for="(row, i) in estibasClasico" :key="i" class="row">
              <div class="row-top">
                <span class="row-title">Estiba {{ i + 1 }}</span>
                <button type="button" class="chip-x" @click="removeEstiba(i)"><Trash2 :size="12" /></button>
              </div>
              <div class="g2">
                <input v-model="row.ubicacion" class="field" placeholder="Ubicación (ej. Pasillo B - Nivel 2)">
                <input v-model="row.cantidadCajas" type="number" min="1" class="field" placeholder="Cajas">
              </div>
              <input v-model="row.observacion" class="field small" placeholder="Observación (opcional)">
            </div>
          </div>
          <div class="total-resumen" :class="{ ok: totalClasico === p.cajasEsperadas }">
            Total asignado: {{ totalClasico }} cajas / {{ p.cajasEsperadas }} esperadas
          </div>
        </template>
      </section>

      <p v-if="error" class="err-msg">{{ error }}</p>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          <Spinner v-if="saving" />{{ saving ? 'Guardando…' : 'Guardar ubicación' }}
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
.fl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.rows-head { display: flex; align-items: center; justify-content: space-between; }
.btn-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; background: none; border: none; color: var(--brand); cursor: pointer; padding: 0; }
.rows { display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface-2); }
.row-top { display: flex; align-items: center; justify-content: space-between; }
.row-title { font-size: 12px; font-weight: 700; color: var(--ink); }
.faint { color: var(--faint); }
.field.small { font-size: 12px; height: 32px; }
.g2 { display: grid; grid-template-columns: 2fr 1fr; gap: 8px; }
.chip-x { width: 24px; height: 24px; border-radius: 6px; border: none; background: var(--u-critico-tint); color: var(--u-critico); cursor: pointer; display: grid; place-items: center; }
.total-resumen { font-size: 12px; font-weight: 600; color: var(--u-critico); }
.total-resumen.ok { color: var(--u-ok); }
.err-msg { font-size: 12px; color: var(--u-critico); margin: 0; }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
</style>
