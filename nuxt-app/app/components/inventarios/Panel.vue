<script setup lang="ts">
// Conteo cíclico Gourmet.
//
// La pantalla está armada alrededor del escaneo: el operario llega a la
// estantería, dispara la pistola sobre la ubicación y la app lo mete directo a
// contar. La lista de abajo es el respaldo para buscar a mano — con 2.106
// ubicaciones asignadas, elegir de una lista es justo lo que no funcionaba.
//
// Al terminar una ubicación el foco vuelve al campo de escaneo: camina, escanea,
// cuenta, y así. Nunca tiene que tocar la pantalla para enfocar.
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ClipboardCheck, ScanLine, RefreshCw, Search, Loader2, Check } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_INVENTARIOS, ESTADO_TAREA_LABEL, MOTIVO_UBICACION, tiempoTarea,
  type CicloDetalle, type CicloResumen, type TareaInventarioDTO,
} from '~/utils/inventario'

const { me } = useSessionState()
const { show } = useToast()
const gestor = computed(() => !!me.value?.can.gestionarInventarios)
const permitido = computed(() => gestor.value || !!me.value?.can.contarInventarios)

const tab = ref<'ciclos' | 'maestro'>('ciclos')
const ciclos = ref<CicloResumen[]>([])
const actual = ref<CicloDetalle | null>(null)
const tarea = ref<TareaInventarioDTO | null>(null)
const producto = ref<{ plu: string; descripcion: string } | null>(null)
const operarios = ref<Array<{ id: string; name: string }>>([])
const cronogramas = ref<any[]>([])

const cargando = ref(true)
const guardando = ref(false)
const nuevo = ref(false)
const nombre = ref('')
const cronogramaId = ref('')
const archivo = ref<File | null>(null)
const solicitudId = ref('')

const escaneo = ref('')
const busca = ref('')
const soloPendientes = ref(true)
const inputEscaneo = ref<HTMLInputElement | null>(null)
const captura = ref<{ limpiarCaptura: () => void; enfocarCodigo: () => void } | null>(null)

const ahora = ref(Date.now())
let reloj: ReturnType<typeof setInterval> | null = null

const esMia = computed(() => !!tarea.value && tarea.value.usuarioId === me.value?.id)
const persona = (id: string | null) =>
  actual.value?.personas.find((p) => p.id === id)?.name
  ?? operarios.value.find((p) => p.id === id)?.name
  ?? 'Sin asignar'

const fallo = (e: any, porDefecto = 'No se pudo completar. Intenta de nuevo.') => {
  show(e?.data?.statusMessage ?? e?.message ?? porDefecto, true)
  sonarVeredicto('CAJA_AJENA')
}

async function enfocarEscaneo() {
  await nextTick()
  inputEscaneo.value?.focus()
}

// ── Carga ──
async function lista() {
  try {
    const r = await $fetch<{ ciclos: CicloResumen[] }>(`${API_INVENTARIOS}/ciclos`)
    ciclos.value = r.ciclos
  } catch (e) { fallo(e, 'No se pudieron cargar los cíclicos') }
}

async function abrir(id: string, opciones: { pagina?: number } = {}) {
  try {
    actual.value = await $fetch<CicloDetalle>(`${API_INVENTARIOS}/ciclos`, {
      query: {
        id,
        ...(gestor.value ? { detalle: '1' } : {}),
        ...(busca.value.trim() ? { q: busca.value.trim() } : {}),
        ...(soloPendientes.value && !gestor.value ? { estado: 'PENDIENTE' } : {}),
        page: opciones.pagina ?? 1,
        pageSize: 50,
      },
    })
  } catch (e) { fallo(e, 'No se pudo abrir el cíclico') }
}

/** Trae UNA ubicación con sus PLU esperados y lo ya contado. */
async function traerTarea(query: Record<string, string>) {
  const r = await $fetch<{ tarea: TareaInventarioDTO }>(`${API_INVENTARIOS}/tarea`, {
    query: { cicloId: actual.value!.id, ...query },
  })
  tarea.value = r.tarea
  producto.value = null
}

// ── Escaneo: el camino normal del operario ──
async function escanear() {
  const texto = escaneo.value.trim()
  if (!texto || !actual.value || guardando.value) return
  guardando.value = true
  try {
    await traerTarea({ ubicacion: texto })
    escaneo.value = ''
    sonarVeredicto('VALIDO')
  } catch (e: any) {
    const msg = e?.data?.statusMessage
    fallo(e, msg && Object.values(MOTIVO_UBICACION).includes(msg) ? msg : 'No se encontró esa ubicación')
    escaneo.value = ''
    await enfocarEscaneo()
    return
  } finally { guardando.value = false }

  // Si estaba sin empezar se inicia sola: ya escaneó la ubicación, y pedirle que
  // la vuelva a escanear dentro sería el mismo gesto dos veces. Va fuera del
  // bloque de arriba porque `accion` también toma el candado de `guardando`.
  if (tarea.value?.estado === 'PENDIENTE' && tarea.value.usuarioId === me.value?.id) {
    const ok = await accion('iniciar', { ubicacion: tarea.value.ubicacion })
    if (ok) captura.value?.enfocarCodigo()
  }
}

