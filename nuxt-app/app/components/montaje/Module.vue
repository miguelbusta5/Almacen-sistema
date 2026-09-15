<script setup lang="ts">
// Montaje Resurtido: se sube el archivo y se reparte a un operario.
//
// Aquí NO corre ningún reloj de trabajo: quien monta reparte, no hace. Lo que se
// ve por montaje es el tiempo transcurrido desde que se repartió y cuánto lleva
// hecho el operario, que es lo que sirve para saber si va a tiempo.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RefreshCw, Upload, ClipboardList, Trash2, User, UserPlus } from '@lucide/vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useToast } from '~/composables/useToast'
import { useAutoRefresh } from '~/composables/useAutoRefresh'
import {
  API_MONTAJE, cronometroDesde, fmtDuracionTarea, ESTADO_TAREA_LABEL,
  type MontajeResurtidoDTO,
} from '~/utils/resurtidoTareas'
import { canSeeModule } from '~/utils/modulePermissions'

const { me, sessionLoaded } = useSessionState()
const { show: showToast } = useToast()

const puedeVer = computed(() => canSeeModule(me.value?.role, 'montaje-resurtido'))
// Ver el módulo es una cosa; montar es un permiso por persona.
const puedeMontar = computed(() => me.value?.can?.montarResurtido === true)

