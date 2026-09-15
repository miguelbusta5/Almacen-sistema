<script setup lang="ts">
import { usePausaOperativa } from '~/composables/usePausaOperativa'
const { revision: pausaRevision, pausa: pausaActual } = usePausaOperativa()
watch(pausaRevision, () => { void cargar() })
// Los pendientes que le tocan al operario.
//
// Se ejecutan como un movimiento de depósito: el reloj arranca al ESCANEAR EL
// PLU Y LA UBICACIÓN INICIAL y se cierra al escribir la ubicación final. Quien
// lo empezó puede pasárselo a un ayudante para que lo cierre, y el reloj sigue:
// cada uno queda con su tramo. Al cerrarlo, el servidor avisa
// a quien lo pidió y a quien lo repartió — es justo el dato que estaban esperando.
import { ref, computed, nextTick, watch } from 'vue'
import { ScanLine, ArrowDown, Package, CheckCircle2, TriangleAlert, UserPlus, Undo2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_PENDIENTES, cronometroTarea, devuelveASolicitante, fmtDuracionTarea,
  NOVEDAD_PENDIENTE_LABEL, NOVEDADES_PENDIENTE, type NovedadPendiente, type PendienteDTO,
} from '~/utils/resurtidoTareas'
import { API_MONTACARGAS, type Ayudante } from '~/utils/montacargas'
import { useSessionState } from '~/composables/useSession'

const props = defineProps<{
  ahora: number
  /** Viene de la tarjeta roja de Resurtido: abrir ese pendiente, y si
   *  `pasar`, directo en "Pasar a un ayudante". */
  enfocar?: { id: string; pasar: boolean } | null
}>()
const emit = defineEmits<{ (e: 'enfocado'): void }>()

const { show: showToast } = useToast()

const items = ref<PendienteDTO[]>([])
const loading = ref(true)
const guardando = ref<string | null>(null)
const abierto = ref<PendienteDTO | null>(null)

const escaneoPlu = ref('')
const ubicacionInicial = ref('')
const ubicIniInput = ref<HTMLInputElement | null>(null)
const unidades = ref('')
const ubicacionFinal = ref('')
const pluInput = ref<HTMLInputElement | null>(null)
const ubicInput = ref<HTMLInputElement | null>(null)

async function cargar() {
  loading.value = true
  try {
    const res = await $fetch<{ data: PendienteDTO[] }>(`${API_PENDIENTES}/mis-tareas`)
    items.value = res.data
    if (abierto.value) {
      abierto.value = items.value.find((p) => p.id === abierto.value!.id) ?? null
    }
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar tus pendientes'), true)
  } finally {
    loading.value = false
  }
}
defineExpose({ cargar })

function abrir(p: PendienteDTO, enfocarEscaneo = true) {
  abierto.value = p
  escaneoPlu.value = ''
  ubicacionInicial.value = ''
  unidades.value = String(p.unidadesSolicitadas)
  ubicacionFinal.value = ''
  reportando.value = false
  pasando.value = false
  devolviendo.value = false
  if (!enfocarEscaneo) return
  void nextTick(() => {
    if (p.horaInicio) ubicInput.value?.focus()
    else pluInput.value?.focus()
  })
}

const enCurso = computed(() => Boolean(abierto.value?.horaInicio))
const crono = computed(() =>
  abierto.value?.horaInicio ? cronometroTarea(abierto.value, props.ahora) : null)

const puedeIniciar = computed(() => escaneoPlu.value.trim().length > 0 && ubicacionInicial.value.trim().length > 0)

// Enter en el PLU lleva a la ubicación inicial: la pistola escanea uno tras otro.
function siguienteAUbicacion() {
  if (!escaneoPlu.value.trim()) return
  if (!ubicacionInicial.value.trim()) { ubicIniInput.value?.focus(); return }
  void iniciar()
}

