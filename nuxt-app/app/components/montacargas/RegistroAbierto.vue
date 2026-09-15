<script setup lang="ts">
// Tarjeta de un registro con el reloj corriendo. Es donde vive todo el trabajo
// después de digitar el PLU: completar cantidades, pasarlo a un ayudante,
// marcar una novedad o cerrarlo con la ubicación final.
//
// El mismo componente sirve a quien abrió el registro y a quien lo recibió;
// cambian los botones. Quien recibe NO edita cantidades: confirma lo que le
// pasaron o marca la novedad — por eso su vista es de una sola pulsación.
//
// El modo va por REGISTRO y no por rol: un montacarguista también hace de
// ayudante, y entonces está en modo confirmación aunque su rol sea el de crear.
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { UserPlus, Trash2, TriangleAlert, CheckCircle2, Boxes } from '@lucide/vue'
import {
  calcularCantidadTotal, esUbicacionCanonica, fmtHoraMovimiento, normalizarUbicacion,
  requiereUbicacionInicial, tieneCantidades, TIPO_NOVEDAD_LABEL, cronometroTramo,
  API_MONTACARGAS, quienPasoElPlu, validarUnidadesAlmacenadas,
  type Ayudante, type Movimiento,
} from '~/utils/montacargas'

const props = defineProps<{
  movimiento: Movimiento
  ahora: number
  /** Le pasaron el PLU: confirma y ubica, no edita cantidades. */
  recibido: boolean
  /** Resaltado tras escanear su PLU en la bandeja. */
  destacado?: boolean
  /** Cerrar una novedad es un permiso por persona, no por rol. */
  puedeResolverNovedades?: boolean
  /** El registro es de otra persona y solo se ve para poder verificarlo. */
  ajeno?: boolean
  guardando: boolean
}>()
const emit = defineEmits<{
  (e: 'cantidades', payload: { cajas: number; unidadesPorCaja: number; hayReguero: boolean; unidadesSueltas: number }): void
  (e: 'ubicar', payload: { ubicacionFinal: string; unidadesAlmacenadas: number; devolverAId?: string }): void
  (e: 'traspasar'): void
  (e: 'novedad'): void
  (e: 'resolver'): void
  (e: 'descartar'): void
}>()

const m = computed(() => props.movimiento)
const listo = computed(() => tieneCantidades(m.value))
const enNovedad = computed(() => m.value.estado === 'NOVEDAD')
const pideOrigen = computed(() => requiereUbicacionInicial(m.value.tipo))

// El reloj se detiene con la novedad: el cronómetro deja de correr solo porque
// el tramo está cerrado, sin ninguna lógica extra aquí.
const crono = computed(() => cronometroTramo(m.value, props.ahora))

// ── Cantidades (solo montacarguista) ──────────────────────
const form = reactive({
  cajas: String(m.value.cajas || ''),
  unidadesPorCaja: String(m.value.unidadesPorCaja || ''),
  hayReguero: m.value.hayReguero,
  unidadesSueltas: String(m.value.unidadesSueltas || ''),
})
watch(() => m.value.id, () => {
  form.cajas = String(m.value.cajas || '')
  form.unidadesPorCaja = String(m.value.unidadesPorCaja || '')
  form.hayReguero = m.value.hayReguero
  form.unidadesSueltas = String(m.value.unidadesSueltas || '')
})
// Desmarcar el reguero limpia la cantidad: dejarla la sumaría al total sin verse.
watch(() => form.hayReguero, (v) => { if (!v) form.unidadesSueltas = '' })

const sueltasNum = computed(() => (form.hayReguero ? Number(form.unidadesSueltas || 0) : 0))
const totalPreview = computed(() =>
  calcularCantidadTotal(Number(form.cajas || 0), Number(form.unidadesPorCaja || 0), sueltasNum.value),
)
const puedeGuardarCantidades = computed(() =>
  !props.guardando &&
  Number(form.unidadesPorCaja) >= 1 &&
  (Number(form.cajas || 0) >= 1 || sueltasNum.value >= 1) &&
  (!form.hayReguero || sueltasNum.value >= 1),
)

function guardarCantidades() {
  if (!puedeGuardarCantidades.value) return
  emit('cantidades', {
    cajas: Number(form.cajas || 0),
    unidadesPorCaja: Number(form.unidadesPorCaja),
    hayReguero: form.hayReguero,
    unidadesSueltas: sueltasNum.value,
  })
}

