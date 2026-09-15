<script setup lang="ts">
// La planilla con el reloj corriendo. El operario la deja abierta mientras baja
// el contenedor y vuelve horas después a cerrarla, así que tiene que sobrevivir
// a recargar la página: se lee de /abierta, no de la lista.
import { ref, reactive, computed, watch } from 'vue'
import { Timer, CheckCircle2, Users, Package } from '@lucide/vue'
import {
  cronometroRecepcion, fmtHoraRecepcion, TIPO_PRODUCTO_LABEL, validarCierre,
  type Recepcion,
} from '~/utils/recepcion'

const props = defineProps<{
  recepcion: Recepcion
  ahora: number
  guardando: boolean
}>()
const emit = defineEmits<{
  (e: 'cerrar', payload: { estibasUsadas: number; referenciasNuevas: number; unidadesNuevas: number }): void
  (e: 'dirty', v: boolean): void
}>()

const r = computed(() => props.recepcion)
const crono = computed(() => cronometroRecepcion(r.value, props.ahora))

const form = reactive({ estibasUsadas: '', referenciasNuevas: '', unidadesNuevas: '' })
watch(() => r.value.id, () => {
  form.estibasUsadas = ''
  form.referenciasNuevas = ''
  form.unidadesNuevas = ''
})

const payload = computed(() => ({
  estibasUsadas: Number(form.estibasUsadas || 0),
  referenciasNuevas: Number(form.referenciasNuevas || 0),
  unidadesNuevas: Number(form.unidadesNuevas || 0),
}))
const error = computed(() => validarCierre(payload.value))
const puedeCerrar = computed(() => !props.guardando && !error.value)

const sucio = computed(() =>
  Boolean(form.estibasUsadas || form.referenciasNuevas || form.unidadesNuevas))
watch(sucio, (v) => emit('dirty', v))

function cerrar() {
  if (!puedeCerrar.value) return
  emit('cerrar', payload.value)
}
</script>

<template>
  <section class="card abierta" :inert="!!r.pausaId">
    <header class="cab">
      <span class="pulse" />
      <div class="cab-txt">
        <b class="mono ped">{{ r.numeroPedido }}</b>
        <span class="prov">{{ r.proveedor }}</span>
      </div>
      <div class="cab-der">
        <span v-if="r.pausaId" class="tipo">En pausa</span>
        <span class="tipo">{{ TIPO_PRODUCTO_LABEL[r.tipoProducto] }}</span>
        <span class="crono tnum"><Timer :size="15" />{{ crono ?? '—' }}</span>
      </div>
    </header>

    <dl class="datos">
      <div><dt>Peso</dt><dd class="tnum">{{ r.pesoKg }} kg</dd></div>
      <div><dt>Referencias</dt><dd class="tnum">{{ r.referenciasEsperadas }}</dd></div>
      <div><dt>Cajas</dt><dd class="tnum">{{ r.cajas }}</dd></div>
      <div><dt>Unidades</dt><dd class="tnum strong">{{ r.unidades }}</dd></div>
      <div><dt>Inicio</dt><dd>{{ fmtHoraRecepcion(r.horaInicio) }}</dd></div>
    </dl>

    <p class="personas">
      <Users :size="13" />
      <span v-if="r.descargadores.length">
        {{ r.descargadores.map((d) => d.nombre).join(', ') }}
      </span>
      <span v-else class="muted">Sin personas asignadas</span>
    </p>

    <!-- Los datos del cierre no se piden al abrir porque son el RESULTADO de la
         descarga, no su plan: nadie sabe cuántas estibas usó antes de bajarlo. -->
    <form class="cerrar" @submit.prevent="cerrar">
      <div class="cerrar-head">
        <Package :size="14" />
        <span>Para cerrar, completa cómo quedó la descarga</span>
      </div>
      <div class="cerrar-grid">
        <label class="f">
          <span class="lbl">Estibas usadas</span>
          <input v-model="form.estibasUsadas" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="guardando">
        </label>
        <label class="f">
          <span class="lbl">Referencias nuevas</span>
          <input v-model="form.referenciasNuevas" class="field tnum" type="number" min="0" inputmode="numeric" :disabled="guardando">
        </label>
        <label class="f">
          <span class="lbl">Unidades nuevas</span>
          <input v-model="form.unidadesNuevas" class="field tnum" type="number" min="0" inputmode="numeric" :disabled="guardando">
        </label>
        <div class="f f-btn">
          <button class="btn btn-primary submit" :disabled="!puedeCerrar">
            <Spinner v-if="guardando" :size="15" /><CheckCircle2 v-else :size="15" />
            Finalizar recepción
          </button>
        </div>
      </div>
      <span v-if="error" class="err">{{ error }}</span>
      <span v-else class="hint">Los reportes de novedad se añaden después de finalizar.</span>
    </form>
  </section>
</template>

<style scoped>
.abierta {
  padding: 15px 17px 16px;
  border-color: color-mix(in srgb, var(--brand) 40%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 7%, transparent);
}

.cab { display: flex; align-items: center; gap: 11px; }
.pulse { width: 9px; height: 9px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 0 0 var(--brand-ring); animation: lat 1.8s ease-out infinite; flex-shrink: 0; }
@keyframes lat { 0% { box-shadow: 0 0 0 0 var(--brand-ring) } 70% { box-shadow: 0 0 0 9px transparent } 100% { box-shadow: 0 0 0 0 transparent } }
.cab-txt { display: flex; flex-direction: column; min-width: 0; }
.ped { font-size: 16px; font-weight: 700; color: var(--ink); }
.prov { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cab-der { margin-left: auto; display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
.tipo { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); padding: 3px 9px; border: 1px solid var(--border); border-radius: var(--r-pill); }
/* El cronómetro es lo que el operario mira de lejos: grande y en verde. */
.crono { display: inline-flex; align-items: center; gap: 6px; font-family: var(--display); font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--brand); }

.datos { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px 14px; margin: 14px 0 11px; padding: 12px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.datos dt { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); }
.datos dd { margin: 2px 0 0; font-size: 13.5px; color: var(--ink-2); }
.datos .strong { font-weight: 700; color: var(--ink); }

.personas { display: flex; align-items: center; gap: 7px; margin: 0 0 14px; font-size: 12.5px; color: var(--ink-2); }
.muted { color: var(--muted); }

.cerrar { border-top: 1px dashed var(--border-strong); padding-top: 13px; }
.cerrar-head { display: flex; align-items: center; gap: 7px; margin-bottom: 11px; font-size: 12px; font-weight: 700; color: var(--muted); }
.cerrar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px; align-items: end; }
.f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.submit { width: 100%; height: 38px; }
.err { display: block; margin-top: 9px; font-size: 12.5px; color: var(--u-aviso); }
.hint { display: block; margin-top: 9px; font-size: 12px; color: var(--faint); }

@media (max-width: 900px) {
  .datos { grid-template-columns: repeat(3, 1fr); }
  .cerrar-grid { grid-template-columns: repeat(2, 1fr); }
  .f-btn { grid-column: 1 / -1; }
  .submit { height: 46px; }
  .cerrar-grid :deep(.field) { height: 44px; font-size: 16px; }
  .crono { font-size: 19px; }
}
</style>
