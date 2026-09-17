<script setup lang="ts">
import { enRefrescoSilencioso, useAutoRefresh } from '~/composables/useAutoRefresh'
// Pendientes: operaciones gourmet pide mercancía a picking y almacenamiento la
// reparte.
//
// La misma pantalla sirve a los dos, con lo que cada uno necesita: quien pide ve
// SUS solicitudes y cuánto llevan esperando; quien reparte las ve todas y puede
// asignarlas. A ninguno de los dos se le mide tiempo de trabajo — pedir y
// repartir no es bajar mercancía.
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  RefreshCw, Plus, PackageSearch, UserPlus, CheckCircle2, Pencil, Undo2, X, Trash2, TriangleAlert, Layers,
} from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import {
  API_PENDIENTES, colorPendiente, cronometroDesde, ESTADO_PENDIENTE_LABEL,
  esSolicitante, fmtDuracionTarea, NOVEDAD_PENDIENTE_LABEL, puedeBorrarPendiente, puedeEditarPendiente,
  type NovedadPendiente, type PendienteDTO,
} from '~/utils/resurtidoTareas'
import { canSeeModule } from '~/utils/modulePermissions'

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

const puedeVer = computed(() => canSeeModule(me.value?.role, 'pendientes'))
// Pide gourmet, y tambien quien tiene el permiso de montar resurtido (Felipe
// Ossa, Eduardo), igual que el administrador.
const solicita = computed(() => esSolicitante(me.value?.role ?? '') || me.value?.can?.montarResurtido === true)
// Asignar es permiso por persona, igual que montar un resurtido.
const puedeAsignar = computed(() => me.value?.can?.montarResurtido === true)

const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  ensureSession()
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const items = ref<PendienteDTO[]>([])
const operarios = ref<{ id: string; nombre: string }[]>([])
const loading = ref(true)
const guardando = ref<string | null>(null)
const creando = ref(false)

// ── Nueva solicitud ────────────────────────────────────────────────
const plu = ref('')
const unidades = ref('')
const observacion = ref('')
const descripcion = ref('')
const buscando = ref(false)
const pluInput = ref<HTMLInputElement | null>(null)