// ── Ubicación final ───────────────────────────────────────
const ubicInput = ref<HTMLInputElement | null>(null)
const ubicacion = ref('')
const normalizada = computed(() => normalizarUbicacion(ubicacion.value))
const esLibre = computed(() => Boolean(normalizada.value) && !esUbicacionCanonica(normalizada.value))

// Cuantas unidades cupieron de verdad. Se le pregunta a quien RECIBIO el PLU
// —operario o montacarguista ayudando—: quien lo abrio elige la ubicacion del
// sobrante, asi que a el le cabe por definicion. Arranca con el total, que es
// el caso normal.
//
// Antes dependia de una prop `esAyudante` que ya no se pasaba: la casilla no
// salia nunca, se cerraba siempre con el total y el sobrante no volvia a nadie.
const almacenadas = ref(String(m.value.cantidadTotal || ''))
watch(() => m.value.id, () => { almacenadas.value = String(m.value.cantidadTotal || '') })
watch(() => m.value.cantidadTotal, (v) => { almacenadas.value = String(v || '') })

const almacenadasNum = computed(() => Number(almacenadas.value || 0))
// No cupo ninguna: se devuelve el total, sin ubicacion final.
const devuelveTodo = computed(() =>
  props.recibido && almacenadas.value !== '' && almacenadasNum.value === 0)
function noCupoNada() {
  almacenadas.value = '0'
  void cargarReceptores()
}
const errorAlmacenadas = computed(() =>
  props.recibido ? validarUnidadesAlmacenadas(almacenadasNum.value, m.value.cantidadTotal) : null,
)
const sobrante = computed(() =>
  props.recibido ? Math.max(0, m.value.cantidadTotal - almacenadasNum.value) : 0,
)
// A quien vuelve lo que no cupo. Se le PREGUNTA a quien cierra, para que no
// haya dudas de quien tiene que ubicarlo; viene propuesto quien le paso el PLU.
const pasoId = computed(() => quienPasoElPlu(m.value.tramos, m.value.responsableId)?.usuarioId ?? '')
const devolverAId = ref('')
const receptores = ref<Ayudante[]>([])
const cargandoReceptores = ref(false)
async function cargarReceptores() {
  if (receptores.value.length || cargandoReceptores.value) return
  cargandoReceptores.value = true
  try {
    const res = await $fetch<{ data: Ayudante[] }>(`${API_MONTACARGAS}/ayudantes`)
    receptores.value = res.data
    if (!devolverAId.value && res.data.some((a) => a.id === pasoId.value)) devolverAId.value = pasoId.value
  } catch { /* sin lista no se puede elegir: el boton se queda deshabilitado */ } finally {
    cargandoReceptores.value = false
  }
}
// La lista se pide la primera vez que sobra algo, no con cada tarjeta.
watch(sobrante, (v) => { if (v > 0) void cargarReceptores() })
const faltaDestino = computed(() => sobrante.value > 0 && !devolverAId.value)

const puedeUbicar = computed(() =>
  !props.guardando && (devuelveTodo.value || Boolean(normalizada.value)) && listo.value && !enNovedad.value
  && !errorAlmacenadas.value && !faltaDestino.value,
)

watch(() => props.destacado, (v) => { if (v) void nextTick(() => ubicInput.value?.focus()) })

function ubicar() {
  if (!puedeUbicar.value) return
  emit('ubicar', {
    ubicacionFinal: devuelveTodo.value ? '' : normalizada.value,
    unidadesAlmacenadas: props.recibido ? almacenadasNum.value : m.value.cantidadTotal,
    ...(sobrante.value > 0 && { devolverAId: devolverAId.value }),
  })
}
</script>

