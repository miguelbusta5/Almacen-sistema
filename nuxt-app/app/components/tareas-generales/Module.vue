<script setup lang="ts">
// Tareas generales — lo que manda supervisión y no cabe en ningún módulo.
//
// Supervisión ve todas y las cierra; el operario ve solo las suyas, con su
// reloj corriendo. El tiempo de cada persona es independiente: al que ya
// terminó se le cierra sin tocar a los demás.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ClipboardList, RefreshCw, Loader2, Plus, Check, X, Timer, UserCheck } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ensureSession } from '~/composables/useSession'

interface Asignado {
  id: string
  usuarioId: string
  nombre: string
  horaInicio: string
  horaFin: string | null
  finalizadoPor: { id: string; nombre: string } | null
}
interface Tarea {
  id: string
  descripcion: string
  estado: 'EN_CURSO' | 'FINALIZADA'
  fecha: string
  horaInicio: string
  horaFin: string | null
  creadoPor: { id: string; nombre: string } | null
  finalizadaPor: { id: string; nombre: string } | null
  asignados: Asignado[]
}
interface Operario { id: string; nombre: string; rol: string }

const API = '/api/tareas-generales'
const { show } = useToast()

const tareas = ref<Tarea[]>([])
const operarios = ref<Operario[]>([])
const puedeMandar = ref(false)
const historico = ref(false)
const cargando = ref(true)
const guardando = ref(false)

const creando = ref(false)
const descripcion = ref('')
const elegidos = ref<string[]>([])

const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
  ensureSession()
  cargar()
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

// Operarios y montacarguistas por separado: al elegir a quién mandar, importa
// quién tiene equipo.
const GRUPOS_ROL: Array<{ rol: string; titulo: string }> = [
  { rol: 'OPERARIO_ALMACENAMIENTO', titulo: 'Operarios de almacenamiento' },
  { rol: 'MONTACARGAS', titulo: 'Montacarguistas' },
]
const grupos = computed(() => GRUPOS_ROL
  .map((g) => ({ ...g, gente: operarios.value.filter((o) => o.rol === g.rol) }))
  .filter((g) => g.gente.length > 0))

const puedeCrear = computed(() => descripcion.value.trim().length > 0 && elegidos.value.length > 0)
// Cuánta gente hay trabajando ahora mismo en algo mandado: es el número que
// mira el supervisor antes de repartir más.
const trabajando = computed(() => tareas.value
  .filter((t) => t.estado === 'EN_CURSO')
  .reduce((a, t) => a + t.asignados.filter((x) => !x.horaFin).length, 0))

function segundos(a: Asignado): number {
  const fin = a.horaFin ? new Date(a.horaFin).getTime() : ahora.value
  return Math.max(0, Math.round((fin - new Date(a.horaInicio).getTime()) / 1000))
}