// Lo que hay que saber antes de pedir: resurtido abierto o de las ultimas 2
// horas (pide confirmar) y si ya hay un pendiente del PLU al que se sumara.
interface ConsultaPlu {
  plu: string
  resurtido: {
    enCurso: { operarioNombre: string | null; unidades: number; iniciada: boolean; picking: string }[]
    reciente: { operarioNombre: string | null; completadaAt: string; unidadesBajadas: number | null; picking: string }[]
  }
  pendienteExistente: { id: string; estado: string; unidadesSolicitadas: number; operarioNombre: string | null; enResurtido: boolean } | null
  /** Si quien mira puede montarlo pese al resurtido (Felipe Ossa, Eduardo, admin). */
  puedeForzar: boolean
}
const consulta = ref<ConsultaPlu | null>(null)
const hayResurtido = computed(() => !!consulta.value && (consulta.value.resurtido.enCurso.length > 0 || consulta.value.resurtido.reciente.length > 0))
const confirmando = ref(false)
// Con resurtido en curso o reciente, operaciones gourmet no monta el pendiente:
// si el sistema dice resurtido y en el picking no esta, lo monta Felipe Ossa.
const bloqueado = computed(() => hayResurtido.value && consulta.value?.puedeForzar === false)
const horaCorta = (iso: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', timeStyle: 'short' }).format(new Date(iso))

const buscar = useDebounceFn(async () => {
  const codigo = plu.value.trim()
  consulta.value = null
  if (!codigo) { descripcion.value = ''; return }
  buscando.value = true
  $fetch<{ data: ConsultaPlu }>(`${API_PENDIENTES}/consulta`, { query: { plu: codigo } })
    .then((r) => { if (plu.value.trim() === codigo) consulta.value = r.data })
    .catch(() => { /* sin consulta se puede pedir igual; el servidor vuelve a mirar */ })
  try {
    const res = await $fetch<{ data: { descripcion: string | null } | null }>(
      '/api/productos-maestro/buscar', { query: { codigo } },
    )
    descripcion.value = res.data?.descripcion ?? ''
  } catch {
    descripcion.value = ''
  } finally {
    buscando.value = false
  }
}, 350)

const puedeCrear = computed(() =>
  !creando.value && !bloqueado.value && descripcion.value.length > 0 && Number(unidades.value) >= 1)

async function crear(confirmado = false) {
  if (!puedeCrear.value) return
  // Resurtido abierto o reciente: primero se confirma.
  if (hayResurtido.value && !confirmado) { confirmando.value = true; return }
  confirmando.value = false
  creando.value = true
  try {
    const res = await $fetch<{ data: PendienteDTO; sumado: boolean }>(API_PENDIENTES, {
      method: 'POST',
      body: {
        plu: plu.value.trim(),
        unidadesSolicitadas: Number(unidades.value),
        observacion: observacion.value.trim() || null,
        confirmarResurtido: confirmado || undefined,
      },
    })
    showToast(res.sumado
      ? `Se sumó al pendiente que ya existía: ahora son ${res.data.unidadesSolicitadas} unidades`
      : 'Pendiente solicitado')
    consulta.value = null
    plu.value = ''
    unidades.value = ''
    observacion.value = ''
    descripcion.value = ''
    await cargar()
    await nextTick()
    pluInput.value?.focus()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo solicitar'), true)
  } finally {
    creando.value = false
  }
}

// ── Datos ──────────────────────────────────────────────────────────
async function cargar() {
  // Un refresco automatico no pone el esqueleto: la pantalla no parpadea.
  if (!enRefrescoSilencioso()) loading.value = true
  try {
    const res = await $fetch<{ data: PendienteDTO[] }>(API_PENDIENTES)
    items.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los pendientes'), true)
  } finally {
    loading.value = false
  }
}

async function cargarOperarios() {
  // Quien pide tambien reparte lo suyo: sabe mejor que nadie cuanta prisa hay.
  if (!puedeAsignar.value && !solicita.value) return
  try {
    // De Pendientes, no de Montaje Resurtido: ese es solo de supervision y a
    // quien pide le respondia 403, con el selector vacio.
    const res = await $fetch<{ data: { id: string; nombre: string }[] }>(`${API_PENDIENTES}/operarios`)
    operarios.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar la lista de operarios'), true)
  }
}

onMounted(() => { void cargar() })
watch(() => me.value?.id, () => { void cargarOperarios() }, { immediate: true })

useAutoRefresh({
  onRefresh: () => {
    if (!puedeVer.value || creando.value || guardando.value) return
    return cargar()
  },
})

// ── Corregir lo pedido ─────────────────────────────────────────────
// Se puede corregir aunque YA ESTE ASIGNADO: el operario todavia no lo bajo, asi
// que cambiar la cantidad o el producto sigue sirviendo. Un pendiente ya ubicado
// no se toca: eso es historia.
const editando = ref<PendienteDTO | null>(null)
const edPlu = ref('')
const edUnidades = ref('')
const edObs = ref('')
const edDesc = ref('')
const edBuscando = ref(false)

const buscarEd = useDebounceFn(async () => {
  const codigo = edPlu.value.trim()
  if (!codigo) { edDesc.value = ''; return }
  edBuscando.value = true
  try {
    const res = await $fetch<{ data: { descripcion: string | null } | null }>(
      '/api/productos-maestro/buscar', { query: { codigo } },
    )
    edDesc.value = res.data?.descripcion ?? ''
  } catch {
    edDesc.value = ''
  } finally {
    edBuscando.value = false
  }
}, 350)

function abrirEdicion(p: PendienteDTO) {
  editando.value = p
  edPlu.value = p.plu
  edUnidades.value = String(p.unidadesSolicitadas)
  edObs.value = p.observacion ?? ''
  edDesc.value = p.descripcion
}

const puedeGuardarEd = computed(() =>
  Boolean(editando.value) && edDesc.value.length > 0 && Number(edUnidades.value) >= 1)

async function guardarEdicion() {
  const p = editando.value
  if (!p || !puedeGuardarEd.value) return
  guardando.value = p.id
  try {
    await $fetch(`${API_PENDIENTES}/${p.id}`, {
      method: 'PATCH',
      body: {
        plu: edPlu.value.trim(),
        unidadesSolicitadas: Number(edUnidades.value),
        observacion: edObs.value.trim() || null,
      },
    })
    showToast('Pendiente corregido')
    editando.value = null
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo corregir'), true)
  } finally {
    guardando.value = null
  }
}

// Asigna almacenamiento (permiso por persona) o quien lo pidio. Uno ya sumado a
// un resurtido no se reasigna: va con esa tarea.
function asignable(p: PendienteDTO): boolean {
  if (p.estado === 'COMPLETADO' || p.tareaResurtidoId) return false
  return puedeAsignar.value || esMio(p)
}

// Por id y no por nombre: dos personas con el mismo nombre se veian como la misma.
function esMio(p: PendienteDTO): boolean {
  return !!me.value?.id && p.solicitadoPorId === me.value.id
}

// Puede corregirlo quien lo pidio, mientras no se haya ubicado.
function editable(p: PendienteDTO): boolean {
  return esMio(p) && puedeEditarPendiente(p.estado)
}

// Borran quien lo pidio, almacenamiento con el permiso y el administrador. El
// servidor lo vuelve a comprobar.
function borrable(p: PendienteDTO): boolean {
  return puedeBorrarPendiente({
    estado: p.estado,
    esAdmin: me.value?.role === 'ADMIN',
    tienePermisoMontar: puedeAsignar.value,
    esQuienLoPidio: esMio(p),
  })
}

const borrando = ref<PendienteDTO | null>(null)
const borrandoGuardar = ref(false)
// Lo que pasa al borrar depende de donde este: se dice antes de confirmar.
const mensajeBorrar = computed(() => {
  const p = borrando.value
  if (!p) return ''
  const que = `Se borrará el pendiente de ${p.unidadesSolicitadas} de ${p.descripcion}.`
  if (p.estado === 'COMPLETADO') {
    return `${que} Ya se ubicó: al borrarlo, ese trabajo de ${p.operarioNombre ?? 'el operario'} deja de contar en sus indicadores. Por eso hay que escribir el motivo.`
  }
  if (p.tareaResurtidoId) {
    return `${que} Va dentro del resurtido de ${p.operarioNombre ?? 'un operario'}: a esa tarea se le restan esas unidades y se le avisa.`
  }
  if (p.operarioNombre && p.estado === 'EN_CURSO') {
    return `${que} ${p.operarioNombre} ya lo está bajando: sale de su lista y se le avisa.`
  }
  if (p.operarioNombre && p.estado === 'ASIGNADO') {
    return `${que} Está asignado a ${p.operarioNombre}: sale de su lista y se le avisa.`
  }
  return que
})

async function borrar(motivo: string) {
  const p = borrando.value
  if (!p) return
  borrandoGuardar.value = true
  try {
    await $fetch(`${API_PENDIENTES}/${p.id}`, { method: 'DELETE', body: { motivo: motivo || undefined } })
    showToast('Pendiente borrado')
    borrando.value = null
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo borrar el pendiente'), true)
  } finally {
    borrandoGuardar.value = false
  }
}

async function asignar(p: PendienteDTO, operarioId: string) {
  if (!operarioId) return
  guardando.value = p.id
  try {
    await $fetch(`${API_PENDIENTES}/${p.id}/asignar`, { method: 'POST', body: { operarioId } })
    showToast('Pendiente asignado')
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo asignar'), true)
  } finally {
    guardando.value = null
  }
}

// Lo que lleva esperando desde que se pidió: mide al sistema, no al operario.
function espera(p: PendienteDTO): string {
  if (p.completadoAt) return fmtDuracionTarea(p.esperaSegundos)
  return cronometroDesde(p.solicitadoAt, ahora.value) ?? '—'
}

const abiertos = computed(() => items.value.filter((p) => p.estado !== 'COMPLETADO'))
const cerrados = computed(() => items.value.filter((p) => p.estado === 'COMPLETADO'))
</script>

<template>
  <div class="mod">
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><PackageSearch :size="13" /></span>
          Gourmet · Picking
        </span>
        <h1 class="hero-title">Pendientes</h1>
        <p class="hero-desc">
          {{ solicita ? 'Pide mercancía a picking y sigue cuánto lleva esperando.'
            : 'Solicitudes de gourmet para repartir entre los operarios.' }}
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm" @click="cargar"><RefreshCw :size="14" /> Actualizar</button>
      </div>
    </section>

    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="Este módulo es para operaciones gourmet y supervisión de almacenamiento."
    />

    <template v-else>
      <!-- Solicitar: solo gourmet -->
      <section v-if="solicita" class="card nueva bloque">
        <label class="f f-plu">
          <span class="lbl">PLU</span>
          <input
            ref="pluInput" v-model="plu" class="field mono" placeholder="Escanea o escribe"
            autocomplete="off" inputmode="numeric" :disabled="creando" @input="buscar"
          >
        </label>
        <div class="f f-desc">
          <span class="lbl">Descripción</span>
          <div class="desc-box" :class="{ vacia: !descripcion }">
            <Spinner v-if="buscando" :size="13" />
            <span v-else-if="descripcion">{{ descripcion }}</span>
            <span v-else-if="plu.trim()">El PLU no existe en el maestro</span>
            <span v-else>Se completa sola</span>
          </div>
        </div>
        <label class="f f-und">
          <span class="lbl">Unidades</span>
          <input v-model="unidades" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="creando">
        </label>
        <label class="f f-obs">
          <span class="lbl">Observación (opcional)</span>
          <input v-model="observacion" class="field" maxlength="500" :disabled="creando">
        </label>
        <div class="f f-btn">
          <button class="btn btn-primary submit" :disabled="!puedeCrear" @click="crear()">
            <Spinner v-if="creando" :size="15" /><Plus v-else :size="15" />
            Solicitar
          </button>
        </div>

        <!-- Antes de pedir: resurtido abierto o reciente y pendiente al que se suma. -->
        <div v-if="consulta && (hayResurtido || consulta.pendienteExistente)" class="consulta">
          <p v-for="(t, i) in consulta.resurtido.enCurso" :key="`c${i}`" class="consulta-aviso">
            <TriangleAlert :size="14" />
            <span>
              <b>Resurtido en curso</b>: {{ t.unidades }} und con {{ t.operarioNombre ?? 'un operario' }}
              hacia <span class="mono">{{ t.picking }}</span> · {{ t.iniciada ? 'ya lo está bajando' : 'aún sin empezar' }}
            </span>
          </p>
          <p v-for="(t, i) in consulta.resurtido.reciente" :key="`r${i}`" class="consulta-aviso">
            <TriangleAlert :size="14" />
            <span>
              <b>Resurtido reciente</b>: {{ t.operarioNombre ?? 'Un operario' }} bajó {{ t.unidadesBajadas ?? '—' }} und
              a <span class="mono">{{ t.picking }}</span> a las {{ horaCorta(t.completadaAt) }}
            </span>
          </p>
          <p v-if="bloqueado" class="consulta-bloqueo">
            <TriangleAlert :size="14" />
            <span>
              <b>No puedes montar este pendiente</b>: el PLU ya fue resurtido. Si en el picking no está,
              pídele a <b>Felipe Ossa</b> que lo monte.
            </span>
          </p>
          <p v-if="consulta.pendienteExistente" class="consulta-suma">
            <Layers :size="14" />
            <span>
              Ya hay un pendiente de este PLU con <b>{{ consulta.pendienteExistente.unidadesSolicitadas }} und</b>
              {{ consulta.pendienteExistente.operarioNombre ? `asignado a ${consulta.pendienteExistente.operarioNombre}` : 'sin asignar' }}:
              tu solicitud se sumará a ese<template v-if="Number(unidades) >= 1"> (quedaría en {{ consulta.pendienteExistente.unidadesSolicitadas + Number(unidades) }} und)</template>.
            </span>
          </p>
        </div>
      </section>

      <ConfirmModal
        v-if="confirmando"
        title="¿Montarlo de todas formas?"
        :message="consulta?.resurtido.enCurso.length
          ? 'Este PLU tiene un resurtido en curso. Puede que la mercancía ya vaya en camino al picking.'
          : 'Este PLU se resurtió en las últimas 2 horas. Puede que ya haya mercancía en el picking.'"
        confirm-label="Montarlo igual" :confirming="creando"
        @close="confirmando = false" @confirm="crear(true)"
      />

      <ListSkeleton v-if="loading" />

      <template v-else>
        <h2 v-if="abiertos.length" class="sec">En curso</h2>
        <div v-if="abiertos.length" class="grid bloque">
          <article v-for="p in abiertos" :key="p.id" class="card vin" :class="`c-${colorPendiente(p.estado)}`">
            <header class="vin-top">
              <b class="mono vin-plu">{{ p.plu }}</b>
              <span class="estado" :class="`e-${colorPendiente(p.estado)}`">{{ ESTADO_PENDIENTE_LABEL[p.estado] }}</span>
            </header>
            <p class="vin-desc" :title="p.descripcion">{{ p.descripcion }}</p>
            <p class="vin-und"><b class="tnum">{{ p.unidadesSolicitadas }}</b> unidades solicitadas</p>
            <p v-if="p.observacion" class="vin-obs">{{ p.observacion }}</p>

            <dl class="vin-meta">
              <div>
                <dt>Esperando</dt>
                <dd class="tnum espera">{{ espera(p) }}</dd>
              </div>
              <div>
                <dt>Operario</dt>
                <dd>{{ p.operarioNombre ?? 'Sin asignar' }}</dd>
              </div>
            </dl>

            <!-- Novedad del operario: sin existencias, en inspeccion, en pasillo.
                 Queda en rojo hasta que alguien lo reasigne. -->
            <p v-if="p.estado === 'NOVEDAD' && p.tipoNovedad" class="vin-dev">
              <Undo2 :size="13" />
              {{ p.novedadPorNombre }}: {{ NOVEDAD_PENDIENTE_LABEL[p.tipoNovedad as NovedadPendiente] ?? p.tipoNovedad }}
            </p>

            <p v-if="p.tareaResurtidoId" class="vin-res">
              Va dentro del resurtido de {{ p.operarioNombre }}
            </p>

            <!-- Altura y picking sugeridos al asignar (sin cruce con el resurtido). -->
            <PendientesSugerencia v-if="p.sugerencia && !p.tareaResurtidoId" :sugerencia="p.sugerencia" compacto />

            <!-- Devuelto por el operario: no es un fallo suyo, el PLU no le
                 correspondia. Quien lo pidio decide si lo corrige o lo deja. -->
            <p v-if="p.estado === 'DEVUELTO'" class="vin-dev">
              <Undo2 :size="13" />
              {{ p.devueltoPorNombre }} lo devolvió — {{ p.motivoDevolucion }}
            </p>

            <div v-if="editable(p) || borrable(p)" class="vin-acc">
              <button v-if="editable(p)" class="vin-editar" @click="abrirEdicion(p)">
                <Pencil :size="12" /> Corregir
              </button>
              <button v-if="borrable(p)" class="vin-borrar" @click="borrando = p">
                <Trash2 :size="12" /> Borrar
              </button>
            </div>

            <!-- Asignar: almacenamiento o quien lo pidio -->
            <div v-if="asignable(p)" class="vin-asig">
              <select
                class="field field-sm" :disabled="guardando === p.id"
                @change="asignar(p, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">{{ p.operarioNombre ? 'Reasignar a…' : 'Asignar a…' }}</option>
                <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
              </select>
              <UserPlus :size="14" class="asig-ic" />
            </div>
          </article>
        </div>

        <h2 v-if="cerrados.length" class="sec">Ubicados</h2>
        <div v-if="cerrados.length" class="grid">
          <article v-for="p in cerrados" :key="p.id" class="card vin c-verde">
            <header class="vin-top">
              <b class="mono vin-plu">{{ p.plu }}</b>
              <span class="ok"><CheckCircle2 :size="13" /> Ubicado</span>
            </header>
            <p class="vin-desc" :title="p.descripcion">{{ p.descripcion }}</p>
            <p class="vin-und">
              <b class="tnum">{{ p.unidadesBajadas }}</b> de {{ p.unidadesSolicitadas }} en
              <span class="ubic">{{ p.ubicacionFinal }}</span>
            </p>
            <dl class="vin-meta">
              <div><dt>Espera total</dt><dd class="tnum">{{ fmtDuracionTarea(p.esperaSegundos) }}</dd></div>
              <div><dt>Lo bajó</dt><dd>{{ p.operarioNombre ?? '—' }}</dd></div>
            </dl>
            <!-- Solo el administrador, y con justificante. -->
            <div v-if="borrable(p)" class="vin-acc">
              <button class="vin-borrar" @click="borrando = p">
                <Trash2 :size="12" /> Borrar
              </button>
            </div>
          </article>
        </div>

        <EmptyState
          v-if="!items.length" title="Sin pendientes"
          :description="solicita ? 'Todavía no has solicitado nada.' : 'No hay solicitudes de gourmet.'"
        />
      </template>
    </template>

    <!-- Corregir un pendiente ya pedido -->
    <div v-if="editando" class="overlay" @click.self="editando = null">
      <section class="card modal">
        <header class="m-head">
          <h2 class="m-title">Corregir pendiente</h2>
          <button class="x" aria-label="Cerrar" @click="editando = null"><X :size="18" /></button>
        </header>
        <div class="m-body">
          <p v-if="editando.operarioNombre" class="m-aviso">
            Ya está asignado a <b>{{ editando.operarioNombre }}</b>. Si cambias algo, se le avisa.
          </p>
          <label class="f">
            <span class="lbl">PLU</span>
            <input v-model="edPlu" class="field mono" autocomplete="off" inputmode="numeric" @input="buscarEd">
          </label>
          <div class="f">
            <span class="lbl">Descripción</span>
            <div class="desc-box" :class="{ vacia: !edDesc }">
              <Spinner v-if="edBuscando" :size="13" />
              <span v-else-if="edDesc">{{ edDesc }}</span>
              <span v-else>El PLU no existe en el maestro</span>
            </div>
          </div>
          <label class="f">
            <span class="lbl">Unidades</span>
            <input v-model="edUnidades" class="field tnum" type="number" min="1" inputmode="numeric">
          </label>
          <label class="f">
            <span class="lbl">Observación</span>
            <input v-model="edObs" class="field" maxlength="500">
          </label>
          <button
            class="btn btn-primary submit"
            :disabled="!puedeGuardarEd || guardando === editando.id"
            @click="guardarEdicion"
          >
            <Spinner v-if="guardando === editando.id" :size="15" /><CheckCircle2 v-else :size="15" />
            Guardar cambios
          </button>
        </div>
      </section>
    </div>

    <PendientesBorrarModal
      v-if="borrando"
      :pendiente="borrando" :mensaje="mensajeBorrar" :guardando="borrandoGuardar"
      @close="borrando = null" @confirm="borrar"
    />
  </div>
</template>

<style scoped>
.mod { position: relative; }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); }
.bloque { margin-bottom: 18px; }
.sec { margin: 4px 0 11px; font-size: 12px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }

.nueva { display: grid; grid-template-columns: 130px 1fr 110px 1fr auto; gap: 12px; align-items: end; padding: 16px 18px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.desc-box { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 11px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-2); font-size: 13px; color: var(--ink-2); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.desc-box.vacia { color: var(--faint); }
.submit { height: 38px; padding: 0 18px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 14px; }
.vin { padding: 14px 16px 13px; display: flex; flex-direction: column; gap: 8px; }
/* Color por estado, para leer la pila de un vistazo:
   sin color = nadie lo tiene · amarillo = en proceso · verde = ubicado · rojo = novedad.
   Borde izquierdo grueso y fondo tenue: el color se ve, el texto se sigue leyendo. */
.vin { border-left-width: 4px; }
.vin.c-ninguno { border-left-color: var(--border-strong); }
.vin.c-amarillo { border-left-color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 6%, var(--surface)); }
.vin.c-verde { border-left-color: var(--brand); background: color-mix(in srgb, var(--brand) 6%, var(--surface)); }
.vin.c-rojo { border-left-color: var(--u-critico); background: color-mix(in srgb, var(--u-critico) 6%, var(--surface)); }
.estado { padding: 2px 9px; border-radius: var(--r-pill); font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.estado.e-ninguno { background: var(--surface-3); color: var(--muted); }
.estado.e-amarillo { background: var(--u-aviso-tint); color: color-mix(in srgb, var(--u-aviso) 80%, #000); }
.estado.e-verde { background: var(--brand-tint); color: var(--brand-deep); }
.estado.e-rojo { background: color-mix(in srgb, var(--u-critico) 14%, transparent); color: var(--u-critico); }
.vin-res { margin: 0; font-size: 12px; font-weight: 600; color: var(--u-critico); }
.vin-top { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
.vin-plu { font-size: 14px; font-weight: 700; color: var(--ink); }
.vin-desc { margin: 0; font-size: 12.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vin-und { margin: 0; font-size: 12.5px; color: var(--muted); }
.vin-und b { color: var(--ink); font-size: 14px; }
.vin-obs { margin: 0; font-size: 12px; color: var(--faint); font-style: italic; }
.ok { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--brand); }

.vin-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 2px 0 0; padding-top: 9px; border-top: 1px solid var(--border); }
.vin-meta dt { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); }
.vin-meta dd { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-2); }
/* El reloj de espera es lo que mira quien pidio: grande y en ambar cuando corre. */
.espera { font-family: var(--display); font-size: 15px; font-weight: 700; color: var(--u-aviso); }

.vin-asig { position: relative; margin-top: 4px; }
.field-sm { height: 34px; font-size: 12.5px; padding-right: 30px; }
.asig-ic { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.ubic { display: inline-block; padding: 1px 6px; border-radius: var(--r-xs); background: var(--surface-3); border: 1px solid var(--border); font-family: var(--mono); font-size: 11.5px; }

.vin-dev { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 8px 10px; border-radius: var(--r-sm); background: var(--u-aviso-tint); font-size: 12px; color: var(--ink-2); }
.vin-dev :deep(svg) { flex-shrink: 0; margin-top: 1px; color: var(--u-aviso); }
.vin-acc { display: flex; align-items: center; gap: 16px; }
.vin-borrar { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; padding: 0; font-size: 12.5px; font-weight: 600; color: var(--error); cursor: pointer; }
.vin-borrar:hover { text-decoration: underline; }
.vin-editar { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; background: none; border: none; padding: 0; font-size: 12.5px; font-weight: 600; color: var(--brand); cursor: pointer; }

.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,15,28,.55); backdrop-filter: blur(3px); }
.modal { width: min(440px, 100%); max-height: 88vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.m-head { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--border); }
.m-title { flex: 1; margin: 0; font-family: var(--display); font-size: 16px; font-weight: 700; color: var(--ink); }
.x { background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px; border-radius: var(--r-xs); }
.x:hover { background: var(--surface-3); color: var(--ink); }
.m-body { overflow-y: auto; padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 12px; }
.m-aviso { margin: 0; padding: 9px 11px; border-radius: var(--r-sm); background: var(--brand-tint); font-size: 12.5px; color: var(--ink-2); }
.submit { width: 100%; height: 42px; margin-top: 3px; }