<template>
  <section class="reg card" :class="{ destacado, novedad: enNovedad }" :inert="!!m.pausaId">
    <header class="cab">
      <span class="pulse" :class="{ parado: enNovedad || !!m.pausaId }" />
      <div class="cab-txt">
        <b class="mono">{{ m.plu }}</b>
        <span class="desc">{{ m.descripcion }}</span>
        <span v-if="m.origenId" class="chip-sob" title="Es lo que no cupo en la ubicacion anterior">
          Sobrante
        </span>
      </div>
      <div class="cab-der">
        <span v-if="enNovedad" class="chip-nov"><TriangleAlert :size="12" /> Reloj detenido</span>
        <span v-else-if="m.pausaId" class="chip-nov">En pausa · {{ crono }}</span>
        <span v-else class="crono tnum">{{ crono ?? '—' }}</span>
      </div>
    </header>

    <p class="meta">
      <template v-if="listo">
        {{ m.cajas }} cajas × {{ m.unidadesPorCaja }}
        <template v-if="m.hayReguero"> + {{ m.unidadesSueltas }} sueltas</template>
        = <b class="tnum">{{ m.cantidadTotal }}</b> unidades
      </template>
      <template v-else>Sin cantidades todavía</template>
      <template v-if="m.ubicacionInicial"> · desde {{ m.ubicacionInicial }}</template>
      · desde {{ fmtHoraMovimiento(m.horaInicio) }}
      <template v-if="m.responsableNombre"> · {{ m.responsableNombre }}</template>
    </p>

    <!-- Novedad abierta: el registro está fuera del reloj hasta que se verifique -->
    <div v-if="enNovedad && m.novedadAbierta" class="banda-nov">
      <TriangleAlert :size="14" />
      <div class="banda-txt">
        <b>{{ TIPO_NOVEDAD_LABEL[m.novedadAbierta.tipo] }}</b>
        <span>
          {{ m.novedadAbierta.abiertaPorNombre ?? 'Ayudante' }}
          <template v-if="m.novedadAbierta.cantidadEncontrada != null">
            · encontró {{ m.novedadAbierta.cantidadEncontrada }} unidades
          </template>
          <template v-if="m.novedadAbierta.ubicacionEncontrada">
            · encontró en {{ m.novedadAbierta.ubicacionEncontrada }}
          </template>
        </span>
        <span v-if="m.novedadAbierta.detalle" class="det-nov">{{ m.novedadAbierta.detalle }}</span>
        <!-- Donde quedo fisicamente la mercancia mientras se verifica: sin este
             dato nadie sabe donde buscarla. -->
        <span v-if="m.ubicacionFinal" class="ubic-nov">Ubicada en <b>{{ m.ubicacionFinal }}</b></span>
      </div>
      <button v-if="puedeResolverNovedades" class="btn btn-sm" @click="emit('resolver')">Verificar</button>
      <span v-else class="espera">Pendiente de verificación</span>
    </div>

    <!-- Cantidades: las completa quien abrió el registro, con el reloj ya
         corriendo. Quien lo recibe nunca las edita — confirma o marca novedad. -->
    <form v-if="!recibido && !enNovedad" class="cant" @submit.prevent="guardarCantidades">
      <label class="f">
        <span class="lbl">Cajas master</span>
        <input v-model="form.cajas" class="field tnum" type="number" min="0" inputmode="numeric" :disabled="guardando">
      </label>
      <label class="f">
        <span class="lbl">Unidades x caja</span>
        <input v-model="form.unidadesPorCaja" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="guardando">
      </label>
      <div class="f f-chk">
        <span class="lbl">¿Hay reguero?</span>
        <label class="check">
          <input v-model="form.hayReguero" type="checkbox" :disabled="guardando">
          <span>Sueltas</span>
        </label>
      </div>
      <label v-if="form.hayReguero" class="f">
        <span class="lbl">Sueltas</span>
        <input v-model="form.unidadesSueltas" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="guardando">
      </label>
      <div class="f">
        <span class="lbl">Total</span>
        <div class="total tnum" :class="{ on: totalPreview > 0 }">{{ totalPreview }}</div>
      </div>
      <div class="f f-btn">
        <button class="btn btn-sm" :disabled="!puedeGuardarCantidades">
          <Spinner v-if="guardando" :size="13" /><Boxes v-else :size="13" />
          Guardar cantidades
        </button>
      </div>
    </form>

    <!-- Confirmación de quien recibió el PLU: una sola pulsación. Ve lo que debe
         almacenar y decide; si no cuadra, no corrige, marca la novedad. -->
    <div v-if="recibido && !enNovedad" class="confirmar">
      <div class="esperado">
        <span class="lbl">Debes almacenar</span>
        <b class="tnum">{{ m.cantidadTotal }}</b>
        <span class="ud">unidades</span>
      </div>
      <button class="btn btn-sm no-cuadra" :disabled="guardando" @click="emit('novedad')">
        <TriangleAlert :size="13" /> No cuadra
      </button>
    </div>

    <!-- Ubicación final: cierra el registro y para el reloj -->
    <form v-if="!enNovedad" class="cerrar" @submit.prevent="ubicar">
      <!-- Cuanto cupo de verdad. Solo a quien lo recibio: quien lo paso elige
           donde va el sobrante, asi que a el le cabe por definicion. -->
      <label v-if="recibido" class="f f-cant">
        <span class="lbl">Unidades que almacenaste</span>
        <input
          v-model="almacenadas" class="field tnum" type="number" min="0"
          :max="m.cantidadTotal" inputmode="numeric" :disabled="guardando"
        >
        <span v-if="errorAlmacenadas" class="hint warn-txt">
          <TriangleAlert :size="11" /> {{ errorAlmacenadas }}
        </span>
        <span v-else-if="devuelveTodo" class="hint sob-txt">
          <TriangleAlert :size="11" /> No cupo ninguna: devuelves las {{ m.cantidadTotal }}
        </span>
        <span v-else-if="sobrante > 0" class="hint sob-txt">
          <TriangleAlert :size="11" /> Quedan {{ sobrante }} sin almacenar
        </span>
        <!-- Atajo para el caso que antes no tenia salida: no cupo ninguna. -->
        <button v-if="!devuelveTodo" type="button" class="nada-link" :disabled="guardando" @click="noCupoNada">
          No cupo ninguna: devolver todo
        </button>
      </label>
      <!-- A quien vuelve el sobrante: se pregunta siempre, con quien le paso el
           PLU ya propuesto, para que no haya dudas de quien lo ubica. -->
      <label v-if="sobrante > 0" class="f f-dev">
        <span class="lbl">¿A quién le devuelves las {{ sobrante }}?</span>
        <select v-model="devolverAId" class="field" :disabled="guardando || cargandoReceptores">
          <option value="" disabled>{{ cargandoReceptores ? 'Cargando…' : 'Elige a quién' }}</option>
          <option v-for="a in receptores" :key="a.id" :value="a.id">
            {{ a.nombre }}{{ a.id === pasoId ? ' · te lo pasó' : '' }}
          </option>
        </select>
        <span class="hint">
          {{ devuelveTodo
            ? 'Le vuelve este mismo registro, con el reloj corriendo, para que lo ubique.'
            : 'Le llega como un registro nuevo, con su reloj, para que las ubique.' }}
        </span>
      </label>
      <label v-if="!devuelveTodo" class="f f-ubic">
        <span class="lbl">Ubicación final</span>
        <input
          ref="ubicInput" v-model="ubicacion" class="field" placeholder="05-B-25-03-01"
          autocomplete="off" autocapitalize="characters" enterkeyhint="done" :disabled="guardando || !listo"
        >
        <span v-if="esLibre" class="hint warn-txt">
          <TriangleAlert :size="11" /> Ubicación libre, fuera del formato 05-B-25-03-01
        </span>
        <span v-else-if="!listo" class="hint warn-txt">
          <TriangleAlert :size="11" /> Completa las cantidades antes de cerrar
        </span>
      </label>
      <button class="btn btn-primary submit" :disabled="!puedeUbicar">
        <Spinner v-if="guardando" :size="14" /><CheckCircle2 v-else :size="14" />
        {{ devuelveTodo ? `Devolver las ${m.cantidadTotal}` : 'Cerrar' }}
      </button>
    </form>

    <footer v-if="!ajeno || !enNovedad" class="acc">
      <button
        v-if="!enNovedad" class="btn-link" :disabled="guardando || !listo"
        :title="listo ? 'Pasar el PLU a un ayudante' : 'Guarda las cantidades antes de pasarlo'"
        @click="emit('traspasar')"
      >
        <UserPlus :size="13" /> Pasar a ayudante
      </button>
      <span v-if="!enNovedad && !listo" class="acc-nota">
        el ayudante necesita las cantidades para confirmarlas
      </span>
      <button v-if="!ajeno" class="btn-link danger" :disabled="guardando" @click="emit('descartar')">
        <Trash2 :size="13" /> Descartar
      </button>
    </footer>
  </section>