function reloj(a: Asignado): string {
  const seg = segundos(a)
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/** Hora de inicio, para leer la tarjeta sin hacer cuentas. */
function hora(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', timeStyle: 'short' }).format(new Date(iso))
}

function mensaje(e: any, fallback = 'No se pudo completar la acción'): string {
  return e?.data?.statusMessage ?? fallback
}

async function cargar() {
  cargando.value = true
  try {
    const lista = await $fetch<{ data: Tarea[]; puedeMandar: boolean }>(API, {
      query: historico.value ? { historico: '1' } : {},
    })
    tareas.value = lista.data
    puedeMandar.value = lista.puedeMandar
    if (lista.puedeMandar && operarios.value.length === 0) {
      const ops = await $fetch<{ data: Operario[] }>(`${API}/operarios`)
      operarios.value = ops.data
    }
  } catch (e) {
    show(mensaje(e, 'No se pudieron cargar las tareas'), true)
  } finally {
    cargando.value = false
  }
}

function alternar(id: string) {
  elegidos.value = elegidos.value.includes(id)
    ? elegidos.value.filter((x) => x !== id)
    : [...elegidos.value, id]
}

async function crear() {
  if (!puedeCrear.value || guardando.value) return
  guardando.value = true
  try {
    await $fetch(API, {
      method: 'POST',
      body: { descripcion: descripcion.value.trim(), usuarioIds: elegidos.value },
    })
    show('Tarea asignada')
    descripcion.value = ''
    elegidos.value = []
    creando.value = false
    await cargar()
  } catch (e) {
    show(mensaje(e, 'No se pudo asignar la tarea'), true)
  } finally {
    guardando.value = false
  }
}

async function finalizar(t: Tarea, usuarioId: string | null) {
  if (guardando.value) return
  guardando.value = true
  try {
    await $fetch(`${API}/${t.id}/finalizar`, { method: 'POST', body: { usuarioId } })
    show(usuarioId ? 'Tiempo cerrado' : 'Tarea finalizada')
    await cargar()
  } catch (e) {
    show(mensaje(e, 'No se pudo finalizar'), true)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><ClipboardList :size="13" /></span>
          CEDI
        </span>
        <h1 class="hero-title">Tareas generales</h1>
        <p class="hero-desc">
          {{ puedeMandar
            ? 'Lo que mandas a hacer y no cabe en ningún módulo. El tiempo de cada persona corre hasta que la das por terminada.'
            : 'Lo que te ha asignado supervisión. El tiempo corre hasta que la den por terminada.' }}
        </p>
      </div>

      <div class="hero-acciones">
        <button v-if="puedeMandar && !creando" class="btn btn-primary btn-sm" @click="creando = true">
          <Plus :size="14" /> Asignar tarea
        </button>
        <button class="btn btn-ghost btn-sm" @click="historico = !historico; cargar()">
          {{ historico ? 'En curso' : 'Terminadas' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="cargando" @click="cargar">
          <RefreshCw :size="14" /> Actualizar
        </button>
      </div>
    </section>

    <!-- Una sola cifra: cuánta gente está ocupada en algo mandado. -->
    <p v-if="puedeMandar && !historico && !cargando" class="resumen">
      <UserCheck :size="14" />
      <span v-if="trabajando"><strong>{{ trabajando }}</strong> {{ trabajando === 1 ? 'persona' : 'personas' }} en tareas ahora mismo</span>
      <span v-else>Nadie tiene una tarea general en curso</span>
    </p>

    <section v-if="creando && puedeMandar" class="crear">
      <header class="crear-head">
        <h2 class="crear-titulo">Nueva tarea</h2>
        <button class="icono" aria-label="Cerrar" @click="creando = false"><X :size="16" /></button>
      </header>

      <label class="campo">
        <span class="campo-label">¿Qué hay que hacer?</span>
        <textarea
          v-model="descripcion" class="input" rows="2" maxlength="500"
          placeholder="Organizar el pasillo 4, apoyar la descarga del contenedor…"
        />
      </label>

      <div class="campo">
        <span class="campo-label">
          ¿Quién la hace?
          <span v-if="elegidos.length" class="campo-n">{{ elegidos.length }} seleccionados</span>
        </span>
        <div v-for="g in grupos" :key="g.rol" class="grupo">
          <span class="grupo-titulo">{{ g.titulo }}</span>
          <div class="gente">
            <button
              v-for="o in g.gente" :key="o.id" type="button"
              class="chip" :class="{ on: elegidos.includes(o.id) }" @click="alternar(o.id)"
            >
              <Check v-if="elegidos.includes(o.id)" :size="13" />
              {{ o.nombre }}
            </button>
          </div>
        </div>
        <p v-if="!operarios.length" class="campo-vacio">No hay operarios ni montacarguistas activos.</p>
      </div>

      <div class="crear-pie">
        <button class="btn btn-ghost btn-sm" @click="creando = false">Cancelar</button>
        <button class="btn btn-primary btn-sm" :disabled="!puedeCrear || guardando" @click="crear">
          <Plus :size="14" /> Asignar
        </button>
      </div>
    </section>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

    <ul v-else-if="tareas.length" class="tareas">
      <li v-for="t in tareas" :key="t.id" class="tarea" :class="{ fin: t.estado === 'FINALIZADA' }">
        <header class="t-head">
          <div>
            <p class="t-desc">{{ t.descripcion }}</p>
            <p class="t-meta">
              <Timer :size="12" /> {{ hora(t.horaInicio) }} · la mandó {{ t.creadoPor?.nombre ?? '—' }}
              <span v-if="t.finalizadaPor"> · la cerró {{ t.finalizadaPor.nombre }}</span>
            </p>
          </div>
          <span class="t-chip">{{ t.estado === 'EN_CURSO' ? 'En curso' : 'Terminada' }}</span>
        </header>

        <ul class="asignados">
          <li v-for="a in t.asignados" :key="a.id" class="asignado" :class="{ cerrado: !!a.horaFin }">
            <span class="a-nombre">{{ a.nombre }}</span>
            <span class="a-reloj mono tnum" :class="{ vivo: !a.horaFin }">{{ reloj(a) }}</span>
            <button
              v-if="puedeMandar && !a.horaFin" class="btn btn-sm"
              :disabled="guardando" @click="finalizar(t, a.usuarioId)"
            >
              <Check :size="13" /> Terminó
            </button>
            <span v-else-if="a.horaFin" class="a-ok"><Check :size="13" /> Terminó</span>
          </li>
        </ul>

        <footer v-if="puedeMandar && t.estado === 'EN_CURSO'" class="t-pie">
          <button class="btn btn-primary btn-sm" :disabled="guardando" @click="finalizar(t, null)">
            <Check :size="14" /> Finalizar para todos
          </button>
        </footer>
      </li>
    </ul>

    <p v-else class="vacio">
      {{ historico ? 'No hay tareas terminadas.' : 'No hay tareas en curso.' }}
    </p>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 18px; flex-wrap: wrap; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.hero-ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.hero-title { margin: 7px 0 3px; font-family: var(--display); font-size: 30px; font-weight: 800; letter-spacing: -.035em; color: var(--ink); }
.hero-desc { margin: 0; font-size: 13px; color: var(--muted); max-width: 62ch; }
.hero-acciones { display: flex; gap: 8px; flex-wrap: wrap; }

.resumen { display: flex; align-items: center; gap: 7px; margin: 0 0 16px; font-size: 12.5px; color: var(--muted); }
.resumen > svg { color: var(--brand); }
.resumen strong { color: var(--ink); font-variant-numeric: tabular-nums; }

.crear { padding: 16px 18px; margin-bottom: 18px; border: 1px solid var(--brand); border-radius: var(--r-md); background: var(--surface); }
.crear-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.crear-titulo { margin: 0; font-size: 14px; font-weight: 800; color: var(--ink); }
.icono { display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: var(--r-sm); background: transparent; color: var(--muted); cursor: pointer; }
.icono:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--ink); }
.campo { display: block; margin-bottom: 14px; }
.campo-label { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.campo-n { font-weight: 700; color: var(--brand); }
.campo-vacio { margin: 8px 0 0; font-size: 12px; color: var(--muted); }
.input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; resize: vertical; }
.gente { display: flex; gap: 7px; flex-wrap: wrap; }
.grupo + .grupo { margin-top: 10px; }
.grupo-titulo { display: block; margin-bottom: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.chip { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: var(--r-pill); border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.chip.on { color: var(--brand); border-color: var(--brand); background: var(--brand-tint); }
.crear-pie { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }

.tareas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.tarea { padding: 15px 17px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); border-left: 3px solid var(--brand); }
.tarea.fin { border-left-color: var(--border-strong); opacity: .78; }
.t-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.t-desc { margin: 0; font-size: 14.5px; font-weight: 700; line-height: 1.35; color: var(--ink); }
.t-meta { display: flex; align-items: center; gap: 5px; margin: 5px 0 0; font-size: 11.5px; color: var(--muted); flex-wrap: wrap; }
.t-chip { flex-shrink: 0; padding: 3px 10px; border-radius: var(--r-pill); font-size: 11px; font-weight: 700; color: var(--brand); background: var(--brand-tint); }
.tarea.fin .t-chip { color: var(--muted); background: color-mix(in srgb, var(--muted) 12%, transparent); }

.asignados { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.asignado { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 12px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--ink) 4%, transparent); }
.asignado.cerrado { background: transparent; border: 1px dashed var(--border); }
.a-nombre { flex: 1 1 140px; font-size: 13px; font-weight: 600; color: var(--ink); }
.a-reloj { min-width: 62px; text-align: right; font-size: 13px; font-weight: 800; color: var(--muted); }
.a-reloj.vivo { color: var(--brand); }
.a-ok { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--u-ok); }
.t-pie { display: flex; justify-content: flex-end; margin-top: 12px; }

.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .hero-acciones, .hero-acciones .btn { width: 100%; }
  .hero-acciones .btn { justify-content: center; }
  .a-reloj { text-align: left; }
  .t-pie .btn, .crear-pie .btn { flex: 1; justify-content: center; }
}
</style>
