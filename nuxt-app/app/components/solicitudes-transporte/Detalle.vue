<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, Pencil, Trash2, Send, TriangleAlert } from '@lucide/vue'
import {
  ESTADO_LABEL, ESTADO_TONE, fmtCOP, fmtFechaSol, PRIORIDAD_LABEL, PRIORIDAD_TONE,
  SEMAFORO_LABEL, SEMAFORO_TONE, type HistorialItem, type Solicitud,
} from '~/utils/solicitudesTransporte'

const props = defineProps<{
  item: Solicitud
  historial: HistorialItem[]
  isGestor: boolean
  canEdit: boolean
  canDelete: boolean
  canReenviar: boolean
  error: string
  busy: boolean
}>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'editar'): void
  (e: 'borrar'): void
  (e: 'reenviar'): void
}>()

// Resuelven los "Otro/Otros" para no mostrar la etiqueta genérica.
const area = computed(() => (props.item.areaSolicitante === 'Otro' ? props.item.areaOtro : props.item.areaSolicitante))
const punto = computed(() => (props.item.puntoRecogida === 'Otros' ? props.item.puntoRecogidaOtro : props.item.puntoRecogida))
const servicio = computed(() => (props.item.tipoServicio === 'Otro' ? props.item.tipoServicioOtro : props.item.tipoServicio))
const flete = computed(() => (props.item.cobroFlete ? `Sí · ${fmtCOP(props.item.valorFlete)}` : 'No'))
const totalUnidades = computed(() => props.item.plines.reduce((s, p) => s + (p.unidades || 0), 0))

// `—` para cualquier nulo: nunca se muestra "null" ni una celda vacía.
type Campo = [string, string]
const txt = (v: unknown): string =>
  v === null || v === undefined || v === '' ? '—' : String(v)

const general = computed<Campo[]>(() => [
  ['Fecha de solicitud', fmtFechaSol(props.item.fechaSolicitud)],
  ['Área', txt(area.value)],
  ['Solicitante', txt(props.item.solicitanteNombre)],
  ['Correo', txt(props.item.solicitanteCorreo)],
  ['Contacto', txt(props.item.solicitanteTelefono)],
])
const pedido = computed<Campo[]>(() => [
  ['Tipo de venta', txt(props.item.tipoVenta)],
  ['Pedido / orden', txt(props.item.numeroPedido)],
  ['Factura integración', txt(props.item.facturaIntegracion)],
  ['Cantidad de cajas', txt(props.item.cantidadCajas)],
  ['Volumen', txt(props.item.volumenEstimado)],
  ['Tipo de mercancía', txt(props.item.tipoMercancia)],
  ['Flete', flete.value],
])
const ruta = computed<Campo[]>(() => [
  ['Ciudad origen', txt(props.item.ciudadOrigen)],
  ['Zona recogida', txt(props.item.zonaRecogida)],
  ['Dirección recogida', txt(props.item.direccionRecogida)],
  ['Punto de recogida', txt(punto.value)],
  ['Ciudad entrega', txt(props.item.ciudadEntrega)],
  ['Dirección entrega', txt(props.item.direccionEntrega)],
  ['Zona entrega', txt(props.item.zonaEntrega)],
])
const programacion = computed<Campo[]>(() => [
  ['Fecha promesa', fmtFechaSol(props.item.fechaPromesaEntrega)],
  ['Ventana', txt(props.item.ventanaEntrega)],
  ['Restricción horaria', props.item.restriccionHoraria ? txt(props.item.descripcionRestriccion) : 'No'],
  ['Tipo de servicio', txt(servicio.value)],
])
</script>