async function elegir(t: TareaInventarioDTO) {
  try { await traerTarea({ tareaId: t.id }) } catch (e) { fallo(e) }
}

async function cerrarCaptura() {
  tarea.value = null
  producto.value = null
  if (actual.value) await abrir(actual.value.id)
  await enfocarEscaneo()
}

// ── Acciones sobre la ubicación abierta ──
async function accion(nombreAccion: string, extra: Record<string, unknown> = {}) {
  if (!actual.value || guardando.value) return false
  guardando.value = true
  try {
    await $fetch(`${API_INVENTARIOS}/accion`, {
      method: 'POST',
      body: {
        accion: nombreAccion,
        cicloId: actual.value.id,
        ...(tarea.value ? { tareaId: tarea.value.id, revision: tarea.value.revision } : {}),
        ...extra,
      },
    })
    if (tarea.value) await traerTarea({ tareaId: tarea.value.id })
    return true
  } catch (e) { fallo(e); return false } finally { guardando.value = false }
}

async function consultar(codigo: string) {
  if (!codigo.trim() || !tarea.value) return
  guardando.value = true
  producto.value = null
  try {
    producto.value = await $fetch<{ plu: string; descripcion: string }>('/api/inventarios/producto', {
      query: { tareaId: tarea.value.id, codigo: codigo.trim() },
    })
    sonarVeredicto('VALIDO')
  } catch (e) { fallo(e) } finally { guardando.value = false }
}

async function guardar(datos: { cajas: number; empaque: number; reguero: number; teoricoActual: number | null }) {
  const ok = await accion('guardar', { codigo: producto.value?.plu, ...datos })
  if (ok) {
    borrarBorrador()
    captura.value?.limpiarCaptura()
    sonarVeredicto('VALIDO')
    captura.value?.enfocarCodigo()
  }
}

async function terminar() {
  const ok = await accion('terminar')
  if (ok) {
    borrarBorrador()
    show('Ubicación terminada. Escanea la siguiente.')
    sonarVeredicto('VALIDO')
    await cerrarCaptura()
  }
}

// El borrador de una ubicación ya cerrada no sirve, y hasta el 22-09 se quedaba
// guardado para siempre en el equipo.
function borrarBorrador() {
  try { localStorage.removeItem(`inventario-borrador:${me.value?.id}:${tarea.value?.id}`) } catch { /* equipo sin storage */ }
}

// ── Gestor: crear cíclico ──
async function preparar() {
  try {
    // Tipado explícito: con la plantilla suelta, las rutas tipadas de Nuxt se
    // quedan sin profundidad al resolver el tipo.
    cronogramas.value = await $fetch<any[]>('/api/inventarios')
    nuevo.value = true
    solicitudId.value = crypto.randomUUID()
  } catch (e) { fallo(e) }
}

async function crear() {
  if (!archivo.value || guardando.value) return
  guardando.value = true
  try {
    const body = new FormData()
    body.append('archivo', archivo.value)
    body.append('nombre', nombre.value)
    body.append('cronogramaId', cronogramaId.value)
    body.append('solicitudId', solicitudId.value)
    const r = await $fetch<{ id: string }>(`${API_INVENTARIOS}/ciclos`, { method: 'POST', body })
    nuevo.value = false
    await abrir(r.id)
    await lista()
    show('Cíclico creado con sus ubicaciones')
  } catch (e) { fallo(e) } finally { guardando.value = false }
}

