<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
import { usePausaOperativa } from '~/composables/usePausaOperativa'
const { revision: pausaRevision, pausa: pausaActual } = usePausaOperativa()
watch(pausaRevision, () => { void cargar() })
// Lo que el operario TIENE QUE HACER, no lo que ya hizo: su pantalla es una
// lista de trabajo, no un histórico.
//
// Las tareas vienen ordenadas por posición para recorrer el almacén una sola vez
// y en línea recta. El reloj de cada tarea arranca al ESCANEAR LA UBICACIÓN —no
// al abrirla— para medir caminar y bajar la mercancía, y no el rato que la
// pantalla estuvo abierta.
import { ref, computed, watch, nextTick } from 'vue'
import { ScanLine, CheckCircle2, MapPin, ArrowDown, Package, Flame, UserPlus, Undo2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { useSessionState } from '~/composables/useSession'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  compararPorPrioridad, cronometroTarea, fmtDuracionTarea,
  type MontajeResurtidoDTO, type PendienteDTO, type TareaResurtidoDTO,
} from '~/utils/resurtidoTareas'
import { API_MONTACARGAS, type Ayudante } from '~/utils/montacargas'
import { fmtKg, fmtM3 } from '~/utils/carga'

const props = defineProps<{ ahora: number }>()
// Un pendiente prioritario se hace desde su propia pestaña (su flujo es por
// PLU, no por ubicacion); aqui solo se muestra primero y se lleva alli.
const emit = defineEmits<{ (e: 'irAPendientes', destino: { id: string; pasar: boolean }): void }>()

const { show: showToast } = useToast()

const { me } = useSessionState()

const montajes = ref<MontajeResurtidoDTO[]>([])
const prioritarios = ref<PendienteDTO[]>([])
// Tareas de otro operario que le pasaron a este: las cierra el.
const recibidas = ref<TareaResurtidoDTO[]>([])
const loading = ref(true)
const guardando = ref<string | null>(null)
const abierta = ref<TareaResurtidoDTO | null>(null)

const escaneoUbic = ref('')
const escaneoPlu = ref('')
const unidades = ref('')
const pickingFinal = ref('')
const ubicInput = ref<HTMLInputElement | null>(null)
const pluInput = ref<HTMLInputElement | null>(null)

async function cargar() {
  // Un refresco automatico no pone el esqueleto: la pantalla no parpadea.
  if (!enRefrescoSilencioso()) loading.value = true
  try {
    const res = await $fetch<{
      data: MontajeResurtidoDTO[]; reasignados?: MontajeResurtidoDTO[]
      prioritarios: PendienteDTO[]; recibidas?: TareaResurtidoDTO[]
    }>('/api/resurtido-tareas')
    // Los reasignados por supervision se trabajan igual que los propios.
    montajes.value = [...res.data, ...(res.reasignados ?? [])]
    prioritarios.value = res.prioritarios ?? []
    recibidas.value = res.recibidas ?? []
    // Si la tarea abierta ya no existe (otro la completó o se borró el montaje),
    // se cierra sola en vez de dejar una pantalla que no lleva a ninguna parte.
    if (abierta.value) {
      const viva = [...todas.value, ...recibidas.value].find((t) => t.id === abierta.value!.id)
      abierta.value = viva && viva.estado !== 'COMPLETADA' && esMia(viva) ? viva : null
    }
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar tus tareas'), true)
  } finally {
    loading.value = false
  }
}
defineExpose({ cargar })

const todas = computed(() => montajes.value.flatMap((m) => m.tareas))

// De quien es el montaje de cada tarea: sin responsable, la tarea es del dueño.
const duenoDeTarea = computed(() => {
  const m = new Map<string, string>()
  for (const mont of montajes.value) for (const t of mont.tareas) m.set(t.id, mont.operarioId)
  return m
})
// Resurtidos de otro operario que supervision le reasigno a este.
const reasignados = computed(() => montajes.value
  .filter((m) => m.operarioId !== me.value?.id)
  .map((m) => ({
    id: m.id,
    de: m.operarioNombre ?? 'otro operario',
    archivo: m.nombreArchivo,
    faltan: m.tareas.filter((t) => t.estado !== 'COMPLETADA' && t.responsableId === me.value?.id).length,
  })))