@media (max-width: 900px) {
  .nueva { grid-template-columns: 1fr 1fr; }
  .f-obs, .f-btn { grid-column: 1 / -1; }
  .submit { width: 100%; height: 44px; }
  .hero-title { font-size: 24px; }
}
.consulta { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; }
.consulta-aviso, .consulta-suma { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 9px 12px; border-radius: var(--r-sm); font-size: 12.5px; color: var(--ink-2); }
.consulta-aviso { background: var(--u-aviso-tint); border: 1px solid color-mix(in srgb, var(--u-aviso) 40%, transparent); }
.consulta-aviso > svg { color: var(--u-aviso); flex-shrink: 0; margin-top: 1px; }
.consulta-bloqueo { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 9px 12px; border-radius: var(--r-sm); font-size: 12.5px; color: var(--ink-2); background: color-mix(in srgb, var(--error) 8%, transparent); border: 1px solid color-mix(in srgb, var(--error) 35%, transparent); }
.consulta-bloqueo > svg { color: var(--error); flex-shrink: 0; margin-top: 1px; }
.consulta-bloqueo b { color: var(--ink); }
.consulta-suma { background: color-mix(in srgb, var(--info) 8%, transparent); border: 1px solid color-mix(in srgb, var(--info) 30%, transparent); }
.consulta-suma > svg { color: var(--info); flex-shrink: 0; margin-top: 1px; }
.consulta b { color: var(--ink); }
</style>