</template>

<style scoped>
.reg {
  padding: 14px 16px 12px;
  border-top: 3px solid var(--info);
  background: color-mix(in srgb, var(--info) 4%, var(--surface));
  transition: box-shadow .2s, border-color .2s;
}
.reg.novedad { border-top-color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 5%, var(--surface)); }
.reg.destacado { box-shadow: 0 0 0 2px var(--brand); }

.cab { display: flex; align-items: center; gap: 10px; }
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--info); flex-shrink: 0; animation: auroraPulse 1.8s ease-in-out infinite; }
.pulse.parado { background: var(--u-aviso); animation: none; }
.cab-txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.cab-txt b { font-size: 14px; color: var(--ink); }
.desc { font-size: 12px; color: var(--muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cab-der { flex-shrink: 0; }
.crono { font-size: 20px; font-weight: 700; color: var(--info); font-variant-numeric: tabular-nums; }
.chip-nov { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: var(--u-aviso); }

.meta { margin: 8px 0 10px; font-size: 12px; color: var(--muted); }
.meta b { color: var(--ink); }

.banda-nov { display: flex; align-items: flex-start; gap: 9px; padding: 9px 11px; margin-bottom: 11px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--u-aviso) 10%, transparent); border: 1px solid color-mix(in srgb, var(--u-aviso) 32%, transparent); color: var(--u-aviso); }
.banda-txt { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.banda-txt b { font-size: 12.5px; color: var(--ink); }
.banda-txt span { font-size: 11.5px; color: var(--muted); }
.det-nov { font-style: italic; }
.ubic-nov { font-size: 11.5px; color: var(--muted); }
.ubic-nov b { color: var(--ink); font-family: var(--mono, monospace); }
.espera { font-size: 11.5px; font-weight: 700; color: var(--u-aviso); white-space: nowrap; }

.cant { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 11px; }
.f { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 0 1 110px; }
.f-chk { flex: 0 1 130px; }
.f-btn { flex: 0 0 auto; }
.lbl { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.check { display: flex; align-items: center; gap: 7px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-2); font-size: 12.5px; cursor: pointer; }
.check input { width: 16px; height: 16px; accent-color: var(--brand); }
.total { display: flex; align-items: center; height: 36px; padding: 0 11px; border-radius: var(--r-sm); background: var(--surface-2); font-size: 17px; font-weight: 700; color: var(--faint); }
.total.on { color: var(--brand); }

.confirmar { display: flex; align-items: center; gap: 12px; margin-bottom: 11px; padding: 10px 13px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); }
.esperado { display: flex; align-items: baseline; gap: 8px; flex: 1; }
.esperado b { font-size: 26px; color: var(--ink); }
.ud { font-size: 12px; color: var(--muted); }
.no-cuadra { color: var(--u-aviso); border-color: color-mix(in srgb, var(--u-aviso) 40%, transparent); }

