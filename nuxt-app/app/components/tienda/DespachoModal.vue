<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { Store, MapPin, User, Package, Plus, Trash2, Search, Info } from '@lucide/vue'
import { todayISO, CIUDAD_OPTIONS, type Despacho } from '~/utils/despacho'

const props = defineProps<{ despacho?: Despacho | null; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', payload: Record<string, unknown>): void }>()

const isEdit = computed(() => !!props.despacho)
const f = reactive({
  centroCostos: props.despacho?.centroCostos ?? '',
  numeroDocumento: props.despacho?.numeroDocumento ?? '',
  consecutivo: props.despacho?.consecutivo ?? '1',
  clienteNombre: props.despacho?.clienteNombre ?? '',
  clienteDocumento: props.despacho?.clienteDocumento ?? '',
  clienteTelefono: props.despacho?.clienteTelefono ?? '',
  fechaEntregaComprometida: props.despacho?.fechaEntregaComprometida ?? '',
  numeroCajas: props.despacho?.numeroCajas ?? 1,
  ciudad: props.despacho?.ciudad ?? '',
  direccionEntrega: props.despacho?.direccionEntrega ?? '',
  contactoEntrega: props.despacho?.contactoEntrega ?? '',
  telefonoEntrega: props.despacho?.telefonoEntrega ?? '',
  notaEntrega: props.despacho?.notaEntrega ?? '',
})
const touched = ref(false)
const missing = computed(() => !f.centroCostos.trim() || !f.numeroDocumento.trim() || !f.consecutivo.trim() || !f.clienteNombre.trim())

interface PlinDraft { plu: string; descripcion: string; unidades: string; looked: boolean; looking: boolean; notFound: boolean }
const plines = ref<PlinDraft[]>(isEdit.value ? [] : [{ plu: '', descripcion: '', unidades: '1', looked: false, looking: false, notFound: false }])
function addPlin() { plines.value.push({ plu: '', descripcion: '', unidades: '1', looked: false, looking: false, notFound: false }) }
function removePlin(i: number) { plines.value.splice(i, 1) }
async function lookupPlin(i: number) {
  const row = plines.value[i]
  if (!row) return
  const plu = row.plu.trim()
  if (!plu) return
  row.looking = true
  row.notFound = false
  try {
    const res = await $fetch<{ data: { descripcion: string | null } }>(`/api/productos-maestro/${encodeURIComponent(plu)}`)
    row.descripcion = res.data.descripcion ?? row.descripcion
    row.looked = true
  } catch {
    row.looked = false
    row.notFound = true
  } finally {
    row.looking = false
  }
}

function submit() {
  if (props.saving) return
  touched.value = true
  if (missing.value) return
  const payload: Record<string, unknown> = { ...f }
  if (!payload.fechaEntregaComprometida) payload.fechaEntregaComprometida = null
  if (!payload.clienteDocumento) payload.clienteDocumento = null
  if (!payload.clienteTelefono) payload.clienteTelefono = null
  if (!payload.ciudad) payload.ciudad = null
  if (!payload.direccionEntrega) payload.direccionEntrega = null
  if (!payload.contactoEntrega) payload.contactoEntrega = null
  if (!payload.telefonoEntrega) payload.telefonoEntrega = null
  if (!payload.notaEntrega) payload.notaEntrega = null
  if (!isEdit.value) {
    payload.fechaCreacion = todayISO()
    payload.plines = plines.value
      .filter((p) => p.plu.trim())
      .map((p) => ({ plu: p.plu.trim(), descripcion: p.descripcion.trim() || null, unidades: Math.max(1, parseInt(p.unidades) || 1) }))
  }
  emit('saved', payload)
}
</script>

<template>
  <ModalShell
    :title="isEdit ? 'Editar factura' : 'Nueva factura contado'"
    :sub="isEdit ? `${despacho!.numeroDocumento} · ${despacho!.clienteNombre}` : 'Registra una factura para recogida en tienda'"
    wide @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><Store :size="13" /></span> Datos de la factura</div>
        <div class="g2">
          <label class="fw">
            <span class="fl">Centro de costos <b>*</b></span>
            <input v-model="f.centroCostos" class="field" :class="{ err: touched && !f.centroCostos.trim() }">
            <span v-if="touched && !f.centroCostos.trim()" class="fe">El centro de costos es obligatorio</span>
          </label>
          <label class="fw">
            <span class="fl">N° Documento <b>*</b></span>
            <input v-model="f.numeroDocumento" class="field" :class="{ err: touched && !f.numeroDocumento.trim() }">
            <span v-if="touched && !f.numeroDocumento.trim()" class="fe">El número de documento es obligatorio</span>
          </label>
        </div>
        <div class="g2">
          <label class="fw">
            <span class="fl">Consecutivo <b>*</b></span>
            <input v-model="f.consecutivo" class="field" :class="{ err: touched && !f.consecutivo.trim() }">
            <span v-if="touched && !f.consecutivo.trim()" class="fe">El consecutivo es obligatorio</span>
          </label>
          <label class="fw">
            <span class="fl">N° de cajas</span>
            <input v-model.number="f.numeroCajas" type="number" min="1" class="field">
          </label>
        </div>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><User :size="13" /></span> Cliente</div>
        <label class="fw">
          <span class="fl">Nombre <b>*</b></span>
          <input v-model="f.clienteNombre" class="field" :class="{ err: touched && !f.clienteNombre.trim() }">
          <span v-if="touched && !f.clienteNombre.trim()" class="fe">El nombre del cliente es obligatorio</span>
        </label>
        <div class="g2">
          <label class="fw"><span class="fl">Documento</span><input v-model="f.clienteDocumento" class="field"></label>
          <label class="fw"><span class="fl">Teléfono</span><input v-model="f.clienteTelefono" class="field"></label>
        </div>
      </section>

      <section class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><MapPin :size="13" /></span> Entrega</div>
        <div class="g2">
          <label class="fw">
            <span class="fl">Ciudad destino</span>
            <select v-model="f.ciudad" class="field"><option value="">— Sin asignar —</option><option v-for="c in CIUDAD_OPTIONS" :key="c" :value="c">{{ c }}</option></select>
          </label>
          <label class="fw"><span class="fl">Fecha entrega comprometida</span><input v-model="f.fechaEntregaComprometida" type="date" class="field"></label>
        </div>
        <label class="fw"><span class="fl">Dirección de entrega</span><input v-model="f.direccionEntrega" class="field"></label>
        <div class="g2">
          <label class="fw"><span class="fl">Contacto en destino</span><input v-model="f.contactoEntrega" class="field"></label>
          <label class="fw"><span class="fl">Teléfono contacto</span><input v-model="f.telefonoEntrega" class="field"></label>
        </div>
        <label class="fw"><span class="fl">Nota</span><textarea v-model="f.notaEntrega" rows="2" class="field" /></label>
      </section>

      <section v-if="!isEdit" class="fsec">
        <div class="fsec-title"><span class="fsec-ic"><Package :size="13" /></span> Productos (opcional)</div>
        <div v-for="(p, i) in plines" :key="i">
          <div class="plin-row">
            <input v-model="p.plu" class="field plu" placeholder="PLU" @blur="lookupPlin(i)">
            <input v-model="p.descripcion" class="field desc" placeholder="Descripción" :class="{ looked: p.looked, err: p.notFound }">
            <input v-model="p.unidades" type="number" min="1" class="field uni" placeholder="Uds.">
            <button type="button" class="btn-icon" :disabled="p.looking" @click="lookupPlin(i)">
              <Spinner v-if="p.looking" /><Search v-else :size="14" />
            </button>
            <button type="button" class="btn-icon danger" @click="removePlin(i)"><Trash2 :size="14" /></button>
          </div>
          <span v-if="p.notFound" class="fe plu-fe">PLU no encontrado en el maestro — puedes escribir la descripción manualmente</span>
        </div>
        <button type="button" class="btn btn-sm add-plin" @click="addPlin"><Plus :size="14" /> Agregar producto</button>
        <div class="hint"><Info :size="12" /> Al escribir un PLU y salir del campo, la descripción se autocompleta desde el maestro de productos.</div>
      </section>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving || (touched && missing)">
          <Spinner v-if="saving" />
          {{ saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Registrar factura') }}
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
.field.looked { border-color: var(--u-ok); }
.plin-row { display: grid; grid-template-columns: 90px 1fr 70px auto auto; gap: 8px; align-items: center; }
.plu-fe { display: block; margin: 4px 0 0; }
.hint { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); margin-top: 2px; }
.btn-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; }
.btn-icon:hover { background: var(--surface-3); color: var(--ink); }
.btn-icon:disabled { opacity: .6; cursor: default; }
.btn-icon.danger:hover { color: var(--u-critico); border-color: var(--u-critico); }
.add-plin { align-self: flex-start; }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
@media (max-width: 560px) { .g2 { grid-template-columns: 1fr; } .plin-row { grid-template-columns: 1fr; } }
</style>
