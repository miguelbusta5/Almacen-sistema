<script setup lang="ts">
// Contar UNA ubicación, a pantalla completa.
//
// Tapa la lista a propósito: en la Zebra, tener las 2.106 ubicaciones encima del
// formulario obligaba al operario a desplazarse hasta abajo después de elegir
// (22-09). Mismo patrón que el modal de resurtido: pasos numerados, campos
// grandes y foco automático, para trabajar con la pistola sin tocar la pantalla.
import { computed, nextTick, ref, watch } from 'vue'
import { ScanLine, X, Check, Utensils, LogOut, Package, Loader2 } from '@lucide/vue'
import {
  ESTADO_TAREA_LABEL, faltaUnidadEmpaque, fisicoCapturado, tiempoTarea,
  type TareaInventarioDTO,
} from '~/utils/inventario'

const props = defineProps<{
  tarea: TareaInventarioDTO | null
  esMia: boolean
  guardando: boolean
  ahora: number
}>()

const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'iniciar', ubicacion: string): void
  (e: 'pausar', motivo: 'ALIMENTACION' | 'FIN_TURNO'): void
  (e: 'reanudar'): void
  (e: 'consultar', codigo: string): void
  (e: 'guardar', datos: { cajas: number; empaque: number; reguero: number; teoricoActual: number | null }): void
  (e: 'ausente', plu: string): void
  (e: 'terminar'): void
}>()

const producto = defineModel<{ plu: string; descripcion: string } | null>('producto', { default: null })

const ubicacion = ref('')
const codigo = ref('')
const cajas = ref<number | null>(null)
const empaque = ref<number | null>(null)
const reguero = ref<number | null>(0)
const teoricoActual = ref<number | null>(null)

const inputUbic = ref<HTMLInputElement | null>(null)
const inputCodigo = ref<HTMLInputElement | null>(null)
const inputCajas = ref<HTMLInputElement | null>(null)

const contando = computed(() => props.tarea?.estado === 'EN_CURSO' && !props.tarea?.pausaInicio)
const faltaEmpaque = computed(() => faltaUnidadEmpaque(cajas.value, empaque.value))
const total = computed(() => fisicoCapturado(cajas.value, empaque.value, reguero.value))
const contados = computed(() => new Set((props.tarea?.registros ?? []).map((r) => r.plu)))
const faltantes = computed(() => (props.tarea?.esperados ?? []).filter((e) => !contados.value.has(e.plu)))

function limpiarCaptura() {
  codigo.value = ''
  cajas.value = null
  empaque.value = null
  reguero.value = 0
  teoricoActual.value = null
  producto.value = null
}

// El foco salta solo al campo que toca: con la pistola en la mano, tocar la
// pantalla para enfocar es justo el gesto que hace lento el conteo.
watch(() => props.tarea?.id, async (id) => {
  if (!id) return
  ubicacion.value = ''
  limpiarCaptura()
  await nextTick()
  if (props.tarea?.estado === 'PENDIENTE') inputUbic.value?.focus()
  else inputCodigo.value?.focus()
}, { immediate: true })

// Al resolverse el PLU, el cursor cae en las cajas: es lo siguiente que digita.
watch(producto, async (p) => {
  if (!p) return
  await nextTick()
  inputCajas.value?.focus()
})

defineExpose({ limpiarCaptura, enfocarCodigo: () => nextTick(() => inputCodigo.value?.focus()) })
</script>

