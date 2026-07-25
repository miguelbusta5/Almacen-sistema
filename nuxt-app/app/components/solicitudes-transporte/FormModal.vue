<script setup lang="ts">
// Formulario de creación / corrección. 5 secciones y campos condicionales.
//
// REGLA CRÍTICA: el payload se construye campo a campo y NUNCA incluye claves de
// gestión. La app Next hacía `{...emptyForm, ...initial}` y luego `{...form}`, así que
// al editar arrastraba `stellaEstado` y el servidor clasificaba el PATCH como
// "gestión" → 403 a cualquier no gestor que pulsara "Corregir", que es exactamente
// el flujo para el que existe el botón.
import { reactive, ref, computed, watch } from 'vue'
import {
  emptyPlu, GESTION_KEYS, hoyISO, type Catalogos, type PluRow, type Solicitud,
} from '~/utils/solicitudesTransporte'

const props = defineProps<{ catalogos: Catalogos | null; initial: Solicitud | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', data: Solicitud): void }>()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const i = props.initial
const form = reactive({
  fechaSolicitud: i?.fechaSolicitud ?? hoyISO(),
  areaSolicitante: i?.areaSolicitante ?? 'Despachos',
  areaOtro: i?.areaOtro ?? '',
  solicitanteNombre: i?.solicitanteNombre ?? '',
  solicitanteCorreo: i?.solicitanteCorreo ?? '',
  solicitanteTelefono: i?.solicitanteTelefono ?? '',
  tipoVenta: i?.tipoVenta ?? 'N/A',
  numeroPedido: i?.numeroPedido ?? '',
  facturaIntegracion: i?.facturaIntegracion ?? '',
  cobroFlete: Boolean(i?.cobroFlete),
  valorFlete: i?.valorFlete != null ? String(i.valorFlete) : '',
  cantidadCajas: String(i?.cantidadCajas ?? 1),
  volumenEstimado: i?.volumenEstimado ?? 'Mediano',
  tipoMercancia: i?.tipoMercancia ?? 'Mixto',
  ciudadOrigen: i?.ciudadOrigen ?? 'Bogota D.C.',
  zonaRecogida: i?.zonaRecogida ?? 'Urbana',
  direccionRecogida: i?.direccionRecogida ?? '',
  puntoRecogida: i?.puntoRecogida ?? '90 Cedi',
  puntoRecogidaOtro: i?.puntoRecogidaOtro ?? '',
  ciudadEntrega: i?.ciudadEntrega ?? 'Bogota D.C.',
  direccionEntrega: i?.direccionEntrega ?? '',
  zonaEntrega: i?.zonaEntrega ?? 'Urbana',
  fechaPromesaEntrega: i?.fechaPromesaEntrega ?? '',
  ventanaEntrega: i?.ventanaEntrega ?? 'Horario A.M',
  tipoServicio: i?.tipoServicio ?? 'Entrega directa',
  tipoServicioOtro: i?.tipoServicioOtro ?? '',
  restriccionHoraria: Boolean(i?.restriccionHoraria),
  descripcionRestriccion: i?.descripcionRestriccion ?? '',
  observacionesSolicitante: i?.observacionesSolicitante ?? '',
})
const plines = ref<PluRow[]>(
  i?.plines?.length ? i.plines.map((p) => ({ ...p, unidades: p.unidades || 1 })) : [emptyPlu()],
)

// Al ocultarse un condicional se limpia su valor: si no, al editar quedan restos de
// un "Otro" anterior y se envían al servidor.
watch(() => form.areaSolicitante, (v) => { if (v !== 'Otro') form.areaOtro = '' })
watch(() => form.puntoRecogida, (v) => { if (v !== 'Otros') form.puntoRecogidaOtro = '' })
watch(() => form.tipoServicio, (v) => { if (v !== 'Otro') form.tipoServicioOtro = '' })
watch(() => form.cobroFlete, (v) => { if (!v) form.valorFlete = '' })
watch(() => form.restriccionHoraria, (v) => { if (!v) form.descripcionRestriccion = '' })

const c = computed(() => props.catalogos)
const saving = ref(false)
const error = ref('')
const faltantes = ref<string[]>([])

function validar(): string[] {
  const f: string[] = []
  const req: Array<[unknown, string]> = [
    [form.fechaSolicitud, 'Fecha de solicitud'],
    [form.solicitanteNombre, 'Nombre del solicitante'],
    [form.solicitanteCorreo, 'Correo corporativo'],
    [form.solicitanteTelefono, 'Contacto'],
    [form.numeroPedido, 'Pedido / orden'],
    [form.direccionRecogida, 'Dirección de recogida'],
    [form.direccionEntrega, 'Dirección de entrega'],
    [form.fechaPromesaEntrega, 'Fecha promesa'],
    [form.observacionesSolicitante, 'Observaciones'],
  ]
  for (const [v, label] of req) if (!String(v ?? '').trim()) f.push(label)
  if (form.areaSolicitante === 'Otro' && !form.areaOtro.trim()) f.push('Otra área')
  if (form.puntoRecogida === 'Otros' && !form.puntoRecogidaOtro.trim()) f.push('Otro punto de recogida')
  if (form.tipoServicio === 'Otro' && !form.tipoServicioOtro.trim()) f.push('Otro tipo de servicio')
  if (form.restriccionHoraria && !form.descripcionRestriccion.trim()) f.push('Descripción de la restricción')
  if (form.cobroFlete && !String(form.valorFlete).trim()) f.push('Valor del flete')
  if (Number(form.cantidadCajas) < 1) f.push('Cantidad de cajas')
  if (!plines.value.length || plines.value.some((p) => !p.plu.trim() || !p.descripcion.trim())) {
    f.push('PLUs completos (código y descripción)')
  }
  if (form.direccionEntrega.trim().length > 0 && form.direccionEntrega.trim().length < 5) {
    f.push('Dirección de entrega (mínimo 5 caracteres)')
  }
  return f
}

function construirPayload() {
  const payload: Record<string, unknown> = {
    fechaSolicitud: form.fechaSolicitud,
    areaSolicitante: form.areaSolicitante,
    areaOtro: form.areaSolicitante === 'Otro' ? form.areaOtro.trim() : null,
    solicitanteNombre: form.solicitanteNombre.trim(),
    solicitanteCorreo: form.solicitanteCorreo.trim(),
    solicitanteTelefono: form.solicitanteTelefono.trim(),
    tipoVenta: form.tipoVenta,
    numeroPedido: form.numeroPedido.trim(),
    facturaIntegracion: form.facturaIntegracion.trim() || null,
    cobroFlete: form.cobroFlete,
    valorFlete: form.cobroFlete ? Number(form.valorFlete) : null,
    cantidadCajas: Number(form.cantidadCajas),
    unidades: Number(form.cantidadCajas),
    volumenEstimado: form.volumenEstimado,
    tipoMercancia: form.tipoMercancia,
    ciudadOrigen: form.ciudadOrigen,
    zonaRecogida: form.zonaRecogida,
    direccionRecogida: form.direccionRecogida.trim(),
    puntoRecogida: form.puntoRecogida,
    puntoRecogidaOtro: form.puntoRecogida === 'Otros' ? form.puntoRecogidaOtro.trim() : null,
    ciudadEntrega: form.ciudadEntrega,
    direccionEntrega: form.direccionEntrega.trim(),
    zonaEntrega: form.zonaEntrega,
    fechaPromesaEntrega: form.fechaPromesaEntrega,
    ventanaEntrega: form.ventanaEntrega,
    restriccionHoraria: form.restriccionHoraria,
    descripcionRestriccion: form.restriccionHoraria ? form.descripcionRestriccion.trim() : null,
    tipoServicio: form.tipoServicio,
    tipoServicioOtro: form.tipoServicio === 'Otro' ? form.tipoServicioOtro.trim() : null,
    observacionesSolicitante: form.observacionesSolicitante.trim(),
    plines: plines.value.map((p) => ({
      plu: p.plu.trim(),
      descripcion: p.descripcion.trim(),
      unidades: Number(p.unidades),
    })),
  }
  // Red de seguridad del bug que corregimos: si alguna clave de gestión se colara,
  // el servidor devolvería 403 a los no gestores.
  for (const k of GESTION_KEYS) delete payload[k]
  return payload
}

async function submit() {
  const f = validar()
  if (f.length) { faltantes.value = f; return }
  saving.value = true
  error.value = ''
  try {
    const url = props.initial
      ? `/api/solicitudes-transporte/${props.initial.id}`
      : '/api/solicitudes-transporte'
    const res = await $fetch<{ data: Solicitud }>(url, {
      method: props.initial ? 'PATCH' : 'POST',
      body: construirPayload(),
    })
    emit('saved', res.data)
  } catch (e) {
    error.value = apiErr(e, 'No se pudo guardar la solicitud')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell
    :title="initial ? 'Editar solicitud' : 'Nueva solicitud de transporte'"
    :sub="initial ? (initial.numeroPedido || 'Corrige y reenvía') : 'Todos los campos visibles son obligatorios'"
    wide @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <h4>Información general</h4>
      <div class="grid">
        <label class="f"><span class="lbl">Fecha de solicitud</span>
          <input v-model="form.fechaSolicitud" class="field" type="date"></label>
        <label class="f"><span class="lbl">Área solicitante</span>
          <select v-model="form.areaSolicitante" class="field">
            <option v-for="a in c?.areas ?? [form.areaSolicitante]" :key="a" :value="a">{{ a }}</option>
          </select></label>
        <label v-if="form.areaSolicitante === 'Otro'" class="f"><span class="lbl">Otra área</span>
          <input v-model="form.areaOtro" class="field"></label>
        <label class="f"><span class="lbl">Nombre del solicitante</span>
          <input v-model="form.solicitanteNombre" class="field"></label>
        <label class="f"><span class="lbl">Correo corporativo</span>
          <input v-model="form.solicitanteCorreo" class="field" type="email"></label>
        <label class="f"><span class="lbl">Contacto</span>
          <input v-model="form.solicitanteTelefono" class="field" inputmode="tel"></label>
      </div>

      <h4>Pedido y mercancía</h4>
      <div class="grid">
        <label class="f"><span class="lbl">Tipo de venta</span>
          <select v-model="form.tipoVenta" class="field">
            <option v-for="t in c?.tiposVenta ?? [form.tipoVenta]" :key="t" :value="t">{{ t }}</option>
          </select></label>
        <label class="f"><span class="lbl">Pedido / orden</span>
          <input v-model="form.numeroPedido" class="field"></label>
        <label class="f"><span class="lbl">Factura integración</span>
          <input v-model="form.facturaIntegracion" class="field" placeholder="Opcional"></label>
        <label class="f"><span class="lbl">Cantidad de cajas</span>
          <input v-model="form.cantidadCajas" class="field tnum" type="number" min="1"></label>
        <label class="f"><span class="lbl">Volumen</span>
          <select v-model="form.volumenEstimado" class="field">
            <option v-for="v in c?.volumenes ?? [form.volumenEstimado]" :key="v" :value="v">{{ v }}</option>
          </select></label>
        <label class="f"><span class="lbl">Tipo de mercancía</span>
          <select v-model="form.tipoMercancia" class="field">
            <option v-for="t in c?.tiposMercancia ?? [form.tipoMercancia]" :key="t" :value="t">{{ t }}</option>
          </select></label>
        <label class="f"><span class="lbl">¿Se cobró flete?</span>
          <select v-model="form.cobroFlete" class="field">
            <option :value="false">No</option><option :value="true">Sí</option>
          </select></label>
        <label v-if="form.cobroFlete" class="f"><span class="lbl">Valor del flete</span>
          <input v-model="form.valorFlete" class="field tnum" type="number" min="0"></label>
      </div>

      <SolicitudesTransportePluEditor v-model="plines" />

      <h4>Origen y destino</h4>
      <div class="grid">
        <label class="f"><span class="lbl">Ciudad origen</span>
          <select v-model="form.ciudadOrigen" class="field">
            <option v-for="x in c?.ciudades ?? [form.ciudadOrigen]" :key="x" :value="x">{{ x }}</option>
          </select></label>
        <label class="f"><span class="lbl">Zona de recogida</span>
          <select v-model="form.zonaRecogida" class="field">
            <option v-for="x in c?.zonas ?? [form.zonaRecogida]" :key="x" :value="x">{{ x }}</option>
          </select></label>
        <label class="f"><span class="lbl">Dirección de recogida</span>
          <input v-model="form.direccionRecogida" class="field"></label>
        <label class="f"><span class="lbl">Punto de recogida</span>
          <select v-model="form.puntoRecogida" class="field">
            <option v-for="x in c?.puntosRecogida ?? [form.puntoRecogida]" :key="x" :value="x">{{ x }}</option>
          </select></label>
        <label v-if="form.puntoRecogida === 'Otros'" class="f"><span class="lbl">Otro punto</span>
          <input v-model="form.puntoRecogidaOtro" class="field"></label>
        <label class="f"><span class="lbl">Ciudad de entrega</span>
          <select v-model="form.ciudadEntrega" class="field">
            <option v-for="x in c?.ciudades ?? [form.ciudadEntrega]" :key="x" :value="x">{{ x }}</option>
          </select></label>
        <label class="f"><span class="lbl">Dirección de entrega</span>
          <input v-model="form.direccionEntrega" class="field"></label>
        <label class="f"><span class="lbl">Zona de entrega</span>
          <select v-model="form.zonaEntrega" class="field">
            <option v-for="x in c?.zonas ?? [form.zonaEntrega]" :key="x" :value="x">{{ x }}</option>
          </select></label>
      </div>

      <h4>Programación y servicio</h4>
      <div class="grid">
        <label class="f"><span class="lbl">Fecha promesa</span>
          <input v-model="form.fechaPromesaEntrega" class="field" type="date"></label>
        <label class="f"><span class="lbl">Ventana de entrega</span>
          <select v-model="form.ventanaEntrega" class="field">
            <option v-for="x in c?.ventanasEntrega ?? [form.ventanaEntrega]" :key="x" :value="x">{{ x }}</option>
          </select></label>
        <label class="f"><span class="lbl">Tipo de servicio</span>
          <select v-model="form.tipoServicio" class="field">
            <option v-for="x in c?.tiposServicio ?? [form.tipoServicio]" :key="x" :value="x">{{ x }}</option>
          </select></label>
        <label v-if="form.tipoServicio === 'Otro'" class="f"><span class="lbl">Otro servicio</span>
          <input v-model="form.tipoServicioOtro" class="field"></label>
        <label class="f"><span class="lbl">¿Restricción horaria?</span>
          <select v-model="form.restriccionHoraria" class="field">
            <option :value="false">No</option><option :value="true">Sí</option>
          </select></label>
      </div>
      <label v-if="form.restriccionHoraria" class="f"><span class="lbl">Describe la restricción</span>
        <textarea v-model="form.descripcionRestriccion" class="field" rows="2" /></label>
      <label class="f"><span class="lbl">Observaciones</span>
        <textarea v-model="form.observacionesSolicitante" class="field" rows="3" /></label>

      <!-- Los campos faltantes van INLINE, no en un AlertModal anidado: dos
           ModalShell a la vez registran cada uno su handler de Escape en window, así
           que una sola pulsación cerraría el aviso Y el formulario, perdiendo la
           solicitud entera que el usuario estaba redactando. -->
      <div v-if="faltantes.length" class="faltan">
        <b>Faltan campos obligatorios</b>
        <ul><li v-for="f in faltantes" :key="f">{{ f }}</li></ul>
      </div>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="acc">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving">
          <Spinner v-if="saving" :size="14" />
          {{ saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear solicitud' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 13px; }
h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--modulo, var(--info)); margin: 6px 0 0; padding-top: 10px; border-top: 1px solid var(--border); }
h4:first-child { margin-top: 0; padding-top: 0; border-top: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 11px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.faltan { font-size: 12.5px; color: var(--ink-2); background: var(--u-aviso-tint); border-radius: var(--r-sm); padding: 10px 13px; }
.faltan b { display: block; color: var(--u-aviso); margin-bottom: 4px; }
.faltan ul { margin: 0; padding-left: 18px; }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acc { display: flex; justify-content: flex-end; gap: 9px; position: sticky; bottom: -22px; background: var(--surface); padding: 12px 0 2px; margin-top: 4px; }
@media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .form :deep(.field) { height: 46px; font-size: 16px; } .form :deep(textarea.field) { height: auto; } }
</style>