async function iniciar() {
  const p = abierto.value
  if (!p || !puedeIniciar.value) return
  guardando.value = p.id
  try {
    const res = await $fetch<{ data: PendienteDTO }>(`${API_PENDIENTES}/${p.id}/iniciar`, {
      method: 'POST',
      body: { plu: escaneoPlu.value.trim(), ubicacionInicial: ubicacionInicial.value.trim() },
    })
    abierto.value = res.data
    sonarVeredicto('VALIDO')
    await nextTick()
    ubicInput.value?.focus()
  } catch (e) {
    sonarVeredicto('CAJA_AJENA')
    showToast(apiErr(e, 'No se pudo iniciar'), true)
  } finally {
    guardando.value = null
  }
}

const puedeCompletar = computed(() =>
  enCurso.value && Number(unidades.value) >= 1 && ubicacionFinal.value.trim().length > 0)

async function completar() {
  const p = abierto.value
  if (!p || !puedeCompletar.value) return
  guardando.value = p.id
  try {
    await $fetch<{ success: boolean }>(`${API_PENDIENTES}/${p.id}/completar`, {
      method: 'POST',
      body: {
        unidadesBajadas: Number(unidades.value),
        ubicacionFinal: ubicacionFinal.value.trim(),
      },
    })
    sonarVeredicto('VALIDO')
    showToast('Pendiente ubicado. Ya avisamos a quien lo pidió.')
    abierto.value = null
    await cargar()
  } catch (e) {
    sonarVeredicto('CAJA_AJENA')
    showToast(apiErr(e, 'No se pudo completar'), true)
  } finally {
    guardando.value = null
  }
}

// ── Reportar una novedad ───────────────────────────────────────────
// Solo el area de muebles vuelve a quien lo pidio: no es un problema del
// deposito, se pidio al area equivocada. El resto se queda en almacenamiento, en
// rojo, para que alguien decida. En los dos casos el reloj se descarta.
const reportando = ref(false)
const novedad = ref<NovedadPendiente>('SIN_EXISTENCIAS')

async function reportar() {
  const p = abierto.value
  if (!p) return
  guardando.value = p.id
  try {
    await $fetch<{ success: boolean }>(`${API_PENDIENTES}/${p.id}/novedad`, {
      method: 'POST', body: { tipo: novedad.value },
    })
    showToast(devuelveASolicitante(novedad.value)
      ? 'Devuelto a quien lo pidió.'
      : 'Novedad reportada. Almacenamiento decide qué hacer.')
    abierto.value = null
    reportando.value = false
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo reportar'), true)
  } finally {
    guardando.value = null
  }
}

// ── Pasar a un ayudante ────────────────────────────────────────────
// El reloj es de quien lo termina: arranca cuando el ayudante escanea el PLU.
//
// La lista sale de /api/montacargas/ayudantes, la misma de pasar un PLU. Antes
// se pedia a Montaje Resurtido, que es solo para supervision: al operario le
// respondia 403, el error se tragaba en silencio y la lista quedaba vacia, asi
// que no habia a quien pasarselo.
const { me } = useSessionState()
const pasando = ref(false)
const ayudantes = ref<Ayudante[]>([])
const ayudanteId = ref('')
const cargandoAyudantes = ref(false)

async function abrirPaso() {
  pasando.value = true
  reportando.value = false
  if (ayudantes.value.length || cargandoAyudantes.value) return
  cargandoAyudantes.value = true
  try {
    const res = await $fetch<{ data: Ayudante[] }>(`${API_MONTACARGAS}/ayudantes`)
    // El servidor ya saca a quien pregunta: uno no se lo pasa a si mismo.
    ayudantes.value = res.data.filter((o) => o.id !== me.value?.id)
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar la lista de ayudantes'), true)
  } finally {
    cargandoAyudantes.value = false
  }
}