<template>
  <div v-if="tarea" class="overlay">
    <section class="modal" role="dialog" aria-modal="true" :aria-label="`Ubicación ${tarea.ubicacion}`">
      <header class="m-head">
        <div>
          <span class="m-tipo">{{ tarea.tipo === 'RECONTEO' ? 'Reconteo' : 'Conteo inicial' }}</span>
          <h2 class="m-ubic mono">{{ tarea.ubicacion }}</h2>
          <p class="m-meta">
            {{ ESTADO_TAREA_LABEL[tarea.estado] }} · <span class="tnum">{{ tiempoTarea(tarea, ahora) }}</span>
            <template v-if="tarea.registros?.length"> · {{ tarea.registros.length }} PLU contados</template>
          </p>
        </div>
        <button class="icono" aria-label="Volver a la lista" @click="emit('cerrar')"><X :size="18" /></button>
      </header>

      <div class="m-body">
        <template v-if="!esMia">
          <p class="aviso">Esta ubicación es de otra persona. Puedes mirarla, pero no contarla.</p>
        </template>

        <!-- Paso 1: confirmar la ubicación escaneando -->
        <form v-else-if="tarea.estado === 'PENDIENTE'" class="paso" @submit.prevent="emit('iniciar', ubicacion)">
          <span class="paso-n">1</span>
          <div class="paso-cuerpo">
            <label class="campo">
              <span class="campo-label"><ScanLine :size="13" /> Escanea la ubicación para empezar</span>
              <input
                ref="inputUbic" v-model="ubicacion" class="field grande mono" type="text"
                autocomplete="off" autocapitalize="characters" :placeholder="tarea.ubicacion"
              >
            </label>
            <button class="btn btn-primary grande" :disabled="guardando || !ubicacion.trim()">
              <Loader2 v-if="guardando" :size="15" class="spin" /><Check v-else :size="15" />
              Confirmar e iniciar
            </button>
          </div>
        </form>

        <template v-else-if="tarea.estado === 'COMPLETADA'">
          <p class="listo"><Check :size="15" /> Ubicación terminada.</p>
        </template>

        <template v-else>
          <div v-if="tarea.pausaInicio" class="pausa">
            <p>En pausa: {{ tarea.pausaMotivo === 'FIN_TURNO' ? 'fin de turno' : 'alimentación' }}.</p>
            <button class="btn btn-primary" :disabled="guardando" @click="emit('reanudar')">Reanudar conteo</button>
          </div>

          <template v-else>
            <!-- Paso 2: escanear el producto -->
            <form class="paso" @submit.prevent="emit('consultar', codigo)">
              <span class="paso-n">2</span>
              <div class="paso-cuerpo">
                <label class="campo">
                  <span class="campo-label"><ScanLine :size="13" /> Escanea el código de barras</span>
                  <input
                    ref="inputCodigo" v-model="codigo" class="field grande mono" type="text"
                    autocomplete="off" autocapitalize="characters" @input="producto = null"
                  >
                </label>
                <button class="btn grande" :disabled="guardando || !codigo.trim()">
                  <Package :size="15" /> Consultar producto
                </button>
              </div>
            </form>

            <!-- Paso 3: la cantidad -->
            <form
              v-if="producto" class="paso"
              @submit.prevent="emit('guardar', { cajas: Number(cajas ?? 0), empaque: Number(empaque ?? 0), reguero: Number(reguero ?? 0), teoricoActual })"
            >
              <span class="paso-n">3</span>
              <div class="paso-cuerpo">
                <p class="p-plu"><b class="mono">{{ producto.plu }}</b> · {{ producto.descripcion }}</p>
                <div class="campos">
                  <label class="campo">
                    <span class="campo-label">Cajas master</span>
                    <input ref="inputCajas" v-model.number="cajas" class="field grande tnum" type="number" min="0" step="1" inputmode="numeric">
                  </label>
                  <label class="campo">
                    <span class="campo-label">Unidad de empaque</span>
                    <input v-model.number="empaque" class="field grande tnum" type="number" min="0" step="1" inputmode="numeric">
                  </label>
                  <label class="campo">
                    <span class="campo-label">Reguero</span>
                    <input v-model.number="reguero" class="field grande tnum" type="number" min="0" step="1" inputmode="numeric">
                  </label>
                  <label v-if="tarea.tipo === 'RECONTEO'" class="campo ancho">
                    <span class="campo-label">Teórico actualizado en NetSuite</span>
                    <input v-model.number="teoricoActual" class="field grande tnum" type="number" step="1" inputmode="numeric">
                  </label>
                </div>
                <p class="total">Total físico: <b class="tnum">{{ total }}</b> unidades</p>
                <p v-if="faltaEmpaque" class="aviso">Indica cuántas unidades trae cada caja.</p>
                <p v-else-if="total === 0" class="nota">Vas a guardar cero: la ubicación queda registrada como vacía.</p>
                <button class="btn btn-primary grande" :disabled="guardando || faltaEmpaque">
                  <Loader2 v-if="guardando" :size="15" class="spin" /><Check v-else :size="15" />
                  Guardar conteo
                </button>
              </div>
            </form>

            <!-- Lo que el teórico espera aquí -->
            <section class="esperados">
              <h3 class="e-titulo">
                Productos esperados
                <span class="e-n">{{ contados.size }} de {{ tarea.esperados?.length ?? 0 }}</span>
              </h3>
              <ul class="e-lista">
                <li v-for="p in tarea.esperados ?? []" :key="p.plu" :class="{ hecho: contados.has(p.plu) }">
                  <span class="e-plu mono">{{ p.plu }}</span>
                  <span class="e-desc">{{ p.descripcion }}</span>
                  <Check v-if="contados.has(p.plu)" :size="14" class="e-ok" />
                  <button
                    v-else-if="tarea.tipo === 'INICIAL'" class="btn btn-sm"
                    :disabled="guardando" @click="emit('ausente', p.plu)"
                  >
                    No está: cero
                  </button>
                </li>
                <li v-if="!tarea.esperados?.length" class="e-vacio">
                  El teórico no espera nada aquí. Si encuentras algo, escanéalo igual.
                </li>
              </ul>
            </section>

            <div class="m-acciones">
              <button class="btn" :disabled="guardando" @click="emit('pausar', 'ALIMENTACION')">
                <Utensils :size="14" /> Alimentación
              </button>
              <button class="btn" :disabled="guardando" @click="emit('pausar', 'FIN_TURNO')">
                <LogOut :size="14" /> Fin de turno
              </button>
              <button
                class="btn btn-primary" :disabled="guardando || !!producto"
                :title="producto ? 'Guarda o descarta el producto en pantalla' : ''"
                @click="emit('terminar')"
              >
                <Check :size="14" /> Terminar ubicación
                <span v-if="faltantes.length" class="t-faltan">({{ faltantes.length }} sin contar)</span>
              </button>
            </div>
          </template>
        </template>

        <!-- Lo ya guardado aquí, para que no cuente dos veces -->
        <section v-if="tarea.registros?.length" class="avances">
          <h3 class="e-titulo">Avances guardados</h3>
          <ul class="e-lista">
            <li v-for="r in tarea.registros" :key="r.id">
              <span class="e-plu mono">{{ r.plu }}</span>
              <span class="e-desc"><b class="tnum">{{ r.fisico }}</b> unidades · {{ r.estado }}</span>
              <span v-if="r.inesperado" class="e-extra">Inesperado</span>
            </li>
          </ul>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 14px; background: rgba(10,14,20,.55); }