// La tiene esta persona: se la pasaron o reasignaron, o es de su montaje y nadie
// la ha pasado. Las que paso a un ayudante siguen en su lista, pero ya no las
// puede abrir.
function esMia(t: TareaResurtidoDTO): boolean {
  if (t.responsableId) return t.responsableId === me.value?.id
  const dueno = duenoDeTarea.value.get(t.id)
  return !dueno || dueno === me.value?.id
}
// Lo prioritario primero; lo demas por la ruta, para no romper el recorrido.
const pendientes = computed(() =>
  todas.value.filter((t) => t.estado !== 'COMPLETADA').sort(compararPorPrioridad))
const progresoTotal = computed(() => {
  const total = todas.value.length
  const hechas = total - pendientes.value.length
  return { total, hechas, pct: total ? Math.round((hechas / total) * 100) : 0 }
})

function abrir(t: TareaResurtidoDTO, enfocarEscaneo = true) {
  if (!esMia(t)) return
  abierta.value = t
  pasando.value = false
  devolviendo.value = false
  ayudanteId.value = ''
  escaneoUbic.value = ''
  escaneoPlu.value = ''
  // Lo del archivo mas lo que se sumo de pendientes: es lo que tiene que bajar.
  unidades.value = String(t.unidadesSolicitadas + t.unidadesPendientes)
  // El picking llega SUGERIDO del archivo, pero se puede cambiar: el hueco real
  // manda sobre el papel.
  pickingFinal.value = t.pickingFinal ?? t.pickingSugerido
  if (!enfocarEscaneo) return
  void nextTick(() => {
    if (t.horaInicio) pluInput.value?.focus()
    else ubicInput.value?.focus()
  })
}

const enCurso = computed(() => Boolean(abierta.value?.horaInicio))

async function iniciar() {
  const t = abierta.value
  if (!t || !escaneoUbic.value.trim()) return
  guardando.value = t.id
  try {
    const res = await $fetch<{ data: TareaResurtidoDTO }>(
      `/api/resurtido-tareas/${t.id}/iniciar`,
      { method: 'POST', body: { ubicacion: escaneoUbic.value.trim() } },
    )
    abierta.value = res.data
    sonarVeredicto('VALIDO')
    await nextTick()
    pluInput.value?.focus()
  } catch (e) {
    sonarVeredicto('CAJA_AJENA')
    showToast(apiErr(e, 'No se pudo iniciar la tarea'), true)
  } finally {
    guardando.value = null
  }
}

const puedeCompletar = computed(() =>
  enCurso.value && escaneoPlu.value.trim().length > 0
  && Number(unidades.value) >= 1 && pickingFinal.value.trim().length > 0)

async function completar() {
  const t = abierta.value
  if (!t || !puedeCompletar.value) return
  guardando.value = t.id
  try {
    await $fetch<{ success: boolean }>(`/api/resurtido-tareas/${t.id}/completar`, {
      method: 'POST',
      body: {
        plu: escaneoPlu.value.trim(),
        unidadesBajadas: Number(unidades.value),
        pickingFinal: pickingFinal.value.trim(),
      },
    })
    sonarVeredicto('VALIDO')
    showToast('Tarea completada')
    abierta.value = null
    await cargar()
  } catch (e) {
    sonarVeredicto('CAJA_AJENA')
    showToast(apiErr(e, 'No se pudo completar la tarea'), true)
  } finally {
    guardando.value = null
  }
}

// ── Pasar a un ayudante ────────────────────────────────────────────
// Como en todos los procesos: quien la empezó (escaneó la ubicación) se la pasa
// a un ayudante y el reloj sigue; el ayudante escanea el PLU, baja y la cierra.
// Cada uno queda con su tramo. La tarea roja con un pendiente sumado también:
// el pendiente va con ella.
const pasando = ref(false)
const ayudantes = ref<Ayudante[]>([])
const ayudanteId = ref('')
const cargandoAyudantes = ref(false)
const otrasRef = ref<HTMLElement | null>(null)

async function abrirPaso() {
  pasando.value = true
  if (ayudantes.value.length || cargandoAyudantes.value) return
  cargandoAyudantes.value = true
  try {
    // La misma lista que al pasar un PLU; uno no se la pasa a sí mismo.
    const res = await $fetch<{ data: Ayudante[] }>(`${API_MONTACARGAS}/ayudantes`)
    ayudantes.value = res.data.filter((o) => o.id !== me.value?.id)
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar la lista de ayudantes'), true)
  } finally {
    cargandoAyudantes.value = false
  }
}