.cerrar { display: flex; align-items: flex-end; gap: 10px; }
.f-ubic { flex: 1 1 auto; }
/* Angosto a proposito: es un numero de tres cifras, no un campo de texto. */
.f-cant { flex: 0 0 150px; }
.nada-link { align-self: flex-start; margin-top: 2px; padding: 0; background: none; border: none; font-size: 11.5px; font-weight: 600; color: var(--u-aviso); cursor: pointer; text-decoration: underline; }
/* La pregunta del sobrante: ancha, porque lleva nombres y es lo que no se puede pasar por alto. */
.f-dev { flex: 0 0 280px; }
.f-dev .field { border-color: var(--u-aviso); }
.sob-txt { color: var(--u-aviso); }
.chip-sob {
  align-self: flex-start;
  padding: 1px 7px;
  border: 1px solid var(--u-aviso);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--u-aviso);
}
.hint { display: flex; align-items: center; gap: 4px; font-size: 11px; }
.warn-txt { color: var(--u-aviso); }
.submit { height: 36px; white-space: nowrap; }

.acc { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--border); }
.acc-nota { font-size: 11px; color: var(--faint); flex: 1; }
.btn-link { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 3px 0; }
.btn-link:hover:not(:disabled) { color: var(--ink-2); }
.btn-link.danger:hover:not(:disabled) { color: var(--u-critico); }
.btn-link:disabled { opacity: .5; cursor: default; }

@media (max-width: 760px) {
  .cant { flex-direction: column; align-items: stretch; }
  .f, .f-chk, .f-btn { flex: 1 1 auto; }
  .cerrar { flex-direction: column; align-items: stretch; }
  .f-cant, .f-dev { flex: 1 1 auto; }
  .cerrar :deep(.field) { height: 46px; font-size: 16px; }
  .submit { height: 46px; justify-content: center; }
  .esperado b { font-size: 30px; }
}
</style>