.modal { width: min(640px, 100%); max-height: 92vh; display: flex; flex-direction: column; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.25); }
.m-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid var(--border); }
.m-tipo { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--brand); }
.m-ubic { margin: 4px 0 2px; font-size: 22px; font-weight: 800; color: var(--ink); }
.m-meta { margin: 0; font-size: 12.5px; color: var(--muted); }
.icono { display: grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: var(--r-sm); background: transparent; color: var(--muted); cursor: pointer; }
.icono:hover { background: var(--surface-3); color: var(--ink); }
.m-body { overflow: auto; padding: 14px 18px 18px; display: grid; gap: 14px; }

.paso { display: flex; gap: 12px; align-items: flex-start; }
.paso-n { display: grid; place-items: center; width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; font-size: 13px; font-weight: 800; color: var(--brand-deep); background: var(--brand-tint); }
.paso-cuerpo { flex: 1; min-width: 0; display: grid; gap: 10px; }
.campo { display: grid; gap: 6px; }
.campo-label { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.campo.ancho { grid-column: 1 / -1; }
.field.grande { height: 46px; font-size: 16px; }
.btn.grande { height: 46px; font-size: 15px; justify-content: center; }
.p-plu { margin: 0; font-size: 14px; color: var(--ink); }
.total { margin: 0; font-size: 14px; color: var(--ink-2); }
.total b { font-size: 18px; color: var(--ink); }
.nota { margin: 0; font-size: 12.5px; color: var(--muted); }
.aviso { margin: 0; padding: 10px 12px; border-radius: var(--r-sm); font-size: 13px; font-weight: 700; color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 12%, transparent); }
.listo { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 14px; font-weight: 700; color: var(--u-ok); }
.pausa { display: grid; gap: 10px; padding: 14px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--u-aviso) 10%, transparent); }
.pausa p { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--ink-2); }

.esperados, .avances { border-top: 1px solid var(--border); padding-top: 12px; }
.e-titulo { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 8px; font-size: 13px; font-weight: 800; color: var(--ink); }
.e-n { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.e-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.e-lista li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--ink) 4%, transparent); font-size: 12.5px; }
.e-lista li.hecho { background: color-mix(in srgb, var(--u-ok) 10%, transparent); }
.e-plu { font-weight: 800; color: var(--ink); }
.e-desc { flex: 1 1 140px; color: var(--muted); }
.e-ok { color: var(--u-ok); }
.e-extra { font-size: 11px; font-weight: 700; color: var(--u-aviso); }
.e-vacio { color: var(--muted); background: transparent; }

.m-acciones { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
.m-acciones .btn { flex: 1 1 auto; justify-content: center; }
.t-faltan { font-weight: 700; opacity: .85; }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 620px) {
  .modal { width: 100%; max-height: 96vh; }
  .m-body { padding: 12px 14px 16px; }
  .campos { grid-template-columns: 1fr 1fr; }
}
</style>