async function descargar() {
  try {
    const blob = await $fetch<Blob>(`${API_INVENTARIOS}/cierre`, { query: { id: actual.value!.id }, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Cierre-${actual.value!.nombre}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) { fallo(e) }
}

let esperaBusca: ReturnType<typeof setTimeout> | null = null
watch([busca, soloPendientes], () => {
  if (esperaBusca) clearTimeout(esperaBusca)
  esperaBusca = setTimeout(() => { if (actual.value) void abrir(actual.value.id) }, 300)
})

onMounted(async () => {
  await ensureSession()
  if (permitido.value) {
    await lista()
    if (gestor.value) {
      try { operarios.value = await $fetch<Array<{ id: string; name: string }>>('/api/inventarios/operarios') } catch (e) { fallo(e) }
    }
  }
  cargando.value = false
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
})
onUnmounted(() => { if (reloj) clearInterval(reloj) })
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><ClipboardCheck :size="13" /></span>
          CEDI · Gourmet
        </span>
        <h1 class="hero-title">Conteo cíclico</h1>
        <p class="hero-desc">
          {{ gestor
            ? 'Carga el teórico, reparte las ubicaciones y revisa las diferencias.'
            : 'Escanea la ubicación y registra lo que encuentres. Una ubicación a la vez.' }}
        </p>
      </div>
      <div class="hero-acciones">
        <button v-if="gestor" class="btn btn-sm" :disabled="guardando" @click="preparar">Nuevo cíclico</button>
        <button v-if="actual" class="btn btn-ghost btn-sm" @click="actual = null; tarea = null; lista()">Volver a cíclicos</button>
        <button class="btn btn-ghost btn-sm" :disabled="guardando" @click="actual ? abrir(actual.id) : lista()">
          <RefreshCw :size="14" /> Actualizar
        </button>
      </div>
    </section>

    <nav v-if="gestor" class="tabs" aria-label="Secciones de inventarios">
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'ciclos' }" @click="tab = 'ciclos'">Cíclicos</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'maestro' }" @click="tab = 'maestro'">Cronogramas y maestro PVP</button>
    </nav>

    <InventariosModule v-if="tab === 'maestro' && gestor" />

    <template v-else>
      <p v-if="!permitido" class="vacio">No tienes acceso a Inventarios.</p>

      <template v-else>
        <form v-if="nuevo" class="card crear" @submit.prevent="crear">
          <h2 class="s-titulo">Crear conteo</h2>
          <div class="crear-campos">
            <label class="campo">
              <span class="campo-label">Cronograma</span>
              <select v-model="cronogramaId" class="field" required>
                <option value="">Selecciona</option>
                <option v-for="c in cronogramas.filter((x: any) => x.estado === 'ABIERTO')" :key="c.id" :value="c.id">{{ c.nombre }}</option>
              </select>
            </label>
            <label class="campo">
              <span class="campo-label">Nombre del cíclico</span>
              <input v-model="nombre" class="field" required maxlength="120">
            </label>
            <label class="campo ancho">
              <span class="campo-label">Teórico filtrado (.xlsx, dos hojas)</span>
              <input class="field" type="file" accept=".xlsx" required @change="archivo = ($event.target as HTMLInputElement).files?.[0] ?? null">
            </label>
          </div>
          <p v-if="!cronogramas.some((c: any) => c.estado === 'ABIERTO')" class="aviso">
            No hay cronogramas abiertos: créalo primero en «Cronogramas y maestro PVP».
          </p>
          <div class="crear-pie">
            <button class="btn btn-sm" type="button" @click="nuevo = false">Cancelar</button>
            <button class="btn btn-primary btn-sm" type="submit" :disabled="guardando">
              <Loader2 v-if="guardando" :size="14" class="spin" />
              Crear ubicaciones
            </button>
          </div>
        </form>

        <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

        <!-- Sin cíclico abierto: cuál trabajar -->
        <template v-else-if="!actual">
          <ul v-if="ciclos.length" class="ciclos">
            <li v-for="c in ciclos" :key="c.id">
              <button class="card ciclo" @click="abrir(c.id)">
                <strong class="ciclo-nombre">{{ c.nombre }}</strong>
                <span class="ciclo-meta">{{ c.cronograma.nombre }} · {{ c.estado }}</span>
                <span class="ciclo-n">{{ c._count.tareas }} ubicaciones · {{ c._count.casos }} novedades</span>
              </button>
            </li>
          </ul>
          <p v-else class="vacio">No tienes cíclicos disponibles.</p>
        </template>

        <template v-else>
          <InventariosGestion
            v-if="gestor" :ciclo="actual" :operarios="operarios" :guardando="guardando"
            @accion="(a, extra) => accion(a, extra)" @descargar="descargar"
          />

          <!-- El camino del operario: escanear y contar -->
          <section v-if="actual.estado === 'EN_CONTEO' || actual.estado === 'REVISION'" class="card escanear">
            <form @submit.prevent="escanear">
              <label class="campo">
                <span class="campo-label"><ScanLine :size="13" /> Escanea la ubicación</span>
                <input
                  ref="inputEscaneo" v-model="escaneo" class="field grande mono" type="text"
                  autocomplete="off" autocapitalize="characters" autofocus placeholder="04-A-07-06-01"
                >
              </label>
            </form>
            <p class="escanear-pie">
              <b class="tnum">{{ actual.resumen.completadas }}</b> de
              <b class="tnum">{{ actual.resumen.total }}</b> terminadas ·
              <b class="tnum">{{ actual.resumen.pendientes }}</b> sin empezar
            </p>
          </section>

          <section class="card listado">
            <header class="l-head">
              <h2 class="s-titulo">Ubicaciones</h2>
              <label class="campo busca">
                <Search :size="14" class="busca-ic" />
                <input v-model="busca" class="field mono" type="search" placeholder="Buscar ubicación">
              </label>
              <label v-if="!gestor" class="check">
                <input v-model="soloPendientes" type="checkbox"> Solo las que me faltan
              </label>
            </header>

            <ul v-if="actual.tareas.length" class="tareas">
              <li v-for="t in actual.tareas" :key="t.id">
                <button class="tarea" :class="`e-${t.estado.toLowerCase()}`" @click="elegir(t)">
                  <span class="t-ubic mono">{{ t.ubicacion }}</span>
                  <span class="t-meta">
                    {{ t.tipo === 'RECONTEO' ? 'Reconteo' : 'Inicial' }} · {{ ESTADO_TAREA_LABEL[t.estado] }}
                    <template v-if="gestor"> · {{ persona(t.usuarioId) }}</template>
                  </span>
                  <span class="t-tiempo tnum">{{ tiempoTarea(t, ahora) }}</span>
                  <Check v-if="t.estado === 'COMPLETADA'" :size="14" class="t-ok" />
                </button>
              </li>
            </ul>
            <p v-else class="vacio">
              {{ busca.trim() ? `Nada coincide con «${busca.trim()}».` : 'No hay ubicaciones que mostrar.' }}
            </p>

            <div v-if="actual.paginacion.total > actual.tareas.length" class="paginas">
              <span>{{ actual.tareas.length }} de {{ actual.paginacion.total }}</span>
              <button
                class="btn btn-sm" :disabled="actual.paginacion.page <= 1"
                @click="abrir(actual.id, { pagina: actual.paginacion.page - 1 })"
              >Anteriores</button>
              <button
                class="btn btn-sm"
                :disabled="actual.paginacion.page * actual.paginacion.pageSize >= actual.paginacion.total"
                @click="abrir(actual.id, { pagina: actual.paginacion.page + 1 })"
              >Siguientes</button>
            </div>
          </section>
        </template>
      </template>
    </template>

    <InventariosCapturaModal
      ref="captura" v-model:producto="producto"
      :tarea="tarea" :es-mia="esMia" :guardando="guardando" :ahora="ahora"
      @cerrar="cerrarCaptura"
      @iniciar="(u) => accion('iniciar', { ubicacion: u })"
      @pausar="(m) => accion('pausar', { motivo: m })"
      @reanudar="() => accion('reanudar')"
      @consultar="consultar"
      @guardar="guardar"
      @ausente="(plu) => accion('ausente', { codigo: plu })"
      @terminar="terminar"
    />
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 16px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); max-width: 62ch; }
.hero-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }

.card { padding: 18px; margin-bottom: 14px; }
.s-titulo { margin: 0; font-size: 14px; font-weight: 800; color: var(--ink); }
.campo { display: grid; gap: 6px; }
.campo-label { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.field.grande { height: 48px; font-size: 17px; }
.aviso { margin: 10px 0 0; padding: 10px 12px; border-radius: var(--r-sm); font-size: 12.5px; font-weight: 700; color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 12%, transparent); }

.crear-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 12px 0; }
.campo.ancho { grid-column: 1 / -1; }
.crear-pie { display: flex; justify-content: flex-end; gap: 8px; }

.escanear { border: 1px solid var(--brand); }
.escanear-pie { margin: 10px 0 0; font-size: 12.5px; color: var(--muted); }
.escanear-pie b { color: var(--ink); }

.l-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.busca { position: relative; flex: 1 1 200px; }
.busca-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.busca .field { padding-left: 32px; }
.check { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }

.ciclos, .tareas { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ciclos { grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); }
.ciclo { display: grid; gap: 4px; width: 100%; text-align: left; cursor: pointer; }
.ciclo-nombre { font-size: 15px; font-weight: 800; color: var(--ink); }
.ciclo-meta, .ciclo-n { font-size: 12px; color: var(--muted); }

.tarea { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-left: 3px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); cursor: pointer; text-align: left; }
.tarea:hover { border-color: var(--brand); }
.tarea.e-en_curso { border-left-color: var(--brand); }
.tarea.e-completada { border-left-color: var(--u-ok); opacity: .72; }
.t-ubic { font-size: 15px; font-weight: 800; color: var(--ink); }
.t-meta { flex: 1 1 160px; font-size: 12px; color: var(--muted); }
.t-tiempo { font-size: 12px; color: var(--muted); }
.t-ok { color: var(--u-ok); }

.paginas { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12.5px; color: var(--muted); }
.paginas span { margin-right: auto; }
.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 26px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .hero-acciones, .hero-acciones .btn { width: 100%; justify-content: center; }
  .card { padding: 14px; }
}
</style>