const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  ensureSession()
  tick = setInterval(() => { ahora.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const montajes = ref<MontajeResurtidoDTO[]>([])
const operarios = ref<{ id: string; nombre: string; rol: string }[]>([])
const loading = ref(true)
const subiendo = ref(false)
const borrando = ref<string | null>(null)

const archivo = ref<File | null>(null)
const operarioId = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const detalle = ref<MontajeResurtidoDTO | null>(null)

async function cargar() {
  loading.value = true
  try {
    const res = await $fetch<{ data: MontajeResurtidoDTO[] }>(API_MONTAJE)
    montajes.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los montajes'), true)
  } finally {
    loading.value = false
  }
}

async function cargarOperarios() {
  try {
    const res = await $fetch<{ data: { id: string; nombre: string; rol: string }[] }>(
      `${API_MONTAJE}/operarios`,
    )
    operarios.value = res.data
  } catch { /* la lista vacía ya avisa */ }
}

onMounted(() => { void cargar(); void cargarOperarios() })
useAutoRefresh({
  onRefresh: () => {
    if (!puedeVer.value || subiendo.value || detalle.value) return
    void cargar()
  },
})

function elegirArchivo(e: Event) {
  archivo.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

const puedeSubir = computed(() => !subiendo.value && Boolean(archivo.value) && Boolean(operarioId.value))

async function subir() {
  if (!puedeSubir.value || !archivo.value) return
  subiendo.value = true
  try {
    const fd = new FormData()
    fd.append('archivo', archivo.value)
    fd.append('operarioId', operarioId.value)
    const res = await $fetch<{ data: MontajeResurtidoDTO }>(API_MONTAJE, { method: 'POST', body: fd })
    showToast(`${res.data.progreso.total} tareas asignadas a ${res.data.operarioNombre}`)
    archivo.value = null
    operarioId.value = ''
    if (fileInput.value) fileInput.value.value = ''
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo subir el archivo'), true)
  } finally {
    subiendo.value = false
  }
}

async function borrar(m: MontajeResurtidoDTO) {
  if (!confirm(`¿Borrar el montaje de ${m.operarioNombre} (${m.progreso.total} tareas)?`)) return
  borrando.value = m.id
  try {
    await $fetch(`${API_MONTAJE}/${m.id}`, { method: 'DELETE' })
    showToast('Montaje borrado')
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo borrar'), true)
  } finally {
    borrando.value = null
  }
}

// ── Reasignar lo que falta ─────────────────────────────────────────
// Cuando el turno se acaba sin terminar el resurtido: las completadas quedan del
// primero, lo sin empezar y lo en curso pasa al nuevo (lo en curso con el reloj
// corriendo, cada uno con su tramo).
const reasignando = ref<MontajeResurtidoDTO | null>(null)
const reasignarA = ref('')
const reasignandoGuardar = ref(false)

function responsable(t: MontajeResurtidoDTO['tareas'][number], m: MontajeResurtidoDTO): string {
  return t.responsableId ?? m.operarioId
}
const conteoReasignar = computed(() => {
  const m = reasignando.value
  if (!m) return { pendientes: 0, enCurso: 0, completadas: 0 }
  const faltan = m.tareas.filter((t) => t.estado !== 'COMPLETADA' && responsable(t, m) !== reasignarA.value)
  return {
    pendientes: faltan.filter((t) => !t.horaInicio).length,
    enCurso: faltan.filter((t) => t.horaInicio).length,
    completadas: m.tareas.filter((t) => t.estado === 'COMPLETADA').length,
  }
})
const hayEnPausa = computed(() =>
  reasignando.value?.tareas.some((t) => t.pausaId && t.estado !== 'COMPLETADA') ?? false)

function abrirReasignar(m: MontajeResurtidoDTO) {
  reasignando.value = m
  reasignarA.value = ''
}

async function reasignar() {
  const m = reasignando.value
  if (!m || !reasignarA.value) return
  reasignandoGuardar.value = true
  try {
    const res = await $fetch<{ reasignadas: { pendientes: number; enCurso: number } }>(
      `${API_MONTAJE}/${m.id}/reasignar`, { method: 'POST', body: { operarioId: reasignarA.value } },
    )
    const nombre = operarios.value.find((o) => o.id === reasignarA.value)?.nombre ?? 'el operario'
    const total = res.reasignadas.pendientes + res.reasignadas.enCurso
    showToast(`${total} tarea${total === 1 ? '' : 's'} reasignada${total === 1 ? '' : 's'} a ${nombre}`)
    reasignando.value = null
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo reasignar'), true)
  } finally {
    reasignandoGuardar.value = false
  }
}

// El tiempo que lleva un montaje corriendo: desde que se repartió hasta que se
// completó, o hasta ahora si sigue abierto.
function transcurrido(m: MontajeResurtidoDTO): string {
  if (m.completadoAt) {
    const seg = Math.round((new Date(m.completadoAt).getTime() - new Date(m.montadoAt).getTime()) / 1000)
    return fmtDuracionTarea(seg)
  }
  return cronometroDesde(m.montadoAt, ahora.value) ?? '—'
}
</script>

<template>
  <div class="mod">
    <section class="hero">
      <div>
        <span class="hero-kicker">
          <span class="hero-ic"><ClipboardList :size="13" /></span>
          Almacenamiento · Reparto
        </span>
        <h1 class="hero-title">Montaje Resurtido</h1>
        <p class="hero-desc">Sube el archivo y repártelo a un operario.</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm" @click="cargar">
          <RefreshCw :size="14" /> Actualizar
        </button>
      </div>
    </section>

    <ListSkeleton v-if="!sessionLoaded" />
    <EmptyState
      v-else-if="!puedeVer" title="Sin acceso"
      description="Este módulo es para supervisión de almacenamiento."
    />

    <template v-else>
      <!-- Subir y asignar -->
      <section v-if="puedeMontar" class="card subir bloque">
        <div class="f f-file">
          <span class="lbl">Archivo del resurtido (.xlsx)</span>
          <div class="file-row">
            <button type="button" class="btn btn-sm" :disabled="subiendo" @click="fileInput?.click()">
              <Upload :size="13" /> {{ archivo ? 'Cambiar' : 'Elegir archivo' }}
            </button>
            <span class="file-nom">{{ archivo?.name ?? 'Ninguno seleccionado' }}</span>
            <input ref="fileInput" type="file" accept=".xlsx" class="oculto" @change="elegirArchivo">
          </div>
        </div>
        <label class="f f-op">
          <span class="lbl">Operario asignado</span>
          <select v-model="operarioId" class="field" :disabled="subiendo">
            <option value="">Elige un operario</option>
            <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          </select>
        </label>
        <div class="f f-btn">
          <button class="btn btn-primary submit" :disabled="!puedeSubir" @click="subir">
            <Spinner v-if="subiendo" :size="15" /><Upload v-else :size="15" />
            Montar resurtido
          </button>
        </div>
        <p class="ayuda">
          El archivo debe traer las columnas <b>PLU</b>, <b>ALTURA</b>, <b>PICKING</b> y
          <b>UNIDAD SOLICITADA</b>. La descripción sale del maestro y las tareas se ordenan por posición.
        </p>
      </section>
      <EmptyState
        v-else title="Solo lectura"
        description="No tienes permiso para montar resurtidos. Puedes ver los que ya están repartidos."
      />

      <ListSkeleton v-if="loading" />
      <EmptyState
        v-else-if="!montajes.length" title="Sin montajes"
        description="Todavía no se ha repartido ningún resurtido."
      />

      <!-- Viñetas: un montaje por tarjeta, con su barra de avance -->
      <div v-else class="grid">
        <article v-for="m in montajes" :key="m.id" class="card vin" :class="{ hecho: m.estado === 'COMPLETADO' }">
          <header class="vin-top">
            <span class="vin-op"><User :size="13" /> {{ m.operarioNombre }}</span>
            <span class="vin-tiempo tnum">{{ transcurrido(m) }}</span>
          </header>

          <p class="vin-file" :title="m.nombreArchivo">{{ m.nombreArchivo }}</p>

          <!-- Barra de avance: es lo que se mira de un vistazo para saber si el
               resurtido va a tiempo. -->
          <div class="barra" :aria-valuenow="m.progreso.porcentaje" role="progressbar">
            <span class="barra-fill" :style="{ width: `${m.progreso.porcentaje}%` }" />
          </div>
          <p class="vin-prog">
            <b class="tnum">{{ m.progreso.completadas }}</b> de
            <b class="tnum">{{ m.progreso.total }}</b> tareas
            <span class="vin-pct tnum">{{ m.progreso.porcentaje }}%</span>
          </p>

          <footer class="vin-acc">
            <button class="btn-link" @click="detalle = m">Ver tareas</button>
            <button
              v-if="puedeMontar && m.estado !== 'COMPLETADO' && m.progreso.completadas < m.progreso.total"
              class="btn-link" @click="abrirReasignar(m)"
            >
              <UserPlus :size="12" /> Reasignar lo que falta
            </button>
            <button
              v-if="puedeMontar" class="btn-link danger" :disabled="borrando === m.id"
              @click="borrar(m)"
            >
              <Trash2 :size="12" /> Borrar
            </button>
          </footer>
        </article>
      </div>
    </template>

    <!-- Reasignar lo que falta a otro operario -->
    <div v-if="reasignando" class="overlay" @click.self="reasignando = null">
      <section class="card modal modal-sm">
        <header class="m-head">
          <div>
            <h2 class="m-title">Reasignar lo que falta</h2>
            <p class="m-sub">{{ reasignando.operarioNombre }} · {{ reasignando.nombreArchivo }}</p>
          </div>
          <button class="btn btn-sm" @click="reasignando = null">Cerrar</button>
        </header>
        <div class="m-body reasig">
          <label class="f">
            <span class="lbl">Operario que lo termina</span>
            <select v-model="reasignarA" class="field" :disabled="reasignandoGuardar">
              <option value="">Elige un operario</option>
              <option v-for="o in operarios" :key="o.id" :value="o.id">{{ o.nombre }}</option>
            </select>
          </label>
          <p v-if="reasignarA" class="reasig-resumen">
            Pasan <b>{{ conteoReasignar.pendientes }}</b> sin empezar y <b>{{ conteoReasignar.enCurso }}</b> en curso
            (con el reloj corriendo). Las <b>{{ conteoReasignar.completadas }}</b> completadas quedan de
            {{ reasignando.operarioNombre }}.
          </p>
          <p v-if="hayEnPausa" class="reasig-aviso">
            Hay una tarea en pausa: su responsable debe finalizar la pausa antes de reasignar.
          </p>
          <div class="reasig-acc">
            <button class="btn btn-sm" :disabled="reasignandoGuardar" @click="reasignando = null">Cancelar</button>
            <button
              class="btn btn-sm btn-primary"
              :disabled="!reasignarA || reasignandoGuardar || conteoReasignar.pendientes + conteoReasignar.enCurso === 0"
              @click="reasignar"
            >
              <Spinner v-if="reasignandoGuardar" :size="13" /><UserPlus v-else :size="13" />
              Reasignar
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Detalle de las tareas de un montaje -->
    <div v-if="detalle" class="overlay" @click.self="detalle = null">
      <section class="card modal">
        <header class="m-head">
          <div>
            <h2 class="m-title">{{ detalle.operarioNombre }}</h2>
            <p class="m-sub">{{ detalle.nombreArchivo }} · {{ detalle.progreso.porcentaje }}% completado</p>
          </div>
          <button class="btn btn-sm" @click="detalle = null">Cerrar</button>
        </header>
        <div class="m-body">
          <table class="table">
            <thead>
              <tr>
                <th class="num">#</th><th>PLU</th><th>Descripción</th><th>Altura</th>
                <th>Picking</th><th class="num">Solicitadas</th><th class="num">Bajadas</th>
                <th>Estado</th><th>Responsable</th><th class="num">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in detalle.tareas" :key="t.id">
                <td class="tnum muted">{{ t.orden }}</td>
                <td class="mono strong">{{ t.plu }}</td>
                <td class="desc" :title="t.descripcion">{{ t.descripcion }}</td>
                <td><span class="ubic">{{ t.altura }}</span></td>
                <td><span class="ubic">{{ t.pickingFinal ?? t.pickingSugerido }}</span></td>
                <td class="tnum">{{ t.unidadesSolicitadas }}</td>
                <td class="tnum strong">{{ t.unidadesBajadas ?? '—' }}</td>
                <td>{{ ESTADO_TAREA_LABEL[t.estado] }}</td>
                <td>{{ t.responsableNombre ?? detalle.operarioNombre }}</td>
                <td class="tnum">{{ fmtDuracionTarea(t.duracionSegundos) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
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

.subir { display: grid; grid-template-columns: 1fr 240px auto; gap: 13px; align-items: end; padding: 16px 18px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.file-row { display: flex; align-items: center; gap: 10px; height: 38px; }
.file-nom { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oculto { display: none; }
.submit { height: 38px; padding: 0 18px; }
.ayuda { grid-column: 1 / -1; margin: 4px 0 0; font-size: 12px; color: var(--faint); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.vin { padding: 14px 16px 12px; display: flex; flex-direction: column; gap: 9px; }
.vin.hecho { border-color: color-mix(in srgb, var(--brand) 35%, var(--border)); }
.vin-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.vin-op { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--ink); }
.vin-tiempo { font-family: var(--display); font-size: 15px; font-weight: 700; color: var(--brand); }
.vin-file { margin: 0; font-size: 11.5px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.barra { height: 8px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.barra-fill { display: block; height: 100%; border-radius: 99px; background: var(--brand-grad); transition: width .4s cubic-bezier(.16,1,.3,1); }
.vin-prog { margin: 0; font-size: 12.5px; color: var(--muted); }
.vin-prog b { color: var(--ink); }
.vin-pct { float: right; font-weight: 700; color: var(--brand); }

.vin-acc { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; padding-top: 9px; border-top: 1px solid var(--border); }
.btn-link { background: none; border: none; padding: 0; font-size: 12.5px; font-weight: 600; color: var(--brand); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.btn-link.danger { color: var(--muted); }
.btn-link.danger:hover { color: var(--u-critico); }

.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,15,28,.55); backdrop-filter: blur(3px); }
.modal { width: min(1000px, 100%); max-height: 88vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.m-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.m-head > div { flex: 1; }
.m-title { margin: 0; font-family: var(--display); font-size: 17px; font-weight: 700; color: var(--ink); }
.m-sub { margin: 3px 0 0; font-size: 12px; color: var(--muted); }
.m-body { overflow: auto; }
.modal-sm { width: min(480px, 100%); }
.reasig { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 18px; }
.reasig-resumen { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
.reasig-resumen b { color: var(--ink); }
.reasig-aviso { margin: 0; font-size: 12px; color: var(--u-aviso); }
.reasig-acc { display: flex; justify-content: flex-end; gap: 9px; }

.table { width: 100%; min-width: 900px; border-collapse: separate; border-spacing: 0; }
.table th { position: sticky; top: 0; z-index: 1; text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 10px 13px; white-space: nowrap; background: var(--surface-2); border-bottom: 1px solid var(--border-strong); }
.table th.num { text-align: right; }
.table td { padding: 9px 13px; font-size: 12.5px; color: var(--ink-2); white-space: nowrap; border-bottom: 1px solid var(--border); }
.table td.tnum { text-align: right; }
.table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--surface-2) 55%, transparent); }
.desc { max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--muted); }
.ubic { display: inline-block; padding: 1px 6px; border-radius: var(--r-xs); background: var(--surface-3); border: 1px solid var(--border); font-family: var(--mono); font-size: 11.5px; }

@media (max-width: 900px) {
  .subir { grid-template-columns: 1fr; }
  .hero-title { font-size: 24px; }
}
</style>