<template>
  <div class="detalle">
    <!-- Deshabilitado mientras hay una escritura en vuelo, como el resto de acciones:
         volver a media operación dejaba la respuesta llegando a un detalle cerrado. -->
    <button class="btn btn-ghost btn-sm volver" :disabled="busy" @click="emit('back')">
      <ArrowLeft :size="14" /> Volver al listado
    </button>

    <header class="card cab">
      <div class="cab-txt">
        <h2>{{ item.numeroPedido || 'Solicitud de transporte' }}</h2>
        <p class="ruta-sub">{{ item.ciudadOrigen }} → {{ item.ciudadEntrega }}</p>
        <div class="badges">
          <Badge :label="ESTADO_LABEL[item.estado]" :tone="ESTADO_TONE[item.estado]" solid />
          <Badge :label="SEMAFORO_LABEL[item.semaforo]" :tone="SEMAFORO_TONE[item.semaforo]" />
          <Badge
            v-if="item.prioridad" :label="`Prioridad ${PRIORIDAD_LABEL[item.prioridad]}`"
            :tone="PRIORIDAD_TONE[item.prioridad]"
          />
        </div>
      </div>
      <div class="cab-acc">
        <button v-if="canEdit" class="btn btn-sm" :disabled="busy" @click="emit('editar')">
          <Pencil :size="13" /> Editar
        </button>
        <button v-if="canReenviar" class="btn btn-primary btn-sm" :disabled="busy" @click="emit('reenviar')">
          <Send :size="13" /> Reenviar
        </button>
        <button v-if="canDelete" class="btn btn-sm del" :disabled="busy" @click="emit('borrar')">
          <Trash2 :size="13" /> Archivar
        </button>
      </div>
    </header>

    <!-- La banda de error vive AQUÍ, en la rama del detalle. En la versión React se
         renderizaba en la del listado, así que un fallo al guardar la gestión o al
         rechazar era invisible hasta volver atrás. -->
    <p v-if="error" class="err">{{ error }}</p>

    <p v-if="item.motivoRechazo" class="rechazo">
      <TriangleAlert :size="15" />
      <span><b>Motivo de rechazo:</b> {{ item.motivoRechazo }}</span>
    </p>

    <section class="card sec">
      <h3>Información general</h3>
      <dl class="grid">
        <div v-for="c in general" :key="c[0]"><dt>{{ c[0] }}</dt><dd>{{ c[1] }}</dd></div>
      </dl>
    </section>

    <section class="card sec">
      <h3>Pedido y mercancía</h3>
      <dl class="grid">
        <div v-for="c in pedido" :key="c[0]"><dt>{{ c[0] }}</dt><dd>{{ c[1] }}</dd></div>
      </dl>
    </section>

    <section class="card sec">
      <h3>PLUs</h3>
      <table v-if="item.plines.length" class="plus">
        <thead><tr><th>PLU</th><th>Descripción</th><th>Unid.</th></tr></thead>
        <tbody>
          <tr v-for="(p, i) in item.plines" :key="p.id ?? i">
            <td class="mono">{{ p.plu }}</td>
            <td>{{ p.descripcion }}</td>
            <td class="tnum">{{ p.unidades }}</td>
          </tr>
        </tbody>
        <tfoot><tr><td colspan="2">Total</td><td class="tnum">{{ totalUnidades }}</td></tr></tfoot>
      </table>
      <p v-else class="vacio">Sin PLUs registrados.</p>
    </section>

    <section class="card sec">
      <h3>Origen y destino</h3>
      <dl class="grid">
        <div v-for="c in ruta" :key="c[0]"><dt>{{ c[0] }}</dt><dd>{{ c[1] }}</dd></div>
      </dl>
    </section>

    <section class="card sec">
      <h3>Programación y servicio</h3>
      <dl class="grid">
        <div v-for="c in programacion" :key="c[0]"><dt>{{ c[0] }}</dt><dd>{{ c[1] }}</dd></div>
      </dl>
      <p v-if="item.observacionesSolicitante" class="obs">{{ item.observacionesSolicitante }}</p>
    </section>

    <section v-if="isGestor" class="card sec">
      <h3>Gestión de transporte</h3>
      <slot name="gestion" />
    </section>

    <section class="card sec">
      <h3>Historial</h3>
      <SolicitudesTransporteHistorial :items="historial" />
    </section>
  </div>
</template>

<style scoped>
.detalle { display: flex; flex-direction: column; gap: 14px; }
.volver { align-self: flex-start; }
.cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px 18px; border-top: 3px solid var(--modulo, var(--info)); }
.cab-txt h2 { font-size: 21px; font-weight: 800; letter-spacing: -.02em; margin: 0; }
.ruta-sub { font-size: 13px; color: var(--muted); margin: 3px 0 0; }
.badges { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 10px; }
.cab-acc { display: flex; gap: 8px; flex-wrap: wrap; }
.del { color: var(--u-critico); }
.del:hover:not(:disabled) { border-color: color-mix(in srgb, var(--u-critico) 40%, transparent); }

.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 11px 13px; border-radius: var(--r-sm); margin: 0; }
.rechazo { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: var(--ink-2); background: var(--u-critico-tint); padding: 11px 13px; border-radius: var(--r-sm); margin: 0; }
.rechazo :deep(svg) { color: var(--u-critico); flex-shrink: 0; margin-top: 1px; }

.sec { padding: 15px 18px 17px; }
.sec h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--modulo, var(--info)); margin: 0 0 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px 18px; margin: 0; }
.grid dt { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--faint); }
.grid dd { margin: 2px 0 0; font-size: 13px; color: var(--ink-2); }
.obs { margin: 13px 0 0; font-size: 13px; color: var(--muted); line-height: 1.55; }

.plus { width: 100%; border-collapse: collapse; }
.plus th { text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--faint); padding: 6px 10px; }
.plus td { padding: 8px 10px; font-size: 13px; color: var(--ink-2); border-top: 1px solid var(--border); }
.plus tfoot td { font-weight: 700; color: var(--ink); }
.vacio { font-size: 13px; color: var(--muted); margin: 0; }
</style>