// Desde la lista, sin bajar hasta el final de la tarea ni abrir el teclado.
function pasarDesdeLista(t: TareaResurtidoDTO) {
  abrir(t, false)
  void abrirPaso()
  void nextTick(() => otrasRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

// ── No pudo almacenar ninguna ──────────────────────────────────────
// Quien la recibió se la devuelve ENTERA a quien se la pasó, con el reloj
// corriendo: su tramo se cierra y empieza el del otro, que la ubica.
const puedeDevolver = computed(() =>
  Boolean(abierta.value?.horaInicio && abierta.value.pasadoPorId
    && abierta.value.responsableId === me.value?.id && abierta.value.pasadoPorId !== me.value?.id))
const devolviendo = ref(false)

async function devolverTodo() {
  const t = abierta.value
  if (!t || !t.pasadoPorId) return
  guardando.value = t.id
  try {
    await $fetch<{ success: boolean }>(`/api/resurtido-tareas/${t.id}/traspasar`, {
      method: 'POST', body: { operarioId: t.pasadoPorId, devolucion: true },
    })
    showToast(`Devolviste las ${t.unidadesSolicitadas + t.unidadesPendientes} unidades a ${t.pasadoPorNombre ?? 'quien te la pasó'}`)
    abierta.value = null
    devolviendo.value = false
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo devolver la tarea'), true)
  } finally {
    guardando.value = null
  }
}

async function pasar() {
  const t = abierta.value
  if (!t || !ayudanteId.value) return
  guardando.value = t.id
  try {
    await $fetch<{ success: boolean }>(`/api/resurtido-tareas/${t.id}/traspasar`, {
      method: 'POST', body: { operarioId: ayudanteId.value },
    })
    const nombre = ayudantes.value.find((a) => a.id === ayudanteId.value)?.nombre ?? 'el ayudante'
    showToast(`Tarea pasada a ${nombre}`)
    abierta.value = null
    pasando.value = false
    ayudanteId.value = ''
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo pasar la tarea'), true)
  } finally {
    guardando.value = null
  }
}

watch(() => props.ahora, () => { /* el cronómetro se repinta solo */ })
const crono = computed(() =>
  abierta.value?.horaInicio ? cronometroTarea(abierta.value, props.ahora) : null)

cargar()

// Lo que asigna o reasigna supervision aparece solo. Con una tarea a medias
// (campos escaneados) no se refresca: hayEdicionEnCurso lo detecta.
useAutoRefresh({ onRefresh: () => cargar() })
</script>

<template>
  <div class="tareas">
    <ListSkeleton v-if="loading" />

    <EmptyState
      v-else-if="!todas.length && !prioritarios.length && !recibidas.length" title="Sin resurtido asignado"
      description="Cuando te monten un resurtido, tus tareas aparecerán aquí en orden de posición."
    />

    <template v-else>
      <!-- Avance del día -->
      <!-- Reasignado por supervision: no se alcanzo a terminar en el turno de otro. -->
      <p v-for="r in reasignados" :key="r.id" class="reasignado">
        <UserPlus :size="14" />
        <span>
          <b>Reasignado de {{ r.de }}</b> · {{ r.faltan }} tarea{{ r.faltan === 1 ? '' : 's' }} por terminar
          <span class="reasignado-archivo">{{ r.archivo }}</span>
        </span>
      </p>

      <div v-if="todas.length" class="resumen card">
        <div class="barra" role="progressbar" :aria-valuenow="progresoTotal.pct">
          <span class="barra-fill" :style="{ width: `${progresoTotal.pct}%` }" />
        </div>
        <p class="resumen-txt">
          <b class="tnum">{{ progresoTotal.hechas }}</b> de
          <b class="tnum">{{ progresoTotal.total }}</b> tareas
          <span class="pct tnum">{{ progresoTotal.pct }}%</span>
        </p>
      </div>

      <EmptyState
        v-if="!pendientes.length && !prioritarios.length && !recibidas.length" title="Resurtido terminado"
        description="Completaste todas las tareas asignadas."
      />

      <!-- Pendientes sueltos: van ANTES que todo el resurtido. Un pendiente es
           alguien esperando en la tienda. -->
      <ol v-if="prioritarios.length" class="lista">
        <li v-for="p in prioritarios" :key="p.id" class="fila">
          <button class="tarea card prio" @click="emit('irAPendientes', { id: p.id, pasar: false })">
            <span class="t-orden prio-ic"><Flame :size="14" /></span>
            <span class="t-cuerpo">
              <span class="t-etiq">Pendiente prioritario</span>
              <span class="t-desc">{{ p.descripcion }}</span>
              <span class="t-meta">
                <b class="mono">{{ p.plu }}</b> · {{ p.unidadesSolicitadas }} und ·
                pedido por {{ p.solicitadoPorNombre ?? 'gourmet' }}
              </span>
            </span>
            <span class="t-ir">Hacer ahora</span>
          </button>
          <!-- Sin resurtido de por medio, el pendiente tambien se puede pasar. -->
          <button class="btn btn-sm pasar-lista" type="button" @click="emit('irAPendientes', { id: p.id, pasar: true })">
            <UserPlus :size="14" /> Pasar a un ayudante
          </button>
        </li>
      </ol>

      <!-- Se las pasó otro operario: ya están en marcha, esta persona las cierra. -->
      <ol v-if="recibidas.length" class="lista">
        <li v-for="t in recibidas" :key="t.id" class="fila">
          <button class="tarea card activa" :class="{ prio: t.prioridad }" @click="abrir(t)">
            <span class="t-orden recibida-ic"><UserPlus :size="14" /></span>
            <span class="t-cuerpo">
              <span class="t-recibida">{{ t.pasadoPorNombre ?? 'Un compañero' }} te la pasó: tú la cierras</span>
              <span class="t-desc">{{ t.descripcion }}</span>
              <span class="t-meta">
                <b class="mono">{{ t.plu }}</b> · {{ t.unidadesSolicitadas + t.unidadesPendientes }} und
                <b v-if="t.unidadesPendientes" class="t-mas">(+{{ t.unidadesPendientes }} de pendiente)</b> ·
                a <span class="mono">{{ t.pickingSugerido }}</span>
                <span v-if="t.carga" class="t-carga">· {{ fmtKg(t.carga.kg) }} · {{ fmtM3(t.carga.m3) }}</span>
              </span>
            </span>
            <span v-if="t.horaInicio" class="t-crono tnum">{{ t.pausaId ? 'En pausa · ' : '' }}{{ cronometroTarea(t, ahora) }}</span>
          </button>
        </li>
      </ol>

      <!-- Lista de trabajo: lo prioritario primero, lo demás por la ruta -->
      <ol v-if="pendientes.length" class="lista">
        <li v-for="t in pendientes" :key="t.id" class="fila">
          <button
            class="tarea card" :class="{ activa: t.horaInicio && esMia(t), prio: t.prioridad, pasada: !esMia(t) }"
            :disabled="!esMia(t)" @click="abrir(t)"
          >
            <span v-if="t.prioridad" class="t-orden prio-ic"><Flame :size="14" /></span>
            <span v-else class="t-orden tnum">{{ t.orden }}</span>
            <span class="t-cuerpo">
              <span class="t-ubic"><MapPin :size="13" /> {{ t.altura }}</span>
              <span class="t-desc">{{ t.descripcion }}</span>
              <span class="t-meta">
                <b class="mono">{{ t.plu }}</b> · {{ t.unidadesSolicitadas + t.unidadesPendientes }} und
                <b v-if="t.unidadesPendientes" class="t-mas">(+{{ t.unidadesPendientes }} de pendiente)</b> ·
                a <span class="mono">{{ t.pickingSugerido }}</span>
                <span v-if="t.carga" class="t-carga">· {{ fmtKg(t.carga.kg) }} · {{ fmtM3(t.carga.m3) }}</span>
              </span>
              <span v-if="!esMia(t)" class="t-pasada">
                <UserPlus :size="11" /> Pasada a {{ t.responsableNombre ?? 'un ayudante' }}: la cierra él
              </span>
            </span>
            <span v-if="t.horaInicio" class="t-crono tnum">
              {{ t.pausaId ? 'En pausa · ' : '' }}{{ cronometroTarea(t, ahora) }}
            </span>
          </button>
          <!-- A la vista, como en pendientes. Solo con el reloj corriendo: se
               pasa lo que ya se tiene en la mano. -->
          <button
            v-if="esMia(t) && t.horaInicio" class="btn btn-sm pasar-lista" type="button"
            @click="pasarDesdeLista(t)"
          >
            <UserPlus :size="14" /> Pasar a un ayudante
          </button>
        </li>
      </ol>
    </template>

    <!-- Ejecución de una tarea -->
    <div v-if="abierta" v-show="!pausaActual" class="overlay" @click.self="abierta = null">
      <section class="card modal">
        <header class="m-head">
          <div>
            <h2 class="m-title">Tarea {{ abierta.orden }}</h2>
            <p class="m-sub">{{ abierta.descripcion }}</p>
          </div>
          <span v-if="crono" class="m-crono tnum">{{ crono }}</span>
          <button class="btn btn-sm" @click="abierta = null">Cerrar</button>
        </header>

        <div class="m-body">
          <PausaOperativa secundaria />
          <!-- Paso 1: escanear la ubicación arranca el reloj -->
          <section class="paso" :class="{ hecho: enCurso }">
            <h3 class="p-title"><MapPin :size="14" /> 1 · Ve a la ubicación y escanéala</h3>
            <p class="p-obj">{{ abierta.altura }}</p>
            <form v-if="!enCurso" class="p-form" @submit.prevent="iniciar">
              <input
                ref="ubicInput" v-model="escaneoUbic" class="field mono grande"
                placeholder="Escanea la ubicación" autocomplete="off"
                autocapitalize="characters" enterkeyhint="go" :disabled="guardando === abierta.id"
              >
              <button class="btn btn-primary" :disabled="!escaneoUbic.trim() || guardando === abierta.id">
                <Spinner v-if="guardando === abierta.id" :size="15" /><ScanLine v-else :size="15" />
                Empezar
              </button>
            </form>
            <template v-else>
              <p class="p-ok"><CheckCircle2 :size="13" /> Ubicación confirmada, el reloj corre</p>
              <!-- Se la pasaron ya empezada: el reloj no se reinició, le toca cerrarla. -->
              <p v-if="abierta.pasadoPorNombre && abierta.responsableId === me?.id" class="p-recibido">
                <UserPlus :size="13" /> {{ abierta.pasadoPorNombre }} te la pasó: tú la cierras
              </p>
            </template>
          </section>

          <!-- Paso 2: producto y cantidad -->
          <section class="paso" :class="{ off: !enCurso }">
            <h3 class="p-title"><Package :size="14" /> 2 · Escanea el producto y baja las unidades</h3>
            <form class="p-grid" @submit.prevent="completar">
              <label class="f">
                <span class="lbl">PLU (escanea)</span>
                <input
                  ref="pluInput" v-model="escaneoPlu" class="field mono"
                  :placeholder="abierta.plu" autocomplete="off" inputmode="numeric"
                  :disabled="!enCurso || guardando === abierta.id"
                >
              </label>
              <label class="f">
                <span class="lbl">Unidades que bajas</span>
                <input
                  v-model="unidades" class="field tnum" type="number" min="1" inputmode="numeric"
                  :disabled="!enCurso || guardando === abierta.id"
                >
                <span class="hint">
                  Solicitadas: {{ abierta.unidadesSolicitadas + abierta.unidadesPendientes }}
                  <template v-if="abierta.unidadesPendientes">
                    ({{ abierta.unidadesSolicitadas }} del resurtido + {{ abierta.unidadesPendientes }} de pendiente)
                  </template>
                </span>
              </label>
              <label class="f f-pick">
                <span class="lbl">Ubicación de picking</span>
                <input
                  v-model="pickingFinal" class="field mono" autocomplete="off"
                  autocapitalize="characters" :disabled="!enCurso || guardando === abierta.id"
                >
                <span class="hint">Sugerida por el archivo. Cámbiala si no cupo ahí.</span>
              </label>
              <div class="f f-btn">
                <button class="btn btn-primary submit" :disabled="!puedeCompletar || guardando === abierta.id">
                  <Spinner v-if="guardando === abierta.id" :size="15" /><ArrowDown v-else :size="15" />
                  Completar tarea
                </button>
              </div>
            </form>
            <p v-if="!enCurso" class="p-bloq">Escanea primero la ubicación.</p>
          </section>

          <!-- Pasársela a un ayudante para que la cierre. -->
          <section ref="otrasRef" class="otras">
            <!-- Se la pasaron y no cupo ninguna: vuelve entera a quien se la pasó. -->
            <div v-if="puedeDevolver && !pasando" class="devolver">
              <button v-if="!devolviendo" class="btn btn-sm dev-ok" type="button" @click="devolviendo = true">
                <Undo2 :size="13" /> No pude almacenar ninguna: devolver las {{ abierta.unidadesSolicitadas + abierta.unidadesPendientes }}
              </button>
              <template v-else>
                <p class="dev-pregunta">
                  ¿Devolver las {{ abierta.unidadesSolicitadas + abierta.unidadesPendientes }} unidades a <b>{{ abierta.pasadoPorNombre }}</b>? Le llega con el reloj corriendo para que las ubique.
                </p>
                <div class="dev-acc">
                  <button class="btn btn-sm" type="button" @click="devolviendo = false">Cancelar</button>
                  <button class="btn btn-sm dev-ok" type="button" :disabled="guardando === abierta.id" @click="devolverTodo">
                    <Spinner v-if="guardando === abierta.id" :size="13" /><Undo2 v-else :size="13" />
                    Devolver
                  </button>
                </div>
              </template>
            </div>
            <template v-if="!pasando && !devolviendo">
              <button v-if="enCurso" class="dev-link" type="button" @click="abrirPaso">
                <UserPlus :size="13" /> Pasar a un ayudante
              </button>
              <p v-else class="p-bloq">
                <UserPlus :size="12" /> Para pasarla a un ayudante, escanea primero la ubicación.
              </p>
            </template>
            <template v-else>
              <h3 class="p-title"><UserPlus :size="14" /> Pasar a un ayudante</h3>
              <select v-model="ayudanteId" class="field" :disabled="guardando === abierta.id || cargandoAyudantes">
                <option value="">{{ cargandoAyudantes ? 'Cargando…' : 'Elige a quién' }}</option>
                <option v-for="a in ayudantes" :key="a.id" :value="a.id">
                  {{ a.nombre }}{{ a.pendientes ? ` · ${a.pendientes} en curso` : '' }}
                </option>
              </select>
              <p v-if="!cargandoAyudantes && !ayudantes.length" class="hint">No hay nadie más activo a quien pasársela.</p>
              <p class="hint">El reloj sigue: tu tiempo se cierra y empieza el suyo. Él escanea el PLU, baja y la cierra.</p>
              <div class="dev-acc">
                <button class="btn btn-sm" type="button" @click="pasando = false">Cancelar</button>
                <button
                  class="btn btn-sm btn-primary" type="button"
                  :disabled="!ayudanteId || guardando === abierta.id" @click="pasar"
                >
                  <Spinner v-if="guardando === abierta.id" :size="13" /><UserPlus v-else :size="13" />
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
.tareas { display: flex; flex-direction: column; gap: 14px; }

.resumen { padding: 13px 16px; }
.reasignado {
  display: flex; align-items: center; gap: 9px; margin: 0; padding: 10px 14px; border-radius: var(--r-sm);
  font-size: 12.5px; color: var(--ink-2);
  background: color-mix(in srgb, var(--info) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
}
.reasignado > svg { color: var(--info); flex-shrink: 0; }
.reasignado b { color: var(--ink); }
.reasignado-archivo { margin-left: 6px; color: var(--faint); }
.barra { height: 9px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.barra-fill { display: block; height: 100%; border-radius: 99px; background: var(--brand-grad); transition: width .4s cubic-bezier(.16,1,.3,1); }
.resumen-txt { margin: 9px 0 0; font-size: 12.5px; color: var(--muted); }
.resumen-txt b { color: var(--ink); }
.pct { float: right; font-weight: 700; color: var(--brand); }

.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.fila { display: flex; align-items: stretch; gap: 8px; }
.fila .tarea { flex: 1; min-width: 0; }
.pasar-lista { flex-shrink: 0; height: auto; align-self: stretch; white-space: nowrap; }
@media (max-width: 560px) {
  .fila { flex-direction: column; }
  .pasar-lista { align-self: flex-end; height: 32px; }
}
.tarea {
  width: 100%; display: flex; align-items: center; gap: 13px; padding: 13px 15px;
  text-align: left; cursor: pointer; border: 1px solid var(--border);
  transition: transform .14s, border-color .14s, box-shadow .14s;
}
.tarea:hover { transform: translateY(-2px); border-color: var(--brand); box-shadow: var(--shadow-xs); }
.tarea.activa { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 10%, transparent); }
/* El numero de orden es la ruta: el operario va del 1 al ultimo sin pensar. */
.t-orden { flex-shrink: 0; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--surface-3); font-size: 12.5px; font-weight: 700; color: var(--muted); }
.t-cuerpo { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.t-ubic { display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--ink); }
.t-desc { font-size: 12.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-meta { font-size: 11.5px; color: var(--faint); }
.t-crono { flex-shrink: 0; font-family: var(--display); font-size: 15px; font-weight: 700; color: var(--brand); }

/* Prioridad: en rojo, para que se vea antes de leer nada. */
.tarea.prio {
  border-color: var(--u-critico); border-left-width: 4px;
  background: color-mix(in srgb, var(--u-critico) 6%, var(--surface));
}
.tarea.prio:hover { border-color: var(--u-critico); }
.prio-ic { background: var(--u-critico) !important; color: #fff !important; }
.t-etiq { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--u-critico); }
.t-ir { flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--u-critico); }
.t-mas { color: var(--u-critico); font-weight: 700; }

/* Pasada a un ayudante: sigue en la ruta, pero ya no es trabajo de esta persona. */
.tarea.pasada { opacity: .6; cursor: default; }
.tarea.pasada:hover { transform: none; border-color: var(--border); box-shadow: none; }
.t-pasada, .t-recibida { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--info); }
.t-recibida { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.recibida-ic { background: color-mix(in srgb, var(--info) 16%, transparent) !important; color: var(--info) !important; }
.p-recibido { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 12.5px; font-weight: 600; color: var(--info); }

.otras { padding-top: 4px; border-top: 1px dashed var(--border-strong); display: flex; flex-direction: column; gap: 8px; }
.dev-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; background: none; border: none; padding: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; align-self: flex-start; }
.dev-link:hover { color: var(--brand); }
.otras .p-bloq { display: flex; align-items: center; gap: 6px; }
.dev-acc { display: flex; gap: 9px; justify-content: flex-end; }
.devolver { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.devolver > .btn { align-self: flex-start; }
.dev-pregunta { margin: 0; font-size: 12.5px; color: var(--ink-2); }
.dev-ok { border-color: var(--u-aviso); color: var(--u-aviso); }

.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(10,15,28,.55); backdrop-filter: blur(3px); }
.modal { width: min(620px, 100%); max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.m-head { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--border); }
.m-head > div { flex: 1; min-width: 0; }
.m-title { margin: 0; font-family: var(--display); font-size: 16px; font-weight: 700; color: var(--ink); }
.m-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-crono { font-family: var(--display); font-size: 18px; font-weight: 800; color: var(--brand); }
.m-body { overflow-y: auto; padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 16px; }

.paso { padding: 14px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
.paso.hecho { border-color: color-mix(in srgb, var(--brand) 35%, var(--border)); background: var(--brand-tint); }
.paso.off { opacity: .55; }
.p-title { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
/* La ubicacion de destino, en grande: es lo que el operario lee de lejos. */
.p-obj { margin: 0 0 11px; font-family: var(--mono); font-size: 22px; font-weight: 700; letter-spacing: .02em; color: var(--ink); }
.p-form { display: flex; gap: 10px; }
.p-form .field { flex: 1; }
.grande { height: 46px; font-size: 17px; }
.p-ok { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 600; color: var(--brand); }
.p-bloq { margin: 9px 0 0; font-size: 12px; color: var(--faint); }

.p-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.f-pick, .f-btn { grid-column: 1 / -1; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { font-size: 11px; color: var(--faint); }
.submit { width: 100%; height: 44px; }

@media (max-width: 620px) {
  .p-grid { grid-template-columns: 1fr; }
  .p-form { flex-direction: column; }
  .m-body :deep(.field) { height: 44px; font-size: 16px; }
}
.t-carga { color: var(--muted); }
</style>
