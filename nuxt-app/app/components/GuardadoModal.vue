<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { Package, MapPin, FileText, Info } from '@lucide/vue'
import { todayISO, type Guardado } from '~/utils/guardado'

const props = defineProps<{ guardado?: Guardado | null; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', g: Partial<Guardado>): void }>()

const isEdit = computed(() => !!props.guardado)
const f = reactive({
  fecha: props.guardado?.fecha ?? todayISO(),
  documento: props.guardado?.documento ?? '',
  ubicacion: props.guardado?.ubicacion ?? '',
  tipo: props.guardado?.tipo ?? 'COMUN',
  estado: props.guardado?.estado ?? 'PENDIENTE DESPACHO',
  fechaDespacho: props.guardado?.fechaDespacho ?? '',
  ciudad: props.guardado?.ciudad ?? '',
  nota: props.guardado?.nota ?? '',
})
const touched = ref(false)
const missing = computed(() => !f.fecha || !f.documento.trim() || !f.ubicacion.trim())

const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Pereira', 'Bucaramanga', 'Cartagena']

function submit() {
  if (props.saving) return
  touched.value = true
  if (missing.value) return
  emit('saved', { ...f } as Partial<Guardado>)
}
</script>

<template>
  <ModalShell
    :title="isEdit ? 'Editar guardado' : 'Nuevo guardado'"
    :sub="isEdit ? `${guardado!.documento} · ${guardado!.ubicacion}` : 'Registra mercancía en custodia de bodega'"
    wide @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><Package :size="13" /></span> Información del guardado</div>
        <div class="g2">
          <label class="fw">
            <span class="fl">Fecha de ingreso <b>*</b></span>
            <input v-model="f.fecha" type="date" class="field" :class="{ err: touched && !f.fecha }">
          </label>
          <label class="fw">
            <span class="fl">Tipo</span>
            <select v-model="f.tipo" class="field"><option value="COMUN">Común</option><option value="ECOMMERCE">Ecommerce</option></select>
          </label>
        </div>
        <label class="fw">
          <span class="fl">N° Documento <b>*</b></span>
          <input v-model="f.documento" class="field" :class="{ err: touched && !f.documento.trim() }" placeholder="Factura / remisión">
          <span v-if="touched && !f.documento.trim()" class="fe">El documento es obligatorio</span>
        </label>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><MapPin :size="13" /></span> Ubicación y destino</div>
        <label class="fw">
          <span class="fl">Ubicación en bodega <b>*</b></span>
          <input v-model="f.ubicacion" class="field" :class="{ err: touched && !f.ubicacion.trim() }" placeholder="Pasillo, estante, nivel…">
        </label>
        <div class="g2">
          <label class="fw">
            <span class="fl">Ciudad destino</span>
            <select v-model="f.ciudad" class="field"><option value="">— Sin asignar —</option><option v-for="c in CIUDADES" :key="c" :value="c">{{ c }}</option></select>
          </label>
          <label class="fw">
            <span class="fl">Estado</span>
            <select v-model="f.estado" class="field"><option value="PENDIENTE DESPACHO">Pendiente despacho</option><option value="DESPACHADO">Despachado</option></select>
          </label>
        </div>
        <label v-if="f.estado === 'DESPACHADO'" class="fw">
          <span class="fl">Fecha despacho</span>
          <input v-model="f.fechaDespacho" type="date" class="field">
        </label>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><FileText :size="13" /></span> Nota</div>
        <textarea v-model="f.nota" rows="2" class="field" placeholder="Incluye la fecha de entrega, ej. 15/06/2026" />
        <div class="hint"><Info :size="12" /> Si la nota incluye una fecha DD/MM/AAAA, se usará como entrega comprometida.</div>
      </section>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving || (touched && missing)">
          <Spinner v-if="saving" />
          {{ saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Registrar guardado') }}
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
.hint { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
@media (max-width: 560px) { .g2 { grid-template-columns: 1fr; } }
</style>