// Desde la lista, sin tener que abrir el pendiente y bajar hasta el final: la
// ventana va directo a la seccion, sin enfocar el escaner (en el celular
// abriria el teclado).
const otrasRef = ref<HTMLElement | null>(null)
function pasarDesdeLista(p: PendienteDTO) {
  abrir(p, false)
  void abrirPaso()
  void nextTick(() => otrasRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

// Llegar desde la tarjeta roja de Resurtido abre ese pendiente directamente.
watch([() => props.enfocar, items], ([destino]) => {
  if (!destino || loading.value) return
  const p = items.value.find((x) => x.id === destino.id)
  if (p) {
    if (destino.pasar) pasarDesdeLista(p)
    else abrir(p)
  }
  emit('enfocado')
}, { immediate: true })

// ── No pudo almacenar ninguna ──────────────────────────────────────
// Quien lo recibió se lo devuelve ENTERO a quien se lo pasó, con el reloj
// corriendo: su tramo se cierra y empieza el del otro, que lo ubica.
const puedeDevolver = computed(() =>
  Boolean(abierto.value?.horaInicio && abierto.value.pasadoPorId && abierto.value.pasadoPorId !== me.value?.id))
const devolviendo = ref(false)

async function devolverTodo() {
  const p = abierto.value
  if (!p || !p.pasadoPorId) return
  guardando.value = p.id
  try {
    await $fetch<{ success: boolean }>(`${API_PENDIENTES}/${p.id}/traspasar`, {
      method: 'POST', body: { operarioId: p.pasadoPorId, devolucion: true },
    })
    showToast(`Devolviste las ${p.unidadesSolicitadas} unidades a ${p.pasadoPorNombre ?? 'quien te lo pasó'}`)
    abierto.value = null
    devolviendo.value = false
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo devolver'), true)
  } finally {
    guardando.value = null
  }
}

async function pasar() {
  const p = abierto.value
  if (!p || !ayudanteId.value) return
  guardando.value = p.id
  try {
    await $fetch<{ success: boolean }>(`${API_PENDIENTES}/${p.id}/traspasar`, {
      method: 'POST', body: { operarioId: ayudanteId.value },
    })
    const nombre = ayudantes.value.find((a) => a.id === ayudanteId.value)?.nombre ?? 'el ayudante'
    showToast(`Pasado a ${nombre}`)
    abierto.value = null
    pasando.value = false
    ayudanteId.value = ''
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo pasar'), true)
  } finally {
    guardando.value = null
  }
}

cargar()
</script>

<template>
  <div class="pend">
    <ListSkeleton v-if="loading" />

    <EmptyState
      v-else-if="!items.length" title="Sin pendientes asignados"
      description="Cuando te asignen un pendiente de gourmet, aparecerá aquí."
    />

    <ol v-else class="lista">
      <li v-for="p in items" :key="p.id" class="fila">
        <button class="tarea card" :class="{ activa: p.horaInicio }" @click="abrir(p)">
          <span class="t-cuerpo">
            <span class="t-plu mono">{{ p.plu }}</span>
            <span class="t-desc">{{ p.descripcion }}</span>
            <span class="t-meta">
              {{ p.unidadesSolicitadas }} und · pedido por {{ p.solicitadoPorNombre ?? 'gourmet' }}
              <template v-if="p.pasadoPorNombre && p.horaInicio"> · te lo pasó {{ p.pasadoPorNombre }}</template>
            </span>
            <!-- De donde sacarlo y a donde llevarlo, segun el teorico vigente. -->
            <PendientesSugerencia v-if="p.sugerencia" :sugerencia="p.sugerencia" compacto class="t-sug" />
          </span>
          <span class="t-der">
            <span v-if="p.horaInicio" class="t-crono tnum">{{ p.pausaId ? 'En pausa · ' : '' }}{{ cronometroTarea(p, ahora) }}</span>
            <span v-else class="t-espera tnum">esperando {{ fmtDuracionTarea(p.esperaSegundos) }}</span>
          </span>
        </button>
        <!-- A la vista, no escondido al fondo de la ventana del pendiente. -->
        <button class="btn btn-sm pasar-lista" type="button" @click="pasarDesdeLista(p)">
          <UserPlus :size="14" /> Pasar a un ayudante
        </button>
      </li>
    </ol>

    <div v-if="abierto" v-show="!pausaActual" class="overlay" @click.self="abierto = null">
      <section class="card modal">
        <header class="m-head">
          <div>
            <h2 class="m-title mono">{{ abierto.plu }}</h2>
            <p class="m-sub">{{ abierto.descripcion }}</p>
          </div>
          <span v-if="crono" class="m-crono tnum">{{ crono }}</span>
          <button class="btn btn-sm" @click="abierto = null">Cerrar</button>
        </header>

        <div class="m-body">
          <!-- Sugerencia: se puede usar otra ubicacion, pero queda registrado. -->
          <PendientesSugerencia v-if="abierto.sugerencia" :sugerencia="abierto.sugerencia" />
          <PausaOperativa secundaria />
          <!-- Paso 1: el PLU arranca el reloj, igual que en movimientos -->
          <section class="paso" :class="{ hecho: enCurso }">
            <h3 class="p-title"><Package :size="14" /> 1 · Escanea el producto y la ubicación inicial</h3>
            <form v-if="!enCurso" class="p-form p-form-2" @submit.prevent="iniciar">
              <label class="f">
                <span class="lbl">PLU</span>
                <input
                  ref="pluInput" v-model="escaneoPlu" class="field mono grande"
                  :placeholder="abierto.plu" autocomplete="off" inputmode="numeric"
                  enterkeyhint="next" :disabled="guardando === abierto.id"
                  @keydown.enter.prevent="siguienteAUbicacion"
                >
              </label>
              <label class="f">
                <span class="lbl">Ubicación inicial</span>
                <input
                  ref="ubicIniInput" v-model="ubicacionInicial" class="field mono grande"
                  :placeholder="abierto.sugerencia?.alturas[0]?.ubicacion ?? 'De dónde lo sacas'" autocomplete="off" autocapitalize="characters"
                  enterkeyhint="go" :disabled="guardando === abierto.id"
                >
              </label>
              <button class="btn btn-primary" :disabled="!puedeIniciar || guardando === abierto.id">
                <Spinner v-if="guardando === abierto.id" :size="15" /><ScanLine v-else :size="15" />
                Empezar
              </button>
            </form>
            <template v-else>
              <p class="p-ok">
                <CheckCircle2 :size="13" /> Producto confirmado{{ abierto.ubicacionInicial ? ` en ${abierto.ubicacionInicial}` : '' }}, el reloj corre
              </p>
              <!-- Se lo pasaron ya empezado: el reloj no se reinicio, le toca ubicarlo. -->
              <p v-if="abierto.pasadoPorNombre" class="p-recibido">
                <UserPlus :size="13" /> {{ abierto.pasadoPorNombre }} te lo pasó: tú lo ubicas y cierras
              </p>
            </template>
          </section>

          <!-- Paso 2: unidades y ubicación final -->
          <section class="paso" :class="{ off: !enCurso }">
            <h3 class="p-title"><ArrowDown :size="14" /> 2 · Baja y ubica</h3>
            <form class="p-grid" @submit.prevent="completar">
              <label class="f">
                <span class="lbl">Unidades que bajas</span>
                <input
                  v-model="unidades" class="field tnum" type="number" min="1" inputmode="numeric"
                  :disabled="!enCurso || guardando === abierto.id"
                >
                <span class="hint">Solicitadas: {{ abierto.unidadesSolicitadas }}</span>
              </label>
              <label class="f">
                <span class="lbl">Ubicación final</span>
                <input
                  ref="ubicInput" v-model="ubicacionFinal" class="field mono"
                  placeholder="05-B-25-03-01" autocomplete="off" autocapitalize="characters"
                  enterkeyhint="done" :disabled="!enCurso || guardando === abierto.id"
                >
              </label>
              <div class="f f-btn">
                <button class="btn btn-primary submit" :disabled="!puedeCompletar || guardando === abierto.id">
                  <Spinner v-if="guardando === abierto.id" :size="15" /><CheckCircle2 v-else :size="15" />
                  Ubicar y avisar
                </button>
              </div>
            </form>
            <p v-if="!enCurso" class="p-bloq">Escanea primero el producto.</p>
          </section>

          <!-- No lo puede bajar, o se lo pasa a otro. -->
          <section ref="otrasRef" class="otras">
            <!-- Se lo pasaron y no cupo ninguna: vuelve entero a quien se lo pasó. -->
            <div v-if="puedeDevolver && !reportando && !pasando" class="devolver">
              <button v-if="!devolviendo" class="btn btn-sm dev-ok" type="button" @click="devolviendo = true">
                <Undo2 :size="13" /> No pude almacenar ninguna: devolver las {{ abierto.unidadesSolicitadas }}
              </button>
              <template v-else>
                <p class="dev-pregunta">
                  ¿Devolver las {{ abierto.unidadesSolicitadas }} unidades a <b>{{ abierto.pasadoPorNombre }}</b>? Le llega con el reloj corriendo para que las ubique.
                </p>
                <div class="dev-acc">
                  <button class="btn btn-sm" type="button" @click="devolviendo = false">Cancelar</button>
                  <button class="btn btn-sm dev-ok" type="button" :disabled="guardando === abierto.id" @click="devolverTodo">
                    <Spinner v-if="guardando === abierto.id" :size="13" /><Undo2 v-else :size="13" />
                    Devolver
                  </button>
                </div>
              </template>
            </div>

            <div v-if="!reportando && !pasando && !devolviendo" class="otras-acc">
              <button class="dev-link" @click="reportando = true; pasando = false">
                <TriangleAlert :size="13" /> Reportar novedad
              </button>
              <button class="dev-link" @click="abrirPaso">
                <UserPlus :size="13" /> Pasar a un ayudante
              </button>
            </div>

            <template v-if="reportando">
              <h3 class="p-title"><TriangleAlert :size="14" /> ¿Qué encontraste?</h3>
              <div class="dev-motivos">
                <button
                  v-for="n in NOVEDADES_PENDIENTE" :key="n" type="button" class="dev-btn"
                  :class="{ on: novedad === n }" @click="novedad = n"
                >
                  {{ NOVEDAD_PENDIENTE_LABEL[n] }}
                  <span v-if="devuelveASolicitante(n)" class="dev-nota">vuelve a quien lo pidió</span>
                </button>
              </div>
              <div class="dev-acc">
                <button class="btn btn-sm" @click="reportando = false">Cancelar</button>
                <button class="btn btn-sm dev-ok" :disabled="guardando === abierto.id" @click="reportar">
                  <Spinner v-if="guardando === abierto.id" :size="13" /><TriangleAlert v-else :size="13" />
                  Reportar
                </button>
              </div>
            </template>

            <template v-if="pasando">
              <h3 class="p-title"><UserPlus :size="14" /> Pasar a un ayudante</h3>
              <select v-model="ayudanteId" class="field" :disabled="guardando === abierto.id || cargandoAyudantes">
                <option value="">{{ cargandoAyudantes ? 'Cargando…' : 'Elige a quién' }}</option>
                <option v-for="a in ayudantes" :key="a.id" :value="a.id">
                  {{ a.nombre }}{{ a.pendientes ? ` · ${a.pendientes} en curso` : '' }}
                </option>
              </select>
              <p v-if="!cargandoAyudantes && !ayudantes.length" class="hint">No hay nadie más activo a quien pasárselo.</p>
              <p class="hint">Su reloj empieza cuando escanee el PLU.</p>
              <div class="dev-acc">
                <button class="btn btn-sm" @click="pasando = false">Cancelar</button>
                <button class="btn btn-sm btn-primary" :disabled="!ayudanteId || guardando === abierto.id" @click="pasar">
                  <Spinner v-if="guardando === abierto.id" :size="13" /><UserPlus v-else :size="13" />
                  Pasar
                </button>
              </div>
            </template>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pend { display: flex; flex-direction: column; gap: 14px; }
.p-form.p-form-2 { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
.p-form-2 .f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.p-recibido { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 12.5px; font-weight: 600; color: var(--info); }
@media (max-width: 560px) { .p-form.p-form-2 { grid-template-columns: 1fr; } }
.fila { display: flex; align-items: stretch; gap: 8px; }
.t-sug { margin-top: 5px; }
.fila .tarea { flex: 1; min-width: 0; }
.pasar-lista { flex-shrink: 0; height: auto; align-self: stretch; white-space: nowrap; }
@media (max-width: 560px) {
  .fila { flex-direction: column; }
  .pasar-lista { align-self: flex-end; height: 32px; }
}
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.tarea {
  width: 100%; display: flex; align-items: center; gap: 13px; padding: 13px 15px;
  text-align: left; cursor: pointer; border: 1px solid var(--border);
  transition: transform .14s, border-color .14s, box-shadow .14s;
}
.tarea:hover { transform: translateY(-2px); border-color: var(--brand); box-shadow: var(--shadow-xs); }
.tarea.activa { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 10%, transparent); }
.t-cuerpo { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.t-plu { font-size: 15px; font-weight: 700; color: var(--ink); }
.t-desc { font-size: 12.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-meta { font-size: 11.5px; color: var(--faint); }
.t-der { flex-shrink: 0; text-align: right; }
.t-crono { font-family: var(--display); font-size: 15px; font-weight: 700; color: var(--brand); }
/* Lo que lleva esperando gourmet: en ambar, porque es deuda, no trabajo hecho. */
.t-espera { font-size: 11.5px; color: var(--u-aviso); }

.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(10,15,28,.55); backdrop-filter: blur(3px); }
.modal { width: min(560px, 100%); max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.m-head { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--border); }
.m-head > div { flex: 1; min-width: 0; }
.m-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.m-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-crono { font-family: var(--display); font-size: 18px; font-weight: 800; color: var(--brand); }
.m-body { overflow-y: auto; padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 16px; }

.paso { padding: 14px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
.paso.hecho { border-color: color-mix(in srgb, var(--brand) 35%, var(--border)); background: var(--brand-tint); }
.paso.off { opacity: .55; }
.p-title { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.p-form { display: flex; gap: 10px; }
.p-form .field { flex: 1; }
.grande { height: 46px; font-size: 17px; }
.p-ok { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 600; color: var(--brand); }
.p-bloq { margin: 9px 0 0; font-size: 12px; color: var(--faint); }

.p-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.f-btn { grid-column: 1 / -1; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { font-size: 11px; color: var(--faint); }
.submit { width: 100%; height: 44px; }

.otras { padding-top: 4px; border-top: 1px dashed var(--border-strong); }
.otras-acc { display: flex; flex-wrap: wrap; gap: 16px; }
.dev-nota { display: block; margin-top: 2px; font-size: 11px; font-weight: 500; color: var(--u-critico); }
.dev-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; background: none; border: none; padding: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; }
.dev-link:hover { color: var(--u-aviso); }
.devolver { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.devolver > .btn { align-self: flex-start; }
.dev-pregunta { margin: 0; font-size: 12.5px; color: var(--ink-2); }
.dev-motivos { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.dev-btn { padding: 9px 12px; text-align: left; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; }
.dev-btn:hover:not(.on) { color: var(--ink-2); border-color: var(--faint); }
.dev-btn.on { background: var(--u-aviso-tint); border-color: var(--u-aviso); color: var(--ink); }
.dev-detalle { margin-bottom: 10px; }
.dev-acc { display: flex; gap: 9px; justify-content: flex-end; }
.dev-ok { border-color: var(--u-aviso); color: var(--u-aviso); }

@media (max-width: 560px) {
  .p-grid { grid-template-columns: 1fr; }
  .p-form { flex-direction: column; }
  .m-body :deep(.field) { height: 44px; font-size: 16px; }
}
</style>
